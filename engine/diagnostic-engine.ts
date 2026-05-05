/**
 * AAPA Math — Diagnostic Engine v1.0
 * ====================================
 * TypeScript ядро системы адаптивной диагностики знаний (5–9 класс).
 * Два режима: PREPARATION (Top-Down) и GAP_CLOSER (Bottom-Up).
 */

// ─── ТИПЫ ─────────────────────────────────────────────────────────────────────

export type VerticalLineId = 'ARITHMETIC' | 'ALGEBRA' | 'GEOMETRY' | 'WORD_PROBLEMS';
export type SessionMode    = 'PREPARATION' | 'GAP_CLOSER';
export type ModuleStatus   = 'ACTIVE' | 'MASTERED' | 'CEILING_HIT' | 'PENDING';

export interface SkillNode {
  skill_id:         string;
  skill_name:       string;
  grade:            number;          // 5–9
  vertical_line_id: VerticalLineId;
  downstream_id:    string | null;   // skill_id класс ниже (фундамент)
  upstream_id:      string | null;   // skill_id класс выше
}

export interface SubQuestion {
  id:             string;
  text:           string;
  correct_answer: string;
}

export interface Task {
  task_id:             string;
  skill_id:            string;
  type:                'single' | 'compound';
  text:                string;
  difficulty:          'A' | 'B' | 'C';
  sub_questions?:      SubQuestion[];
  compound_threshold?: number;   // минимум верных под-ответов для зачёта
}

export interface AnswerRecord {
  task_id:          string;
  skill_id:         string;
  vertical_line_id: VerticalLineId;
  grade:            number;
  is_correct:       boolean;
  timestamp:        Date;
}

interface ModuleState {
  vertical_line_id:  VerticalLineId;
  current_skill_id:  string;
  status:            ModuleStatus;
  grade_start:       number;   // исходный класс модуля
  grade_current:     number;   // текущий класс в модуле
  drop_count:        number;   // на сколько классов упали (PREPARATION)
  ceiling_grade?:    number;   // последний верный класс (GAP_CLOSER)
  oscillation_count: number;   // счётчик осцилляций (bounce без прогресса)
}

export interface SessionState {
  session_id:           string;
  student_id:           string;
  mode:                 SessionMode;
  target_grade:         number;
  tasks_answered:       number;
  hard_cap:             number;         // максимум задач (15–20)
  is_systemic_gap:      boolean;
  systemic_gap_grade:   number | null;  // класс пробела
  modules:              Map<VerticalLineId, ModuleState>;
  history:              AnswerRecord[];
  is_complete:          boolean;
  _module_round_robin:  number;         // индекс текущего модуля в ротации
}

export interface NextTaskResult {
  task:              Task;
  skill:             SkillNode;
  module_status_msg: string;
}

export interface DiagnosticResult {
  session_id:       string;
  mode:             SessionMode;
  tasks_answered:   number;
  is_systemic_gap:  boolean;
  finish_reason:    'HARD_CAP' | 'ALL_MODULES_DONE' | 'MANUAL_STOP';
  modules: {
    vertical_line_id: VerticalLineId;
    status:           ModuleStatus;
    grade_start:      number;
    grade_current:    number;
    ceiling_grade?:   number;
    mastered_up_to?:  number;
  }[];
  recommended_plan: string[];
}

// ─── MOCK DATA — Граф навыков (5–9 класс, 4 вертикальных линии) ──────────────

export const SKILL_GRAPH: SkillNode[] = [
  // ── ARITHMETIC ──────────────────────────────────────────────────
  { skill_id:'ARITH_5', skill_name:'Дроби и пропорции',              grade:5, vertical_line_id:'ARITHMETIC',    downstream_id:null,       upstream_id:'ARITH_6' },
  { skill_id:'ARITH_6', skill_name:'Проценты и отношения',            grade:6, vertical_line_id:'ARITHMETIC',    downstream_id:'ARITH_5',  upstream_id:'ARITH_7' },
  { skill_id:'ARITH_7', skill_name:'Степени и корни (базовые)',        grade:7, vertical_line_id:'ARITHMETIC',    downstream_id:'ARITH_6',  upstream_id:'ARITH_8' },
  { skill_id:'ARITH_8', skill_name:'Степени и корни (расширенные)',    grade:8, vertical_line_id:'ARITHMETIC',    downstream_id:'ARITH_7',  upstream_id:'ARITH_9' },
  { skill_id:'ARITH_9', skill_name:'Логарифмы и прогрессии',          grade:9, vertical_line_id:'ARITHMETIC',    downstream_id:'ARITH_8',  upstream_id:null      },
  // ── ALGEBRA ─────────────────────────────────────────────────────
  { skill_id:'ALGE_5',  skill_name:'Буквенные выражения',             grade:5, vertical_line_id:'ALGEBRA',       downstream_id:null,       upstream_id:'ALGE_6'  },
  { skill_id:'ALGE_6',  skill_name:'Линейные уравнения',              grade:6, vertical_line_id:'ALGEBRA',       downstream_id:'ALGE_5',   upstream_id:'ALGE_7'  },
  { skill_id:'ALGE_7',  skill_name:'Системы уравнений',               grade:7, vertical_line_id:'ALGEBRA',       downstream_id:'ALGE_6',   upstream_id:'ALGE_8'  },
  { skill_id:'ALGE_8',  skill_name:'Квадратные уравнения',            grade:8, vertical_line_id:'ALGEBRA',       downstream_id:'ALGE_7',   upstream_id:'ALGE_9'  },
  { skill_id:'ALGE_9',  skill_name:'Неравенства и функции',           grade:9, vertical_line_id:'ALGEBRA',       downstream_id:'ALGE_8',   upstream_id:null      },
  // ── GEOMETRY ────────────────────────────────────────────────────
  { skill_id:'GEOM_5',  skill_name:'Периметр и площадь фигур',        grade:5, vertical_line_id:'GEOMETRY',      downstream_id:null,       upstream_id:'GEOM_6'  },
  { skill_id:'GEOM_6',  skill_name:'Углы и параллельные прямые',      grade:6, vertical_line_id:'GEOMETRY',      downstream_id:'GEOM_5',   upstream_id:'GEOM_7'  },
  { skill_id:'GEOM_7',  skill_name:'Подобие треугольников',           grade:7, vertical_line_id:'GEOMETRY',      downstream_id:'GEOM_6',   upstream_id:'GEOM_8'  },
  { skill_id:'GEOM_8',  skill_name:'Теорема Пифагора и площади',      grade:8, vertical_line_id:'GEOMETRY',      downstream_id:'GEOM_7',   upstream_id:'GEOM_9'  },
  { skill_id:'GEOM_9',  skill_name:'Тригонометрия (sin/cos)',         grade:9, vertical_line_id:'GEOMETRY',      downstream_id:'GEOM_8',   upstream_id:null      },
  // ── WORD_PROBLEMS ────────────────────────────────────────────────
  { skill_id:'WORD_5',  skill_name:'Простые текстовые задачи',        grade:5, vertical_line_id:'WORD_PROBLEMS', downstream_id:null,       upstream_id:'WORD_6'  },
  { skill_id:'WORD_6',  skill_name:'Задачи на проценты',              grade:6, vertical_line_id:'WORD_PROBLEMS', downstream_id:'WORD_5',   upstream_id:'WORD_7'  },
  { skill_id:'WORD_7',  skill_name:'Задачи на движение',              grade:7, vertical_line_id:'WORD_PROBLEMS', downstream_id:'WORD_6',   upstream_id:'WORD_8'  },
  { skill_id:'WORD_8',  skill_name:'Задачи на смеси и сплавы',        grade:8, vertical_line_id:'WORD_PROBLEMS', downstream_id:'WORD_7',   upstream_id:'WORD_9'  },
  { skill_id:'WORD_9',  skill_name:'Составные задачи с уравнениями',  grade:9, vertical_line_id:'WORD_PROBLEMS', downstream_id:'WORD_8',   upstream_id:null      },
];

/** Минимальный банк задач: 1 задача на каждый skill_id. */
export const TASK_BANK: Task[] = [
  ...SKILL_GRAPH.map(s => ({
    task_id:    `task_${s.skill_id}_A`,
    skill_id:   s.skill_id,
    type:       'single' as const,
    text:       `[${s.vertical_line_id} | ${s.grade} кл] Задача по теме: «${s.skill_name}»`,
    difficulty: 'A' as const,
  })),
  // Compound-задача для 8 кл. ALGEBRA
  {
    task_id:             'task_ALGE_8_compound',
    skill_id:            'ALGE_8',
    type:                'compound',
    text:                '[ALGEBRA | 8 кл] Составная задача: квадратные уравнения',
    difficulty:          'B',
    compound_threshold:  2,
    sub_questions: [
      { id:'q1', text:'Найдите корни: x²−5x+6=0',    correct_answer:'2;3'   },
      { id:'q2', text:'Найдите дискриминант: x²+x+1', correct_answer:'-3'   },
      { id:'q3', text:'Составьте уравнение по корням x=1, x=−2', correct_answer:'x²+x−2=0' },
    ],
  },
];

// ─── ВСПОМОГАТЕЛЬНЫЕ УТИЛИТЫ ──────────────────────────────────────────────────

const VERTICALS: VerticalLineId[] = ['ARITHMETIC', 'ALGEBRA', 'GEOMETRY', 'WORD_PROBLEMS'];

function getSkill(skill_id: string): SkillNode {
  const s = SKILL_GRAPH.find(n => n.skill_id === skill_id);
  if (!s) throw new Error(`SkillNode not found: ${skill_id}`);
  return s;
}

function getSkillForGrade(vertical: VerticalLineId, grade: number): SkillNode | undefined {
  return SKILL_GRAPH.find(n => n.vertical_line_id === vertical && n.grade === grade);
}

function getTask(skill_id: string): Task {
  const t = TASK_BANK.find(t => t.skill_id === skill_id);
  if (!t) throw new Error(`Task not found for skill: ${skill_id}`);
  return t;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

// ─── VERTICAL ENGINE ─────────────────────────────────────────────────────────
/**
 * Управляет навигацией внутри одного модуля (вертикальной линии).
 * Знает только о движении вверх/вниз и о смене статуса модуля.
 */
export class VerticalEngine {
  private skillMap: Map<string, SkillNode>;

  constructor(skills: SkillNode[]) {
    this.skillMap = new Map(skills.map(s => [s.skill_id, s]));
  }

  /**
   * PREPARATION: ответили верно → модуль освоен на этом уровне.
   * Возвращает новый skill_id (upstream) или null если достигли потолка.
   */
  onCorrect_Preparation(module: ModuleState): { next_skill_id: string | null; mastered: boolean } {
    const skill = this.skillMap.get(module.current_skill_id)!;
    // Текущий уровень освоен. Если это был целевой класс — модуль завершён.
    if (skill.grade >= module.grade_start) {
      return { next_skill_id: null, mastered: true };
    }
    // Освоили пробельный уровень, поднимаемся обратно к целевому
    return { next_skill_id: skill.upstream_id, mastered: false };
  }

  /**
   * PREPARATION: ошибка → спуск вниз (drill-down).
   * Возвращает downstream skill_id или null если уже на дне.
   */
  onWrong_Preparation(module: ModuleState): string | null {
    const skill = this.skillMap.get(module.current_skill_id)!;
    return skill.downstream_id;
  }

  /**
   * GAP_CLOSER: ответили верно → поднимаемся выше.
   * Возвращает upstream skill_id или null если достигли потолка графа.
   */
  onCorrect_GapCloser(module: ModuleState): string | null {
    const skill = this.skillMap.get(module.current_skill_id)!;
    return skill.upstream_id;
  }

  /**
   * GAP_CLOSER: ошибка → ветка закрыта, фиксируем потолок.
   */
  onWrong_GapCloser(module: ModuleState): void {
    // ceiling = предыдущий верный класс (grade_current до этого хода).
    // Вызывающий код сохраняет ceiling_grade сам.
  }
}

// ─── DIAGNOSTIC CONTROLLER ───────────────────────────────────────────────────
/**
 * Основная логика сессии: маршрутизация ответов, предохранители,
 * Systemic Gap Detector.
 */
export class DiagnosticController {
  private session:  SessionState;
  private engine:   VerticalEngine;
  private taskBank: Task[];
  private skillMap: Map<string, SkillNode>;

  constructor(session: SessionState, engine: VerticalEngine, taskBank: Task[], skills: SkillNode[]) {
    this.session  = session;
    this.engine   = engine;
    this.taskBank = taskBank;
    this.skillMap = new Map(skills.map(s => [s.skill_id, s]));
  }

  /** Возвращает следующую задачу или null (сессия завершена). */
  getNextTask(): NextTaskResult | null {
    if (this.session.is_complete) return null;

    // Safety: Hard Cap
    if (this.session.tasks_answered >= this.session.hard_cap) {
      this._finalize('HARD_CAP');
      return null;
    }

    // Найти первый ACTIVE модуль
    const activeModule = this._getActiveModule();
    if (!activeModule) {
      this._finalize('ALL_MODULES_DONE');
      return null;
    }

    const skill = this.skillMap.get(activeModule.current_skill_id)!;
    const task  = this._pickTask(skill.skill_id);
    const msg   = `[${activeModule.vertical_line_id}] кл.${skill.grade} — «${skill.skill_name}»`;

    return { task, skill, module_status_msg: msg };
  }

  /**
   * Принять ответ ученика.
   * @param task_id  ID задачи
   * @param is_correct  Для single-задач — прямой bool.
   *                    Для compound — передать массив sub_answers и порог.
   */
  submitAnswer(task_id: string, is_correct: boolean): void {
    if (this.session.is_complete) return;

    const task  = this.taskBank.find(t => t.task_id === task_id);
    if (!task) throw new Error(`Task not found: ${task_id}`);

    const skill  = this.skillMap.get(task.skill_id)!;
    const module = this.session.modules.get(skill.vertical_line_id)!;

    // Записать в историю
    this.session.history.push({
      task_id,
      skill_id:         skill.skill_id,
      vertical_line_id: skill.vertical_line_id,
      grade:            skill.grade,
      is_correct,
      timestamp:        new Date(),
    });
    this.session.tasks_answered++;

    if (this.session.mode === 'PREPARATION') {
      this._handlePreparation(module, skill, is_correct);
    } else {
      this._handleGapCloser(module, skill, is_correct);
    }

    // Systemic Gap Detector (после каждого ответа)
    this._checkSystemicGap();
  }

  getResult(): DiagnosticResult {
    const recommended: string[] = [];

    for (const [vl, mod] of this.session.modules) {
      if (this.session.mode === 'GAP_CLOSER' && mod.status === 'CEILING_HIT') {
        const ceiling = mod.ceiling_grade ?? mod.grade_current;
        for (let g = ceiling + 1; g <= this.session.target_grade; g++) {
          const skill = getSkillForGrade(vl, g);
          if (skill) recommended.push(`[${vl} | ${g} кл] ${skill.skill_name}`);
        }
      }
      if (this.session.mode === 'PREPARATION' && mod.drop_count >= 2) {
        for (let g = mod.grade_current; g < mod.grade_start; g++) {
          const skill = getSkillForGrade(vl, g);
          if (skill) recommended.push(`[${vl} | ${g} кл] Закрыть пробел: ${skill.skill_name}`);
        }
      }
    }

    return {
      session_id:      this.session.session_id,
      mode:            this.session.mode,
      tasks_answered:  this.session.tasks_answered,
      is_systemic_gap: this.session.is_systemic_gap,
      finish_reason:   this.session.is_complete
        ? (this.session.tasks_answered >= this.session.hard_cap ? 'HARD_CAP' : 'ALL_MODULES_DONE')
        : 'MANUAL_STOP',
      modules: [...this.session.modules.values()].map(m => ({
        vertical_line_id: m.vertical_line_id,
        status:           m.status,
        grade_start:      m.grade_start,
        grade_current:    m.grade_current,
        ceiling_grade:    m.ceiling_grade,
        mastered_up_to:   m.status === 'MASTERED' ? m.grade_current : undefined,
      })),
      recommended_plan: recommended,
    };
  }

  // ── ПРИВАТНЫЕ МЕТОДЫ ──────────────────────────────────────────────────────

  private _handlePreparation(module: ModuleState, skill: SkillNode, correct: boolean): void {
    if (correct) {
      module.oscillation_count = 0;  // сбросить счётчик при прогрессе
      const { next_skill_id, mastered } = this.engine.onCorrect_Preparation(module);
      if (mastered || next_skill_id === null) {
        module.status = 'MASTERED';
      } else {
        module.current_skill_id = next_skill_id;
        module.grade_current    = getSkill(next_skill_id).grade;
      }
    } else {
      const downstream_id = this.engine.onWrong_Preparation(module);
      if (downstream_id === null) {
        module.status = 'CEILING_HIT';
      } else {
        module.current_skill_id = downstream_id;
        module.grade_current    = getSkill(downstream_id).grade;
        module.drop_count++;
        module.oscillation_count++;
        // Oscillation guard: если 3 раза подряд не можем выйти выше — фиксируем потолок
        if (module.oscillation_count >= 3) {
          module.status = 'CEILING_HIT';
          module.ceiling_grade = module.grade_current;
        }
      }
    }
    // После каждого ответа переключаемся на следующий модуль (round-robin)
    this.session._module_round_robin =
      (this.session._module_round_robin + 1) % VERTICALS.length;
  }

  private _handleGapCloser(module: ModuleState, skill: SkillNode, correct: boolean): void {
    if (correct) {
      module.ceiling_grade = skill.grade;
      const upstream_id = this.engine.onCorrect_GapCloser(module);
      if (upstream_id === null) {
        module.status = 'MASTERED';
      } else {
        module.current_skill_id = upstream_id;
        module.grade_current    = getSkill(upstream_id).grade;
      }
    } else {
      module.status = 'CEILING_HIT';
      if (module.ceiling_grade === undefined) {
        module.ceiling_grade = skill.grade - 1;
      }
    }
    // Round-robin
    this.session._module_round_robin =
      (this.session._module_round_robin + 1) % VERTICALS.length;
  }

  private _checkSystemicGap(): void {
    if (this.session.is_systemic_gap) return;  // уже активировано

    // Считаем модули где drop_count >= 2 (PREPARATION) или ceiling < target-2 (GAP_CLOSER)
    let triggerCount = 0;
    let lowestGap    = Infinity;

    for (const [, mod] of this.session.modules) {
      if (this.session.mode === 'PREPARATION') {
        if (mod.drop_count >= 2) {
          triggerCount++;
          lowestGap = Math.min(lowestGap, mod.grade_current);
        }
      } else {
        const ceiling = mod.ceiling_grade ?? (mod.grade_current - 1);
        if (mod.status === 'CEILING_HIT' && (this.session.target_grade - ceiling) >= 2) {
          triggerCount++;
          lowestGap = Math.min(lowestGap, ceiling);
        }
      }
    }

    if (triggerCount >= 2) {
      this.session.is_systemic_gap    = true;
      this.session.systemic_gap_grade = isFinite(lowestGap) ? lowestGap : null;

      // Понизить стартовый класс для всех ACTIVE модулей
      if (this.session.systemic_gap_grade !== null) {
        for (const [vl, mod] of this.session.modules) {
          if (mod.status !== 'ACTIVE') continue;
          const newGrade  = this.session.systemic_gap_grade;
          const newSkill  = getSkillForGrade(vl, newGrade);
          if (newSkill && newSkill.grade < mod.grade_current) {
            mod.current_skill_id = newSkill.skill_id;
            mod.grade_current    = newGrade;
          }
        }
      }
    }
  }

  private _getActiveModule(): ModuleState | undefined {
    const offset = this.session._module_round_robin;
    // Начинаем поиск с текущей позиции round-robin (полный обход)
    for (let i = 0; i < VERTICALS.length; i++) {
      const vl  = VERTICALS[(offset + i) % VERTICALS.length];
      const mod = this.session.modules.get(vl);
      if (mod && mod.status === 'ACTIVE') return mod;
    }
    return undefined;
  }

  private _pickTask(skill_id: string): Task {
    const opts = this.taskBank.filter(t => t.skill_id === skill_id);
    if (!opts.length) throw new Error(`No tasks for skill: ${skill_id}`);
    return opts[Math.floor(Math.random() * opts.length)];
  }

  private _finalize(reason: string): void {
    this.session.is_complete = true;
    console.log(`\n  ⏹  Сессия завершена. Причина: ${reason}`);
  }
}

// ─── SESSION MANAGER ─────────────────────────────────────────────────────────
/**
 * Фабрика сессий. Инициализирует SessionState и DiagnosticController.
 */
export class SessionManager {
  private skills:   SkillNode[];
  private taskBank: Task[];

  constructor(skills: SkillNode[], taskBank: Task[]) {
    this.skills   = skills;
    this.taskBank = taskBank;
  }

  /**
   * Создать новую сессию.
   * @param student_id  ID ученика
   * @param mode        PREPARATION или GAP_CLOSER
   * @param target_grade  Целевой класс (5–9)
   * @param hard_cap    Лимит задач (default 16)
   */
  createSession(
    student_id:   string,
    mode:         SessionMode,
    target_grade: number,
    hard_cap:     number = 16,
  ): DiagnosticController {
    const modules = new Map<VerticalLineId, ModuleState>();

    for (const vl of VERTICALS) {
      let start_grade = target_grade;

      if (mode === 'GAP_CLOSER') {
        // Начинаем с минимального доступного класса в этой вертикали
        const bottom = this.skills.filter(s => s.vertical_line_id === vl).sort((a, b) => a.grade - b.grade)[0];
        start_grade  = bottom?.grade ?? target_grade;
      }

      const startSkill = getSkillForGrade(vl, start_grade);
      if (!startSkill) continue;

      modules.set(vl, {
        vertical_line_id:  vl,
        current_skill_id:  startSkill.skill_id,
        status:            'ACTIVE',
        grade_start:       start_grade,
        grade_current:     start_grade,
        drop_count:        0,
        oscillation_count: 0,
      });
    }

    const session: SessionState = {
      session_id:           uid(),
      student_id,
      mode,
      target_grade,
      tasks_answered:       0,
      hard_cap,
      is_systemic_gap:      false,
      systemic_gap_grade:   null,
      modules,
      history:              [],
      is_complete:          false,
      _module_round_robin:  0,
    };

    const engine = new VerticalEngine(this.skills);
    return new DiagnosticController(session, engine, this.taskBank, this.skills);
  }
}

// ─── УТИЛИТА: оценка compound-задачи ─────────────────────────────────────────

/**
 * Проверяет ответы на compound-задачу и возвращает is_correct.
 * @param task      Compound задача
 * @param answers   Map<sub_question_id, student_answer>
 */
export function evaluateCompound(task: Task, answers: Map<string, string>): boolean {
  if (task.type !== 'compound' || !task.sub_questions) return false;
  const threshold = task.compound_threshold ?? Math.ceil(task.sub_questions.length * 0.66);
  let correct = 0;
  for (const sq of task.sub_questions) {
    if ((answers.get(sq.id) ?? '').trim().toLowerCase() === sq.correct_answer.toLowerCase()) {
      correct++;
    }
  }
  return correct >= threshold;
}

// ─── СИМУЛЯЦИИ (Console Demo) ─────────────────────────────────────────────────

const SEP = '─'.repeat(70);

function printHeader(title: string): void {
  console.log(`\n${SEP}`);
  console.log(`  ${title}`);
  console.log(SEP);
}

function printResult(result: DiagnosticResult): void {
  console.log('\n  📊 ИТОГ СЕССИИ');
  console.log(`  Режим:          ${result.mode}`);
  console.log(`  Задач дано:     ${result.tasks_answered}`);
  console.log(`  Системный пробел: ${result.is_systemic_gap ? '⚠️  ДА' : 'нет'}`);
  console.log(`  Завершено по:   ${result.finish_reason}`);
  console.log('\n  Модули:');
  for (const m of result.modules) {
    const extra = m.ceiling_grade !== undefined ? ` | потолок: ${m.ceiling_grade} кл`
      : m.mastered_up_to !== undefined           ? ` | освоено до: ${m.mastered_up_to} кл`
      : '';
    const icon  = m.status === 'MASTERED' ? '✅' : m.status === 'CEILING_HIT' ? '🔴' : '🔵';
    console.log(`    ${icon} ${m.vertical_line_id.padEnd(14)} | старт: ${m.grade_start} кл | итог: ${m.grade_current} кл${extra}`);
  }
  if (result.recommended_plan.length) {
    console.log('\n  📋 ПЛАН ОБУЧЕНИЯ:');
    result.recommended_plan.forEach(p => console.log(`    • ${p}`));
  }
}

// ── Симуляция 1: СИЛЬНЫЙ УЧЕНИК — PREPARATION (8 класс) ──────────────────────

function sim_StrongStudent(): void {
  printHeader('СИМУЛЯЦИЯ 1: Сильный ученик | PREPARATION | 8 класс');
  console.log('  Сценарий: правильно на каждый вопрос → все 4 модуля осваивает за 4 задачи\n');

  const mgr  = new SessionManager(SKILL_GRAPH, TASK_BANK);
  const ctrl = mgr.createSession('student_001', 'PREPARATION', 8);

  for (let i = 0; i < 20; i++) {
    const next = ctrl.getNextTask();
    if (!next) break;
    const { task, module_status_msg } = next;
    console.log(`  ▶ Задача ${i + 1}: ${module_status_msg}`);
    console.log(`     Тип: ${task.type} | ID: ${task.task_id}`);
    ctrl.submitAnswer(task.task_id, true);   // всегда верно
    console.log(`     Ответ: ✅ Верно`);
  }

  printResult(ctrl.getResult());
}

// ── Симуляция 2: СЛАБЫЙ УЧЕНИК — GAP_CLOSER (потолок 7 класс) ────────────────

function sim_WeakStudent(): void {
  printHeader('СИМУЛЯЦИЯ 2: Слабый ученик | GAP_CLOSER | цель: 9 класс');
  console.log('  Сценарий: верно только 5 и 6 класс, на 7 классе — стоп\n');

  const mgr  = new SessionManager(SKILL_GRAPH, TASK_BANK);
  const ctrl = mgr.createSession('student_002', 'GAP_CLOSER', 9);

  // Логика симуляции: верно если grade <= 6, иначе неверно
  for (let i = 0; i < 20; i++) {
    const next = ctrl.getNextTask();
    if (!next) break;
    const { task, skill, module_status_msg } = next;
    const correct = skill.grade <= 6;
    console.log(`  ▶ Задача ${i + 1}: ${module_status_msg}`);
    console.log(`     Ответ: ${correct ? '✅ Верно' : '❌ Неверно'} → ${correct ? 'идём выше' : 'потолок зафиксирован'}`);
    ctrl.submitAnswer(task.task_id, correct);
  }

  printResult(ctrl.getResult());
}

// ── Симуляция 3: SYSTEMIC GAP DETECTOR ───────────────────────────────────────

function sim_SystemicGap(): void {
  printHeader('СИМУЛЯЦИЯ 3: Systemic Gap Detector | PREPARATION | 8 класс');
  console.log('  Сценарий: ошибки в ARITHMETIC и ALGEBRA на 8 кл → падение на 2+ класса → активация флага\n');

  const mgr  = new SessionManager(SKILL_GRAPH, TASK_BANK);
  const ctrl = mgr.createSession('student_003', 'PREPARATION', 8);

  // Правило: неверно пока grade > 6 в ARITHMETIC и ALGEBRA, верно в остальных
  for (let i = 0; i < 20; i++) {
    const next = ctrl.getNextTask();
    if (!next) break;
    const { task, skill, module_status_msg } = next;

    const forceWrong =
      (skill.vertical_line_id === 'ARITHMETIC' || skill.vertical_line_id === 'ALGEBRA') &&
      skill.grade > 6;
    const correct = !forceWrong;

    console.log(`  ▶ Задача ${i + 1}: ${module_status_msg}`);
    console.log(`     Ответ: ${correct ? '✅ Верно' : '❌ Неверно (пробел!)'}`);
    ctrl.submitAnswer(task.task_id, correct);

    // Показать флаг в момент активации
    const state = (ctrl as any).session as SessionState;
    if (state.is_systemic_gap && !((ctrl as any)._gapReported)) {
      (ctrl as any)._gapReported = true;
      console.log(`\n  ⚠️  SYSTEMIC GAP DETECTOR АКТИВИРОВАН!`);
      console.log(`     Обнаружено 2+ модуля с пробелом ≥2 классов.`);
      console.log(`     Стартовый уровень оставшихся модулей понижен до ${state.systemic_gap_grade} кл.\n`);
    }
  }

  printResult(ctrl.getResult());
}

// ── Симуляция 4: Compound Task ────────────────────────────────────────────────

function sim_CompoundTask(): void {
  printHeader('СИМУЛЯЦИЯ 4: Compound-задача (тестлет) — ALGEBRA 8 кл');
  console.log('  Порог: 2 из 3 верных под-ответов\n');

  const compoundTask = TASK_BANK.find(t => t.type === 'compound')!;
  console.log(`  Задача: ${compoundTask.text}`);
  compoundTask.sub_questions?.forEach((sq, i) => {
    console.log(`    Под-вопрос ${i + 1}: ${sq.text}`);
  });

  // Ученик отвечает на 2 из 3 верно
  const answers = new Map<string, string>([
    ['q1', '2;3'],     // верно
    ['q2', '-3'],      // верно
    ['q3', 'x²+x=0'],  // неверно
  ]);

  const result = evaluateCompound(compoundTask, answers);
  console.log(`\n  Ответы: [✅ 2;3] [✅ -3] [❌ x²+x=0]`);
  console.log(`  Итог: ${result ? '✅ Зачтено (2/3 ≥ порог 2)' : '❌ Не зачтено'}`);
}

// ─── ЗАПУСК ───────────────────────────────────────────────────────────────────

sim_StrongStudent();
sim_WeakStudent();
sim_SystemicGap();
sim_CompoundTask();

console.log(`\n${SEP}`);
console.log('  ✅ Все симуляции завершены.');
console.log(SEP + '\n');
