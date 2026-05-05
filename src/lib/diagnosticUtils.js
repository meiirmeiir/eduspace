/**
 * DiagnosticEngine — Space Knowledge Tracing (SKT)
 *
 * Алгоритм навигации по графу знаний:
 *  1. Старт: самый высокий класс в первой вертикали
 *  2. BLOCKED (2 ошибки подряд) → спуск к prerequisite_id внутри той же вертикали
 *     Если prerequisite_id = null (дно графа) → смена вертикали
 *  3. MASTERED (верно + asked ≥ MIN_PER_SKILL) → следующий активный навык в вертикали
 *     Если таких нет → смена вертикали
 *  4. EXHAUSTED (задачи кончились) → следующий активный навык / смена вертикали
 *  5. FALLBACK: если currentSkill пустой — полный скан всех навыков
 */

// ── checkTestStatus — гвардеец секционного лимита ─────────────────────────────
/**
 * Чистая функция. Вызывается СТРОГО ПЕРЕД генерацией следующего вопроса
 * (в конце submitAnswer, до _pickWithFallback).
 *
 * Приоритет проверок — сверху вниз, без исключений:
 *
 *  1. HARD LIMIT  (>= 28)  → PAUSE_SESSION  — абсолютная стена
 *  2. SOFT + empty stack   → SECTION_DONE   — идеальное завершение
 *  3. SOFT + stack > tail  → PAUSE_SESSION  — хвост слишком длинный
 *  4. SOFT + stack <= tail → CONTINUE       — овертайм: добиваем хвост
 *  5. < SOFT               → CONTINUE       — штатный режим
 *
 * Ключевое свойство: функция вычисляется заново на каждом шаге.
 * Флаг extendMode не нужен — именно он позволял стеку расти без контроля.
 *
 * @param {{ answered: number, stackSize: number }} state
 * @returns {'CONTINUE' | 'PAUSE_SESSION' | 'SECTION_DONE'}
 */
export function checkTestStatus({ answered, stackSize }) {
  const SOFT_LIMIT = 25;
  const HARD_LIMIT = 28;
  const MAX_TAIL   = 3;

  // 1. Абсолютная стена — без исключений
  if (answered >= HARD_LIMIT) return 'PAUSE_SESSION';

  // 2. Идеальное завершение раздела
  if (answered >= SOFT_LIMIT && stackSize === 0) return 'SECTION_DONE';

  // 3. Мягкий лимит пройден, но хвост слишком длинный
  if (answered >= SOFT_LIMIT && stackSize > MAX_TAIL) return 'PAUSE_SESSION';

  // 4. Мягкий лимит пройден, хвост маленький — овертайм, добиваем
  if (answered >= SOFT_LIMIT && stackSize <= MAX_TAIL) return 'CONTINUE';

  // 5. Штатный режим
  return 'CONTINUE';
}

export class DiagnosticEngine {
  constructor(taskBankDocs, targetGrade) {
    this.QUESTIONS_PER_SECTION = 25; // SOFT_LIMIT — информационная константа
    this.MAX_TOTAL_QUESTIONS   = 300; // абсолютный предел между разделами
    this.MIN_PER_SKILL = 2;
    this.BLOCK_FAILS   = 2;
    this.questionCount        = 0; // суммарно за все разделы
    this.sectionQuestionCount = 0; // вопросов в текущем разделе
    this.answeredIds   = new Set();
    // Реальный класс ученика: ограничивает _entrySkill / _nextActiveInVertical.
    // parseGrade — hoisted function declaration, доступна здесь.
    this.targetGrade = parseGrade(targetGrade) || 12;

    // Строим граф навыков: skill_id → состояние
    this.skillMap = {};
    taskBankDocs.forEach(doc => {
      const sid = doc.skill_id || doc.id;
      // prerequisites хранится как массив; поддерживаем и старое поле prerequisite_id
      let prereqs = doc.prerequisites || [];
      if (!Array.isArray(prereqs)) prereqs = prereqs ? [prereqs] : [];
      if (prereqs.length === 0 && doc.prerequisite_id) prereqs = [doc.prerequisite_id];
      this.skillMap[sid] = {
        id:               sid,
        doc,
        vertical:         doc.vertical_line_id || 'UNKNOWN',
        grade:            Number(doc.grade) || 0,
        prerequisites:    prereqs,
        tasks:            doc.tasks || [],
        asked:            0,
        correct:          0,
        consecutiveFails: 0,
        status:           'ACTIVE', // ACTIVE | MASTERED | BLOCKED | EXHAUSTED
      };
    });

    // Уникальные вертикали в порядке вставки
    this.verticalOrder = [...new Set(taskBankDocs.map(d => d.vertical_line_id || 'UNKNOWN'))];
    this.verticalIdx   = 0;

    // DFS-стек пререквизитов и множества завершённых навыков
    this.prerequisiteStack = []; // skill_id в порядке обхода (первый = следующий)
    this.masteredSkills    = new Set();
    // БАГ 1 ФИХ: навыки со статусом BLOCKED тоже фильтруются из стека,
    // чтобы не тестировать один и тот же заваленный навык по 5-10 раз.
    this.blockedSkills     = new Set();

    // Стартуем с навыка максимального класса в первой вертикали
    this.currentSkillId = this._entrySkill(this.verticalOrder[0]);

    // Активная вертикаль верхнего уровня — меняется только через _switchVertical().
    // Нужна чтобы после DFS через чужую вертикаль вернуться в свою.
    this.activeVertical = this.verticalOrder[0];
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  start() {
    const task = this._pickWithFallback();
    const s    = this.skillMap[this.currentSkillId];
    this._log({
      phase: 'START', transition: null,
      skill: this.currentSkillId,
      vertical: s?.vertical || '—',
      availableCount: this._countAvail(this.currentSkillId),
      selectionReason: `Начало. Вертикаль: ${s?.vertical}, навык: ${this.currentSkillId} (${s?.grade} класс).`,
    });
    return task;
  }

  submitAnswer(taskId, correct) {
    this.questionCount++;
    this.sectionQuestionCount++;
    this.answeredIds.add(taskId);

    if (this.questionCount >= this.MAX_TOTAL_QUESTIONS) {
      const d = { phase:'LIMIT_REACHED', skillStatusLine:'Абсолютный лимит достигнут', verticalName:'—', availableCount:0, selectionReasonRu:'Достигнут абсолютный лимит вопросов.', sessionStatus:'ALL_DONE' };
      this._log({ phase:'LIMIT_REACHED', transition:'ABSOLUTE_MAX', skill:'—', vertical:'N/A', availableCount:0, selectionReason:d.selectionReasonRu });
      return { task: null, debug: d };
    }

    const skill = this.skillMap[this.currentSkillId];
    if (!skill) {
      return { task: null, debug: { phase:'ERROR', skillStatusLine:'Навык не найден', verticalName:'—', availableCount:0, selectionReasonRu:'Ошибка навигации.' } };
    }

    skill.asked++;
    if (correct) { skill.correct++; skill.consecutiveFails = 0; }
    else         { skill.consecutiveFails++; }

    const fails     = skill.asked - skill.correct;
    const mastered  = correct && skill.correct >= this.MIN_PER_SKILL;
    const blocked   = skill.consecutiveFails >= this.BLOCK_FAILS;
    const exhausted = !this._hasAvail(this.currentSkillId);

    let phase, skillStatusLine, selectionReasonRu;
    const prevSkillId = this.currentSkillId;

    if (mastered) {
      // ── MASTERED ───────────────────────────────────────────────────────────
      skill.status = 'MASTERED';
      this.masteredSkills.add(skill.id);
      this.propagateMastery(skill.id); // рекурсивно помечаем все пререквизиты
      skillStatusLine = `corrects: ${skill.correct}/${skill.asked} ➡️ [СТАТУС ИЗМЕНЕН НА: MASTERED]`;

      // _popStack пропускает уже освоённые/заблокированные — после propagateMastery стек может опустеть
      const stackNext = this._popStack();
      if (stackNext) {
        this.currentSkillId = stackNext;
        phase = 'DFS_POP';
        selectionReasonRu = `Навык освоен. Стек: [${this.prerequisiteStack.join(',')}]. Всплытие → [${stackNext}] (${this.skillMap[stackNext]?.grade} класс).`;
      } else {
        // Стек пуст — Apex Node Logic: если освоен апекс-узел → сразу переключаем вертикаль
        const vertPool  = Object.values(this.skillMap)
          .filter(s => s.vertical === skill.vertical && s.grade <= this.targetGrade);
        const apexGrade = vertPool.length ? Math.max(...vertPool.map(s => s.grade)) : 0;
        const isApexNode = skill.grade === apexGrade;

        if (isApexNode) {
          // Апекс освоен → немедленная смена вертикали, не проверяем другие навыки того же грейда
          this._switchVertical();
          phase = 'VERTICAL_SWITCH';
          selectionReasonRu = `Апекс [${skill.id}] (${skill.grade}кл) освоен → немедленная смена вертикали → ${this.activeVertical}.`;
        } else {
          const nextId = this._nextActiveInVertical(this.activeVertical);
          if (nextId) {
            this.currentSkillId = nextId;
            phase = 'PRIMARY_SCAN';
            selectionReasonRu = `Навык освоен. Стек исчерпан. Следующий в вертикали ${this.activeVertical}: [${nextId}] (${this.skillMap[nextId].grade} класс).`;
          } else {
            this._switchVertical();
            phase = 'VERTICAL_SWITCH';
            selectionReasonRu = `Навык освоен. Стек исчерпан. Вертикаль ${this.activeVertical} исчерпана. Смена → ${this.activeVertical}.`;
          }
        }
      }

    } else if (blocked) {
      // ── BLOCKED ────────────────────────────────────────────────────────────
      skill.status = 'BLOCKED';
      skill.consecutiveFails = 0;
      this.blockedSkills.add(skill.id); // БАГ 1 ФИХ: фиксируем заваленный навык
      skillStatusLine = `fails: ${fails}/${skill.asked} ➡️ [СТАТУС ИЗМЕНЕН НА: BLOCKED]`;
      const ds = this._descendOrSwitch(skill);
      this.currentSkillId = ds.nextId;
      phase = ds.phase;
      selectionReasonRu = ds.reason;

    } else if (exhausted) {
      // ── EXHAUSTED ──────────────────────────────────────────────────────────
      skill.status = 'EXHAUSTED';
      skillStatusLine = correct
        ? `corrects: ${skill.correct}/${skill.asked} ➡️ [СТАТУС ИЗМЕНЕН НА: EXHAUSTED]`
        : `fails: ${fails}/${skill.asked} ➡️ [СТАТУС ИЗМЕНЕН НА: EXHAUSTED]`;

      if (skill.correct === 0) {
        // Ни одного верного ответа — задачи кончились раньше блокировки.
        // БАГ 1 ФИХ: считаем провалом, спускаемся как BLOCKED.
        const ds = this._descendOrSwitch(skill);
        this.currentSkillId = ds.nextId;
        phase = ds.phase;
        selectionReasonRu = `[EXHAUSTED→провал] ${ds.reason}`;
      } else if (this.prerequisiteStack.length > 0) {
        // Были верные ответы и стек не пуст — продолжаем DFS
        const nextId = this._popStack();
        this.currentSkillId = nextId;
        phase = 'DFS_POP';
        selectionReasonRu = `Задачи исчерпаны (есть верные). Стек → [${nextId}] (${this.skillMap[nextId]?.grade} класс).`;
      } else {
        // Были верные ответы, стек пуст — идём дальше по activeVertical
        const nextId = this._nextActiveInVertical(this.activeVertical);
        if (nextId) {
          this.currentSkillId = nextId;
          phase = 'PRIMARY_SCAN';
          selectionReasonRu = `Задачи исчерпаны (есть верные). Следующий в вертикали ${this.activeVertical}: [${nextId}] (${this.skillMap[nextId].grade} класс).`;
        } else {
          this._switchVertical();
          phase = 'VERTICAL_SWITCH';
          selectionReasonRu = `Задачи исчерпаны (есть верные). Вертикаль ${this.activeVertical} исчерпана. Смена → ${this.activeVertical}.`;
        }
      }

    } else {
      // ── CONTINUING ─────────────────────────────────────────────────────────
      skillStatusLine = correct
        ? `corrects: ${skill.correct}/${skill.asked} ➡️ [СТАТУС ИЗМЕНЕН НА: CONTINUING]`
        : `fails: ${fails}/${skill.asked} ➡️ [СТАТУС ИЗМЕНЕН НА: CONTINUING]`;
      phase = 'PRIMARY_SCAN';
      selectionReasonRu = `Продолжаем навык ${skill.id} (${skill.grade} класс). Ошибок: ${skill.consecutiveFails}/${this.BLOCK_FAILS}. Верных: ${skill.correct}/${this.MIN_PER_SKILL}.`;
    }

    // ── Гвардеец секционного лимита ────────────────────────────────────────
    // Вызывается ПЕРЕД генерацией следующего вопроса — на каждом шаге без исключений.
    // Флаг extendMode удалён: он делал этот блок однократным и позволял стеку расти бесконтрольно.
    const statusDecision = checkTestStatus({
      answered:  this.sectionQuestionCount,
      stackSize: this.prerequisiteStack.length,
    });

    if (statusDecision === 'PAUSE_SESSION' || statusDecision === 'SECTION_DONE') {
      const stackSize  = this.prerequisiteStack.length;
      const curSkillS  = this.skillMap[this.currentSkillId];
      const vertName_  = curSkillS?.vertical || '—';
      const isComplete = statusDecision === 'SECTION_DONE';
      const sessionStatus_ = isComplete ? 'SECTION_DONE' : 'SECTION_COMPLETE';
      const reason_ = isComplete
        ? `Раздел завершён (стек пуст после ${this.sectionQuestionCount} вопросов).`
        : `Раздел приостановлен после ${this.sectionQuestionCount} вопросов. В стеке ${stackSize} навыков.`;
      this._log({ phase:'SECTION_GATE', transition:`${statusDecision} | стек: ${stackSize}`, skill:this.currentSkillId, vertical:vertName_, availableCount:0, selectionReason:reason_ });
      return { task: null, debug:{ phase:'SECTION_GATE', skillStatusLine, verticalName:vertName_, availableCount:0, selectionReasonRu:reason_, sessionStatus:sessionStatus_, remainingStack:stackSize } };
    }
    // statusDecision === 'CONTINUE' → продолжаем

    const task     = this._pickWithFallback();
    const curSkill = this.skillMap[this.currentSkillId];
    const vertName = curSkill?.vertical || '—';
    const avail    = this._countAvail(this.currentSkillId);
    const sessionStatus = task ? 'ONGOING' : 'ALL_DONE';

    if (!task) selectionReasonRu = 'Все навыки проверены. Диагностика завершена.';

    this._log({ phase, transition:`[${prevSkillId}→${this.currentSkillId}] ${skillStatusLine}`, skill:this.currentSkillId, vertical:vertName, availableCount:avail, selectionReason:selectionReasonRu });
    return { task, debug:{ phase, skillStatusLine, verticalName:vertName, availableCount:avail, selectionReasonRu, sessionStatus } };
  }

  /** Сброс счётчика раздела — вызывается SmartDiagRunner при старте нового раздела. */
  startNewSection() {
    this.sectionQuestionCount = 0;
    return this._pickWithFallback(); // первый вопрос нового раздела
  }

  /** Экспортирует состояние движка для сохранения между разделами. */
  exportState() {
    const skillStatuses = {};
    Object.values(this.skillMap).forEach(s => {
      skillStatuses[s.id] = { asked: s.asked, correct: s.correct, consecutiveFails: s.consecutiveFails, status: s.status };
    });
    return {
      skillStatuses,
      verticalOrder:     [...this.verticalOrder],
      verticalIdx:       this.verticalIdx,
      prerequisiteStack: [...this.prerequisiteStack],
      masteredSkills:    [...this.masteredSkills],
      blockedSkills:     [...this.blockedSkills], // БАГ 1 ФИХ
      currentSkillId:    this.currentSkillId,
      activeVertical:    this.activeVertical,
      questionCount:     this.questionCount,
      answeredIds:       [...this.answeredIds],
      targetGrade:       this.targetGrade,        // БАГ 2 ФИХ
    };
  }

  /** Восстанавливает состояние движка из exportState() (вызывать после конструктора). */
  applyExportedState(state) {
    if (!state) return;
    if (state.skillStatuses) {
      Object.entries(state.skillStatuses).forEach(([sid, ss]) => {
        if (this.skillMap[sid]) {
          this.skillMap[sid].asked            = ss.asked            ?? 0;
          this.skillMap[sid].correct          = ss.correct          ?? 0;
          this.skillMap[sid].consecutiveFails = ss.consecutiveFails ?? 0;
          this.skillMap[sid].status           = ss.status           || 'ACTIVE';
        }
      });
    }
    if (state.verticalOrder)      this.verticalOrder     = state.verticalOrder;
    if (state.verticalIdx != null) this.verticalIdx      = state.verticalIdx;
    this.prerequisiteStack = state.prerequisiteStack || [];
    this.masteredSkills    = new Set(state.masteredSkills || []);
    this.blockedSkills     = new Set(state.blockedSkills  || []); // БАГ 1 ФИХ
    if (state.currentSkillId)     this.currentSkillId   = state.currentSkillId;
    if (state.activeVertical)     this.activeVertical   = state.activeVertical;
    this.questionCount        = state.questionCount ?? 0;
    this.answeredIds          = new Set(state.answeredIds || []);
    this.sectionQuestionCount = 0; // новый раздел начинается с нуля
    if (state.targetGrade != null) this.targetGrade     = state.targetGrade; // БАГ 2 ФИХ
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  /**
   * Навык максимального класса в вертикали с доступными задачами.
   * БАГ 2 ФИХ: ограничиваем поиск классом ученика (targetGrade),
   * чтобы смена вертикали не сбрасывала тест на 11 класс.
   */
  _entrySkill(verticalId) {
    return Object.values(this.skillMap)
      .filter(s => s.vertical === verticalId && s.tasks.length > 0 && s.grade <= this.targetGrade)
      .sort((a, b) => b.grade - a.grade)[0]?.id || null;
  }

  /**
   * Следующий навык при ПУСТОМ стеке — строгое правило «Только Верхний Этаж».
   *
   * Top-Floor Only Rule:
   *  1. topGrade = максимальный класс среди всех навыков вертикали ≤ targetGrade.
   *  2. Возвращаем ТОЛЬКО ACTIVE-навыки с grade === topGrade.
   *  3. Если таких нет (всё протестировано / заблокировано) → null.
   *     Вызывающий код обязан вызвать _switchVertical().
   *
   * СТРОГО ЗАПРЕЩЕНО: возвращать навыки с grade < topGrade при пустом стеке.
   * Спуск к младшим классам происходит ИСКЛЮЧИТЕЛЬНО через DFS-стек,
   * когда ученик завалил навык верхнего этажа (BLOCKED → _descendOrSwitch).
   */
  _nextActiveInVertical(verticalId) {
    const pool = Object.values(this.skillMap)
      .filter(s => s.vertical === verticalId && s.grade <= this.targetGrade);

    if (pool.length === 0) return null;

    // Верхний этаж вертикали (может быть < targetGrade если тема короткая)
    const topGrade = Math.max(...pool.map(s => s.grade));

    // Только навыки строго на topGrade — без какого-либо спуска
    return pool
      .filter(s =>
        s.grade === topGrade &&
        s.status === 'ACTIVE' &&
        !this.blockedSkills.has(s.id) &&
        this._hasAvail(s.id),
      )
      .sort((a, b) => a.id.localeCompare(b.id))[0]?.id || null;
  }

  /**
   * Production-ready рекурсивная propagateMastery.
   *
   * Рекурсивно помечает ВСЕ пресеквизиты навыка (и их пресеквизиты) как MASTERED,
   * спускаясь до grade 5 за один вызов.
   *
   * @param {string} skillId — ID освоённого навыка
   * @param {Set}    _visited — защита от циклических зависимостей (создаётся внутри)
   *
   * Результат для идеального студента: 2 вопроса на вертикаль →
   * propagateMastery закрывает всю вертикаль вниз → 15-20 вопросов суммарно.
   */
  propagateMastery(skillId, _visited = new Set()) {
    // Cycle guard: prevents infinite recursion in circular/shared prerequisites
    if (_visited.has(skillId)) return;
    _visited.add(skillId);

    const skill = this.skillMap[skillId];
    if (!skill) return;

    for (const prereqId of (skill.prerequisites || [])) {
      if (!this.masteredSkills.has(prereqId) && this.skillMap[prereqId]) {
        this.masteredSkills.add(prereqId);
        this.skillMap[prereqId].status = 'MASTERED';
        // Remove from DFS stack — no point testing an already-mastered prerequisite
        const idx = this.prerequisiteStack.indexOf(prereqId);
        if (idx !== -1) this.prerequisiteStack.splice(idx, 1);
        // Recurse: cascade mastery down the full prerequisite chain
        this.propagateMastery(prereqId, _visited);
      }
    }
  }

  /**
   * Единая логика "провала" — используется при BLOCKED и EXHAUSTED(0 верных).
   * Приоритет: явные пререквизиты → стек → авто-спуск по классу → возврат к activeVertical → смена вертикали.
   */
  _descendOrSwitch(skill) {
    // 1. Явные пререквизиты (из CDM/CGM)
    // БАГ 1 ФИХ: тройной фильтр — не добавлять в стек навыки которые:
    //   (a) уже освоены (masteredSkills)
    //   (b) уже заблокированы в этой сессии (blockedSkills)
    //   (c) уже есть в очереди (дубли в стеке → комбинаторный взрыв)
    const unmasteredPrereqs = (skill.prerequisites || [])
      .filter(pid =>
        this.skillMap[pid] &&
        !this.masteredSkills.has(pid) &&
        !this.blockedSkills.has(pid) &&
        !this.prerequisiteStack.includes(pid),
      );
    if (unmasteredPrereqs.length > 0) {
      this.prerequisiteStack.unshift(...unmasteredPrereqs);
      const nextId = this._popStack();
      return { nextId, phase:'DFS_PUSH', reason:`Стек пополнен: [${this.prerequisiteStack.join(',')}]. Спуск → [${nextId}] (${this.skillMap[nextId]?.grade} класс).` };
    }

    // 2. Стек не пуст
    if (this.prerequisiteStack.length > 0) {
      const nextId = this._popStack();
      return { nextId, phase:'DFS_POP', reason:`Нет пререквизитов. Стек → [${nextId}] (${this.skillMap[nextId]?.grade} класс).` };
    }

    // 3. Авто-спуск на класс ниже в текущей вертикали (БАГ 3 ФИХ: ищем в skill.vertical, не в activeVertical)
    const lowerGradeId = this._lowerGradeSkillInVertical(skill.vertical, skill.grade);
    if (lowerGradeId) {
      return { nextId:lowerGradeId, phase:'GRADE_DOWN', reason:`Авто-спуск → [${lowerGradeId}] (${this.skillMap[lowerGradeId].grade} класс, ${skill.vertical}).` };
    }

    // 4. Дно вертикали. Если DFS увёл нас в чужую вертикаль — возвращаемся к activeVertical
    if (skill.vertical !== this.activeVertical) {
      const returnId = this._nextActiveInVertical(this.activeVertical);
      if (returnId) {
        return { nextId:returnId, phase:'RETURN_TO_VERTICAL', reason:`DFS завершён в ${skill.vertical}. Возврат к активной вертикали ${this.activeVertical} → [${returnId}] (${this.skillMap[returnId].grade} класс).` };
      }
    }

    // 5. Дно всей ветки — меняем вертикаль
    this._switchVertical();
    return { nextId:this.currentSkillId, phase:'VERTICAL_SWITCH', reason:`Дно достигнуто в вертикали ${skill.vertical}. Смена → ${this.activeVertical}.` };
  }

  /** Ближайший навык НИЖЕ классом в той же вертикали (фоллбэк при отсутствии явных пререквизитов). */
  _lowerGradeSkillInVertical(verticalId, currentGrade) {
    return Object.values(this.skillMap)
      .filter(s =>
        s.vertical === verticalId &&
        s.grade < currentGrade &&
        s.status === 'ACTIVE' &&
        !this.masteredSkills.has(s.id) &&
        !this.blockedSkills.has(s.id) && // БАГ 1 ФИХ
        this._hasAvail(s.id)
      )
      .sort((a, b) => b.grade - a.grade)[0]?.id || null;
  }

  /** Переключаем вертикаль, очищаем DFS-стек, обновляем activeVertical. */
  _switchVertical() {
    this.prerequisiteStack = [];
    for (let i = 1; i <= this.verticalOrder.length; i++) {
      this.verticalIdx = (this.verticalIdx + 1) % this.verticalOrder.length;
      const sid = this._entrySkill(this.verticalOrder[this.verticalIdx]);
      if (sid) {
        this.currentSkillId = sid;
        this.activeVertical = this.verticalOrder[this.verticalIdx]; // БАГ 3 ФИХ
        return;
      }
    }
    this.currentSkillId = null;
  }

  /** Берёт первый элемент из стека, пропуская освоенные и заблокированные навыки. */
  _popStack() {
    while (this.prerequisiteStack.length > 0) {
      const sid = this.prerequisiteStack.shift();
      // БАГ 1 ФИХ: пропускаем blockedSkills — нет смысла возвращаться к провалу
      if (!this.masteredSkills.has(sid) && !this.blockedSkills.has(sid) && this.skillMap[sid] && this._hasAvail(sid)) return sid;
    }
    return null;
  }

  _hasAvail(skillId) {
    const s = this.skillMap[skillId];
    if (!s) return false;
    return s.tasks.some(t => {
      const tid = t.task_id || `${s.id}_${(t.question_text||'').slice(0,20)}`;
      return !this.answeredIds.has(tid);
    });
  }

  _countAvail(skillId) {
    const s = this.skillMap[skillId];
    if (!s) return 0;
    return s.tasks.filter(t => {
      const tid = t.task_id || `${s.id}_${(t.question_text||'').slice(0,20)}`;
      return !this.answeredIds.has(tid);
    }).length;
  }

  /** Берём задачу из currentSkill; при неудаче — fallback по стеку и топ-этажу. */
  _pickWithFallback() {
    let task = this._pickFromSkill(this.currentSkillId);
    if (task) return task;

    // Стек пресеквизитов (появляется ТОЛЬКО при BLOCKED) — проверяем первыми
    for (const sid of this.prerequisiteStack) {
      if (this._hasAvail(sid)) {
        task = this._pickFromSkill(sid);
        if (task) { this.currentSkillId = sid; return task; }
      }
    }

    // Глобальный fallback — ТОЛЬКО topGrade ACTIVE навыки по всем вертикалям.
    // MASTERED/BLOCKED/EXHAUSTED навыки не трогаем: их пресеквизиты попадают в стек
    // только через BLOCKED-ветку, и давать их задачи здесь неверно.
    // Когда все топ-этажи освоены — возвращаем null → ALL_DONE немедленно.
    for (const vertId of this.verticalOrder) {
      const nextId = this._nextActiveInVertical(vertId);
      if (nextId) {
        task = this._pickFromSkill(nextId);
        if (task) { this.activeVertical = vertId; this.currentSkillId = nextId; return task; }
      }
    }
    return null;
  }

  _pickFromSkill(skillId) {
    if (!skillId) return null;
    const s = this.skillMap[skillId];
    if (!s) return null;
    for (const task of s.tasks) {
      const tid = task.task_id || `${s.id}_${(task.question_text||'').slice(0,20)}`;
      if (!this.answeredIds.has(tid)) return this._map(task, s.doc, s.vertical);
    }
    return null;
  }

  // ── Debug Logger (disabled in production) ─────────────────────────────────
  _log() {}

  _map(task, skillDoc, verticalId) {
    const sid  = skillDoc.skill_id || skillDoc.id;
    const tid  = task.task_id || `${sid}_${(task.question_text||'').slice(0,20)}`;
    const rawType = task.type || 'mcq';
    const hasSubQ = Array.isArray(task.subQuestions) && task.subQuestions.length > 0;
    const type = (rawType==='compound' && !hasSubQ) ? 'mcq' : rawType;
    return {
      id: tid, text: task.question_text||task.text||'',
      options: task.options||[], correct: task.correct_index??task.correct??0,
      type, topic: skillDoc.skill_id||skillDoc.id,
      section: skillDoc.grade ? `${skillDoc.grade} класс` : '',
      sectionName: 'Умная Диагностика', difficulty: task.difficulty||'B',
      skillId: sid, verticalId, skillNames: task.skills_tested||[], latex: true,
    };
  }
}

// ── ROADMAP GENERATION ────────────────────────────────────────────────────────

/** "11 класс" | "Grade 9" | 11 | "9" → число */
export function parseGrade(raw) {
  if (!raw) return 0;
  const m = String(raw).match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

/**
 * Агрегирует сырой массив ответов умной диагностики в структурированную
 * Дорожную карту обучения "снизу вверх".
 *
 * @param {Array} allAnswers — ответы из DiagnosticEngine (поля: skillId/topic, section/_grade, correct, verticalId)
 * @returns {{ status, generated_at, total_gap_skills, roadmap[] }}
 */
export function generateRoadmap(allAnswers, targetGrade = 11) {
  // ── 1. Агрегация по навыкам ────────────────────────────────────────────────
  const skillStats = {};
  for (const ans of allAnswers) {
    const sid      = ans.skillId || ans.topic;
    // Приоритет _grade (фактический класс вопроса) над section (может быть "Умная Диагностика")
    const grade    = parseGrade(ans._grade || ans.section);
    const vertical = ans.verticalId || '—';
    if (!sid || grade === 0) continue;

    if (!skillStats[sid]) {
      skillStats[sid] = { id: sid, grade, vertical, asked: 0, correct: 0 };
    } else if (grade > skillStats[sid].grade) {
      // Use the highest grade seen for this skill to place it in the correct roadmap level
      skillStats[sid].grade = grade;
      if (vertical !== '—') skillStats[sid].vertical = vertical;
    }
    skillStats[sid].asked++;
    if (ans.correct) skillStats[sid].correct++;
  }

  // ── 2. Пробелы: accuracy < 50% ────────────────────────────────────────────
  const failedSkills = Object.values(skillStats).filter(
    s => s.asked > 0 && s.correct / s.asked < 0.5,
  );

  // ── 3. Сортировка: от фундамента к вершине ────────────────────────────────
  failedSkills.sort((a, b) => a.grade - b.grade || a.vertical.localeCompare(b.vertical));

  // ── 4. Группировка в уровни ───────────────────────────────────────────────
  const LEVEL_DEFS = [
    { gradeMin: 5,  gradeMax: 6,  title: 'Фундамент',       sub: '5–6 класс'   },
    { gradeMin: 7,  gradeMax: 8,  title: 'Базовая алгебра', sub: '7–8 класс'   },
    { gradeMin: 9,  gradeMax: 10, title: 'Средняя ступень', sub: '9–10 класс'  },
    { gradeMin: 11, gradeMax: 12, title: 'Целевой уровень', sub: `${targetGrade} класс` },
  ];

  const rawSteps = [];
  for (const def of LEVEL_DEFS) {
    const skills = failedSkills.filter(s => s.grade >= def.gradeMin && s.grade <= def.gradeMax);
    if (!skills.length) continue;

    // Группируем внутри уровня по вертикали для читаемости
    const byVertical = {};
    for (const s of skills) {
      (byVertical[s.vertical] = byVertical[s.vertical] || []).push({
        id:       s.id,
        grade:    s.grade,
        passRate: Math.round(s.correct / s.asked * 100),
      });
    }

    rawSteps.push({
      gradeRange:   `${def.gradeMin}–${def.gradeMax}`,
      title:        `${def.title} (${def.sub})`,
      skills_count: skills.length,
      skills_list:  skills.map(s => s.id),
      by_vertical:  byVertical,
      is_active:    false,
      is_locked:    true,
    });
  }

  // ── 5. Edge case: идеальный ученик (нет провалов) ───────────────────────
  // Создаём план из навыков 11 класса, которые он успешно прошёл
  if (rawSteps.length === 0) {
    const topSkills = Object.values(skillStats)
      .filter(s => s.grade >= Math.max(targetGrade - 1, 5)) // навыки у целевого класса
      .sort((a, b) => a.vertical.localeCompare(b.vertical));
    const byVertical = {};
    for (const s of topSkills) {
      (byVertical[s.vertical] = byVertical[s.vertical] || []).push(
        { id: s.id, grade: s.grade, passRate: Math.round(s.correct / s.asked * 100) }
      );
    }
    return {
      status: 'DIAGNOSTIC_COMPLETED',
      generated_at: new Date().toISOString(),
      total_gap_skills: 0,
      isPerfectStudent: true,
      roadmap: [{
        step: 1, gradeRange: `${targetGrade}–${targetGrade}`,
        title: `Целевой уровень (${targetGrade} класс)`,
        skills_count: topSkills.length,
        skills_list:  topSkills.map(s => s.id),
        by_vertical:  byVertical,
        isUnlocked: true, status: 'ACTIVE', is_active: true, is_locked: false,
        startedAt: new Date().toISOString(), completedAt: null,
      }],
    };
  }

  // ── 6. Нумерация + геймификационные статусы ───────────────────────────────
  const roadmap = rawSteps.map((step, idx) => ({
    ...step,
    step:         idx + 1,
    isUnlocked:   idx === 0,
    status:       idx === 0 ? 'ACTIVE' : 'LOCKED',
    is_active:    idx === 0,
    is_locked:    idx > 0,
    startedAt:    idx === 0 ? new Date().toISOString() : null,
    completedAt:  null,
  }));

  return {
    status:           'DIAGNOSTIC_COMPLETED',
    generated_at:     new Date().toISOString(),
    total_gap_skills: failedSkills.length,
    roadmap,
  };
}

// ── DIAGNOSTIC SIMULATOR SERVICE ─────────────────────────────────────────────
/**
 * Безголовый прогон всего цикла диагностики (in-memory, без записи в Firestore).
 *
 * @param {Object[]} taskBankEntries — массив документов из taskBank (уже загружен в state).
 * @param {string}   targetGrade    — целевой класс ученика ("11 класс" | "9 класс" | 11 | …).
 * @param {string}   strategy       — паттерн ответов:
 *                                    ALWAYS_CORRECT | ALWAYS_WRONG | RANDOM |
 *                                    WRONG_ON_TARGET (ошибается на целевом, верно ниже) |
 *                                    CORRECT_ON_TARGET (верно на целевом, ошибается ниже)
 * @param {number}   maxSteps       — предохранитель от бесконечного цикла (по умолч. 300).
 * @returns {{totalSteps, totalSections, sectionBreaks, logs, roadmapData, finalStats} | {error}}
 */
export function runDiagnosticSimulation({ taskBankEntries, targetGrade, strategy, maxSteps = 300 }) {
  const tg  = parseGrade(targetGrade) || 11;
  // Фильтруем так же, как SmartDiagRunner: только навыки класса ≤ целевому.
  // Без этого _pickWithFallback подхватывает навыки 7–11 классов даже для 6-классника.
  const docs = taskBankEntries.filter(e =>
    Array.isArray(e.tasks) && e.tasks.length > 0 &&
    (Number(e.grade) || 0) <= tg,
  );
  if (!docs.length) return { error: `TaskBank пуст для класса ≤${tg} — нет данных для симуляции. Добавьте задачи в CDM → TaskBank для нужного класса.` };

  // ── Стратегии ответов ────────────────────────────────────────────────────────
  const applyStrategy = (strat, skill) => {
    const g = skill?.grade || 0;
    switch (strat) {
      case 'ALWAYS_CORRECT':    return true;
      case 'ALWAYS_WRONG':      return false;
      case 'WRONG_ON_TARGET':   return g < tg;   // верно ниже класса, неверно на целевом
      case 'CORRECT_ON_TARGET': return g >= tg;  // верно на целевом, неверно ниже
      case 'RANDOM':
      default:                  return Math.random() > 0.5;
    }
  };

  const engine  = new DiagnosticEngine(docs, tg);
  const logs    = [];
  const allAnswers = [];
  const sectionBreaks = []; // индексы шагов, где завершился раздел

  let step       = 0;
  let sectionNum = 1;
  let task       = engine.start();

  while (task && step < maxSteps) {
    step++;
    const skillId  = task.skillId || task.topic;
    const skill    = engine.skillMap[skillId];
    const isCorrect = applyStrategy(strategy, skill);

    const { task: nextTask, debug } = engine.submitAnswer(task.id, isCorrect);

    logs.push({
      step,
      section: sectionNum,
      taskId:       task.id,
      skillId:      skillId || '?',
      skillGrade:   skill?.grade || 0,
      vertical:     (skill?.vertical || '—').slice(0, 25),
      isCorrect,
      stackSize:    engine.prerequisiteStack.length,
      phase:        debug?.phase       || '—',
      skillStatus:  skill?.status      || '—',
      masteredCount: engine.masteredSkills.size,
      blockedCount:  engine.blockedSkills.size,
      sessionStatus: debug?.sessionStatus || 'CONTINUE',
    });

    allAnswers.push({
      skillId, topic: skillId,
      section:    `${skill?.grade || tg} класс`,
      _grade:     skill?.grade || tg,
      verticalId: skill?.vertical,
      correct:    isCorrect,
      isSmartDiag: true,
    });

    const sessionEnd = !nextTask ||
      debug?.sessionStatus === 'PAUSE_SESSION' ||
      debug?.sessionStatus === 'SECTION_DONE'  ||
      debug?.sessionStatus === 'ALL_DONE';

    if (sessionEnd) {
      sectionBreaks.push(step);
      if (debug?.sessionStatus === 'ALL_DONE') break;
      const newTask = engine.startNewSection();
      if (!newTask || step >= maxSteps) break;
      sectionNum++;
      task = newTask;
    } else {
      task = nextTask;
    }
  }

  // Финальные статусы всех навыков для визуализации дерева
  const testedIds = new Set(logs.map(l => l.skillId));
  const skillStatuses = Object.fromEntries(
    Object.entries(engine.skillMap).map(([sid, s]) => {
      let displayStatus;
      if (s.status === 'MASTERED')  displayStatus = 'MASTERED';
      else if (s.status === 'BLOCKED' || engine.blockedSkills.has(sid)) displayStatus = 'BLOCKED';
      else if (testedIds.has(sid))  displayStatus = 'ACTIVE';
      else                          displayStatus = 'LOCKED';
      return [sid, {
        id:            sid,
        grade:         s.grade,
        vertical:      s.vertical,
        prerequisites: s.prerequisites || [],
        status:        displayStatus,
      }];
    })
  );

  return {
    totalSteps:    step,
    totalSections: sectionNum,
    sectionBreaks,
    logs,
    skillStatuses,
    roadmapData:   generateRoadmap(allAnswers, tg),
    finalStats: {
      mastered:      engine.masteredSkills.size,
      blocked:       engine.blockedSkills.size,
      totalSkills:   Object.keys(engine.skillMap).length,
      taskBankSize:  docs.length,
    },
  };
}

// ── ROADMAP SCREEN ────────────────────────────────────────────────────────────
export const VERTICAL_LABELS = {
  ALGEBRA:        'Алгебра',
  GEOMETRY:       'Геометрия',
  WORD_PROBLEMS:  'Текстовые задачи',
  STATISTICS:     'Статистика и вероятность',
  FUNCTIONS:      'Функции',
  EQUATIONS:      'Уравнения и неравенства',
  TRIGONOMETRY:   'Тригонометрия',
  COMBINATORICS:  'Комбинаторика и теория вероятностей',
  SEQUENCES:      'Последовательности',
  DERIVATIVES:    'Производные и интегралы',
};
