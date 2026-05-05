/**
 * AAPA Math — DiagnosticEngine v2.0
 * ====================================
 * Архитектурно чистая реализация: интерфейсы, класс с явными
 * методами calculateNextStep / generateReport, три симуляции.
 *
 * Запуск: npx ts-node diagnostic-engine-v2.ts
 */

// ═══════════════════════════════════════════════════════════════════════════════
//  SECTION 1 — INTERFACES & TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type VerticalLineId   = 'ARITHMETIC' | 'ALGEBRA' | 'GEOMETRY' | 'WORD_PROBLEMS';
export type SessionStatus    = 'PREPARATION' | 'GAP_CLOSER';
export type LineFinishReason = 'MASTERED' | 'CEILING_HIT' | 'BOTTOM_REACHED';
export type TerminationCause = 'ALL_LINES_COMPLETE' | 'HARD_CAP' | 'BOTTOM_REACHED';

// ─── Граф навыков ─────────────────────────────────────────────────────────────

export interface SkillNode {
  readonly skill_id:            string;
  readonly skill_name:          string;
  readonly grade:               number;           // 5–9
  readonly vertical_line_id:    VerticalLineId;
  readonly downstream_skill_id: string | null;    // на класс ниже
  readonly upstream_skill_id:   string | null;    // на класс выше
  readonly impacted_skills?:    readonly string[];
  readonly cluster_name?:       string;
}

// ─── Банк задач ───────────────────────────────────────────────────────────────

export interface SubQuestion {
  readonly id:             string;
  readonly question_text:  string;
  readonly correct_answer: string;
}

export interface Task {
  readonly task_id:             string;
  readonly skill_id:            string;
  readonly vertical_line_id:    VerticalLineId;
  readonly grade:               number;
  readonly type:                'mcq' | 'compound';
  readonly question_text:       string;
  readonly options?:            readonly string[];
  readonly correct_index?:      number;
  readonly sub_questions?:      readonly SubQuestion[];
  readonly compound_threshold?: number;
  readonly explanation:         string;
  readonly skills_tested:       readonly string[];
}

// ─── Внутреннее состояние линии ───────────────────────────────────────────────

export interface LineState {
  current_skill_id: string;
  grade_start:      number;          // исходный класс в этой линии
  grade_current:    number;          // текущий класс
  drop_depth:       number;          // PREPARATION: кол-во спусков от grade_start
  ceiling_grade:    number | null;   // GAP_CLOSER: последний верный класс
  is_closed:        boolean;
  finish_reason?:   LineFinishReason;
}

// ─── Запись ответа ────────────────────────────────────────────────────────────

export interface AnswerRecord {
  readonly task_id:          string;
  readonly skill_id:         string;
  readonly vertical_line_id: VerticalLineId;
  readonly grade:            number;
  readonly is_correct:       boolean;
  readonly timestamp:        string;
}

// ─── DiagnosticSession (основная модель данных) ───────────────────────────────

export interface DiagnosticSession {
  readonly session_id:     string;
  readonly student_id:     string;
  readonly status:         SessionStatus;
  readonly target_grade:   number;
  readonly created_at:     string;

  /** Линии, которые ещё тестируются (уменьшается по мере закрытия) */
  active_verticals:        VerticalLineId[];

  /** Текущий skill_id для каждой линии */
  current_nodes:           Record<string, string>;

  results: {
    answers:     AnswerRecord[];
    line_states: Record<string, LineState>;
  };

  questions_asked:         number;
  hard_cap:                number;
  is_complete:             boolean;
  systemic_gap_activated:  boolean;
  systemic_gap_grade:      number | null;
}

// ─── Результат шага ───────────────────────────────────────────────────────────

export interface StepResult {
  action:              'CONTINUE' | 'LINE_CLOSED' | 'SESSION_COMPLETE';
  line_id:             VerticalLineId;
  direction?:          'UP' | 'DOWN' | 'STAY';
  new_skill_id?:       string;
  new_grade?:          number;
  systemic_gap_fired?: boolean;
  termination_reason?: string;
}

// ─── Следующая задача ─────────────────────────────────────────────────────────

export interface NextTaskResult {
  task:        Task;
  skill:       SkillNode;
  line_id:     VerticalLineId;
  question_no: number;
}

// ─── Финальный отчёт ──────────────────────────────────────────────────────────

export interface LineReport {
  vertical_line_id:  VerticalLineId;
  grade_achieved:    number;
  status:            LineFinishReason | 'INCOMPLETE';
  grade_start:       number;
  questions_in_line: number;
  note:              string;
}

export interface DiagnosticReport {
  session_id:         string;
  student_id:         string;
  mode:               SessionStatus;
  target_grade:       number;
  total_questions:    number;
  is_systemic_gap:    boolean;
  systemic_gap_grade: number | null;
  lines:              LineReport[];
  overall_grade:      number;
  recommended_plan:   Array<{
    line:        VerticalLineId;
    from_grade:  number;
    to_grade:    number;
    skills:      string[];
  }>;
  terminated_by: TerminationCause;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SECTION 2 — DiagnosticEngine CLASS
// ═══════════════════════════════════════════════════════════════════════════════

const ALL_LINES: VerticalLineId[] = ['ARITHMETIC', 'ALGEBRA', 'GEOMETRY', 'WORD_PROBLEMS'];

export class DiagnosticEngine {
  private readonly session: DiagnosticSession;
  private readonly graph:   Map<string, SkillNode>;            // skill_id → node
  private readonly byLine:  Map<VerticalLineId, SkillNode[]>;  // sorted asc by grade
  private readonly tasks:   Map<string, Task[]>;               // skill_id → tasks
  private lineIdx = 0;                                         // round-robin pointer

  // ── CONSTRUCTOR ────────────────────────────────────────────────────────────

  constructor(
    config: {
      student_id:   string;
      status:       SessionStatus;
      target_grade: number;
      hard_cap?:    number;
    },
    skillGraph: SkillNode[],
    taskBank:   Task[],
  ) {
    // Build fast lookup structures
    this.graph  = new Map(skillGraph.map(n => [n.skill_id, n]));
    this.byLine = new Map();
    this.tasks  = new Map();

    for (const node of skillGraph) {
      const arr = this.byLine.get(node.vertical_line_id) ?? [];
      this.byLine.set(node.vertical_line_id, [...arr, node]);
    }
    for (const [vl, arr] of this.byLine) {
      this.byLine.set(vl, arr.slice().sort((a, b) => a.grade - b.grade));
    }
    for (const t of taskBank) {
      const arr = this.tasks.get(t.skill_id) ?? [];
      this.tasks.set(t.skill_id, [...arr, t]);
    }

    // Initialize per-line state
    const current_nodes: Record<string, string> = {};
    const line_states:   Record<string, LineState> = {};

    for (const vl of ALL_LINES) {
      const startGrade =
        config.status === 'GAP_CLOSER'
          ? (this.byLine.get(vl)?.[0]?.grade ?? config.target_grade)
          : config.target_grade;

      const startSkill = this._skillForGrade(vl, startGrade)
                      ?? this.byLine.get(vl)?.[0];
      if (!startSkill) continue;

      current_nodes[vl] = startSkill.skill_id;
      line_states[vl] = {
        current_skill_id: startSkill.skill_id,
        grade_start:      startGrade,
        grade_current:    startGrade,
        drop_depth:       0,
        ceiling_grade:    null,
        is_closed:        false,
      };
    }

    this.session = {
      session_id:            uid(),
      student_id:            config.student_id,
      status:                config.status,
      target_grade:          config.target_grade,
      created_at:            new Date().toISOString(),
      active_verticals:      ALL_LINES.filter(vl => line_states[vl] !== undefined),
      current_nodes,
      results:               { answers: [], line_states },
      questions_asked:       0,
      hard_cap:              config.hard_cap ?? 20,
      is_complete:           false,
      systemic_gap_activated: false,
      systemic_gap_grade:    null,
    };
  }

  // ── PUBLIC: READ-ONLY SESSION SNAPSHOT ─────────────────────────────────────

  getSession(): Readonly<DiagnosticSession> { return this.session; }

  // ── PUBLIC: GET NEXT TASK ──────────────────────────────────────────────────
  /**
   * Возвращает следующую задачу для показа ученику.
   * null → сессия завершена.
   */
  getNextTask(): NextTaskResult | null {
    if (this.session.is_complete) return null;

    // Hard-cap check
    if (this.session.questions_asked >= this.session.hard_cap) {
      this._terminate('HARD_CAP');
      return null;
    }

    const lineId = this._nextActiveLine();
    if (!lineId) {
      this._terminate('ALL_LINES_COMPLETE');
      return null;
    }

    const skillId = this.session.current_nodes[lineId];
    const skill   = this.graph.get(skillId);
    if (!skill) throw new Error(`SkillNode not found: ${skillId}`);

    return {
      task:        this._pickTask(skillId),
      skill,
      line_id:     lineId,
      question_no: this.session.questions_asked + 1,
    };
  }

  // ── PUBLIC: CALCULATE NEXT STEP ────────────────────────────────────────────
  /**
   * Принять ответ ученика и вычислить следующий шаг.
   * @param lastAnswer  true = верно, false = неверно
   * @param lineId      вертикальная линия, на которой был дан ответ
   */
  calculateNextStep(lastAnswer: boolean, lineId: VerticalLineId): StepResult {
    const state = this.session.results.line_states[lineId];
    const skill = this.graph.get(state.current_skill_id)!;

    // Persist answer
    this.session.results.answers.push({
      task_id:          `task_${state.current_skill_id}`,
      skill_id:         state.current_skill_id,
      vertical_line_id: lineId,
      grade:            skill.grade,
      is_correct:       lastAnswer,
      timestamp:        new Date().toISOString(),
    });
    this.session.questions_asked++;

    // Advance round-robin
    this.lineIdx++;

    // Dispatch to mode-specific handler
    let result: StepResult =
      this.session.status === 'PREPARATION'
        ? this._stepPreparation(lastAnswer, lineId, state, skill)
        : this._stepGapCloser(lastAnswer, lineId, state, skill);

    // Cross-Line Synchronization check
    if (this._checkSystemicGap()) {
      result = { ...result, systemic_gap_fired: true };
    }

    // Global termination checks
    if (!this.session.is_complete) {
      if (this.session.questions_asked >= this.session.hard_cap) {
        this._terminate('HARD_CAP');
        result = { ...result, action: 'SESSION_COMPLETE', termination_reason: 'HARD_CAP' };
      } else if (this.session.active_verticals.length === 0) {
        this._terminate('ALL_LINES_COMPLETE');
        result = { ...result, action: 'SESSION_COMPLETE', termination_reason: 'ALL_LINES_COMPLETE' };
      }
    }

    return result;
  }

  // ── PUBLIC: GENERATE REPORT ────────────────────────────────────────────────

  generateReport(): DiagnosticReport {
    const lines:  LineReport[]                         = [];
    const plan:   DiagnosticReport['recommended_plan'] = [];
    let   gradeSum = 0, gradeCount = 0;

    for (const vl of ALL_LINES) {
      const state       = this.session.results.line_states[vl];
      if (!state) continue;

      const answersHere = this.session.results.answers.filter(a => a.vertical_line_id === vl);
      const achieved    = this._gradeAchieved(vl, state);

      lines.push({
        vertical_line_id:  vl,
        grade_achieved:    achieved,
        status:            state.finish_reason ?? 'INCOMPLETE',
        grade_start:       state.grade_start,
        questions_in_line: answersHere.length,
        note:              this._lineNote(state, achieved),
      });

      gradeSum += achieved;
      gradeCount++;

      // Build learning plan for gaps
      if (achieved < this.session.target_grade) {
        const missingSkills: string[] = [];
        for (let g = achieved + 1; g <= this.session.target_grade; g++) {
          const sk = this._skillForGrade(vl, g);
          if (sk) missingSkills.push(sk.skill_name);
        }
        if (missingSkills.length) {
          plan.push({ line: vl, from_grade: achieved + 1, to_grade: this.session.target_grade, skills: missingSkills });
        }
      }
    }

    const terminatedBy: TerminationCause =
      this.session.questions_asked >= this.session.hard_cap
        ? 'HARD_CAP'
        : this.session.results.answers.some(a => {
            const s = this.session.results.line_states[a.vertical_line_id];
            return s?.finish_reason === 'BOTTOM_REACHED';
          })
        ? 'BOTTOM_REACHED'
        : 'ALL_LINES_COMPLETE';

    return {
      session_id:         this.session.session_id,
      student_id:         this.session.student_id,
      mode:               this.session.status,
      target_grade:       this.session.target_grade,
      total_questions:    this.session.questions_asked,
      is_systemic_gap:    this.session.systemic_gap_activated,
      systemic_gap_grade: this.session.systemic_gap_grade,
      lines,
      overall_grade:      gradeCount ? Math.round(gradeSum / gradeCount) : 0,
      recommended_plan:   plan,
      terminated_by:      terminatedBy,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  PRIVATE — STEP HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  private _stepPreparation(
    correct: boolean,
    lineId:  VerticalLineId,
    state:   LineState,
    skill:   SkillNode,
  ): StepResult {
    if (correct) {
      // Целевой класс освоен → линия MASTERED
      if (skill.grade >= state.grade_start) {
        return this._closeLine(lineId, state, 'MASTERED', 'STAY', skill.grade);
      }
      // Восстановились от пробела — поднимаемся к target
      if (skill.upstream_skill_id) {
        const up = this.graph.get(skill.upstream_skill_id)!;
        this._moveLine(lineId, state, skill.upstream_skill_id, up.grade);
        return { action: 'CONTINUE', line_id: lineId, direction: 'UP', new_skill_id: skill.upstream_skill_id, new_grade: up.grade };
      }
      return this._closeLine(lineId, state, 'MASTERED', 'STAY', skill.grade);

    } else {
      // Ошибка — спуск вниз (drill-down)
      if (!skill.downstream_skill_id) {
        // Достигли дна (5 класс) — ошибка на фундаменте
        return this._closeLine(lineId, state, 'BOTTOM_REACHED', 'STAY', skill.grade - 1);
      }
      const down = this.graph.get(skill.downstream_skill_id)!;
      this._moveLine(lineId, state, skill.downstream_skill_id, down.grade);
      state.drop_depth++;
      return { action: 'CONTINUE', line_id: lineId, direction: 'DOWN', new_skill_id: skill.downstream_skill_id, new_grade: down.grade };
    }
  }

  private _stepGapCloser(
    correct: boolean,
    lineId:  VerticalLineId,
    state:   LineState,
    skill:   SkillNode,
  ): StepResult {
    if (correct) {
      state.ceiling_grade = skill.grade;     // фиксируем последний верный
      if (!skill.upstream_skill_id) {
        // Достигли потолка графа → MASTERED
        return this._closeLine(lineId, state, 'MASTERED', 'UP', skill.grade);
      }
      const up = this.graph.get(skill.upstream_skill_id)!;
      this._moveLine(lineId, state, skill.upstream_skill_id, up.grade);
      return { action: 'CONTINUE', line_id: lineId, direction: 'UP', new_skill_id: skill.upstream_skill_id, new_grade: up.grade };

    } else {
      // Ошибка → ветка закрыта, потолок = последний верный
      if (state.ceiling_grade === null) state.ceiling_grade = skill.grade - 1;
      return this._closeLine(lineId, state, 'CEILING_HIT', 'STAY', state.ceiling_grade);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  PRIVATE — CROSS-LINE SYNCHRONIZATION (Systemic Gap)
  // ═══════════════════════════════════════════════════════════════════════════

  private _checkSystemicGap(): boolean {
    if (this.session.systemic_gap_activated) return false;

    let triggers = 0;
    let lowest   = Infinity;

    for (const vl of ALL_LINES) {
      const s = this.session.results.line_states[vl];
      if (!s) continue;

      if (this.session.status === 'PREPARATION') {
        if (s.drop_depth >= 2) {
          triggers++;
          lowest = Math.min(lowest, s.grade_current);
        }
      } else {
        // GAP_CLOSER: линия закрыта с потолком на 2+ класса ниже target
        if (s.is_closed && s.finish_reason === 'CEILING_HIT') {
          const ceil = s.ceiling_grade ?? (s.grade_start - 1);
          if (this.session.target_grade - ceil >= 2) {
            triggers++;
            lowest = Math.min(lowest, ceil);
          }
        }
      }
    }

    if (triggers < 2 || !isFinite(lowest)) return false;

    // ── Активация ──
    this.session.systemic_gap_activated = true;
    this.session.systemic_gap_grade     = lowest;

    // Понизить стартовый класс для всех ещё активных линий
    for (const vl of this.session.active_verticals) {
      const s        = this.session.results.line_states[vl];
      const newSkill = this._skillForGrade(vl, lowest);
      if (newSkill && newSkill.grade < s.grade_current) {
        this._moveLine(vl, s, newSkill.skill_id, newSkill.grade);
      }
    }
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  PRIVATE — TASK PICKER
  // ═══════════════════════════════════════════════════════════════════════════

  private _pickTask(skillId: string): Task {
    const pool = this.tasks.get(skillId);
    if (pool?.length) {
      return pool[Math.floor(Math.random() * pool.length)];
    }
    // Fallback stub (используется пока TaskBank не заполнен)
    const skill = this.graph.get(skillId)!;
    return {
      task_id:          `stub_${skillId}_${Date.now()}`,
      skill_id:         skillId,
      vertical_line_id: skill.vertical_line_id,
      grade:            skill.grade,
      type:             'mcq',
      question_text:    `[${skill.vertical_line_id} | ${skill.grade} кл] Задача: «${skill.skill_name}»`,
      options:          ['Вариант A', 'Вариант B', 'Вариант C', 'Вариант D'],
      correct_index:    0,
      explanation:      `Проверяет навык: ${skill.skill_name}`,
      skills_tested:    skill.impacted_skills ? [...skill.impacted_skills] : [skill.skill_name],
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  PRIVATE — HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private _nextActiveLine(): VerticalLineId | null {
    const av = this.session.active_verticals;
    if (!av.length) return null;
    return av[this.lineIdx % av.length];
  }

  private _skillForGrade(vl: VerticalLineId, grade: number): SkillNode | undefined {
    return this.byLine.get(vl)?.find(n => n.grade === grade);
  }

  private _moveLine(vl: VerticalLineId, state: LineState, skillId: string, grade: number): void {
    state.current_skill_id          = skillId;
    state.grade_current             = grade;
    this.session.current_nodes[vl]  = skillId;
  }

  private _closeLine(
    lineId:  VerticalLineId,
    state:   LineState,
    reason:  LineFinishReason,
    dir:     'UP' | 'DOWN' | 'STAY',
    grade:   number,
  ): StepResult {
    state.is_closed     = true;
    state.finish_reason = reason;
    this.session.active_verticals =
      this.session.active_verticals.filter(v => v !== lineId);

    return {
      action:            this.session.active_verticals.length === 0 ? 'SESSION_COMPLETE' : 'LINE_CLOSED',
      line_id:           lineId,
      direction:         dir,
      new_grade:         grade,
      termination_reason: reason,
    };
  }

  private _terminate(reason: TerminationCause): void {
    this.session.is_complete = true;
  }

  private _gradeAchieved(vl: VerticalLineId, state: LineState): number {
    if (this.session.status === 'PREPARATION') {
      return state.finish_reason === 'MASTERED'
        ? state.grade_start
        : state.grade_current;
    }
    return state.ceiling_grade ?? (state.grade_start - 1);
  }

  private _lineNote(state: LineState, achieved: number): string {
    switch (state.finish_reason) {
      case 'MASTERED':       return `✅ Класс ${this.session.target_grade} освоен`;
      case 'CEILING_HIT':    return `🔴 Потолок знаний: ${achieved} класс`;
      case 'BOTTOM_REACHED': return `⛔ Пробел до фундамента (5 кл)`;
      default:               return `⏸ Не завершено`;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SECTION 3 — MOCK DATA
// ═══════════════════════════════════════════════════════════════════════════════

function uid(): string { return Math.random().toString(36).slice(2, 10); }

export const SKILL_GRAPH: SkillNode[] = [
  // ARITHMETIC 5→9
  { skill_id:'ARITH_5', skill_name:'Дроби и пропорции',             grade:5, vertical_line_id:'ARITHMETIC',    downstream_skill_id:null,        upstream_skill_id:'ARITH_6',  impacted_skills:['Сокращение дробей','Нахождение пропорции'] },
  { skill_id:'ARITH_6', skill_name:'Проценты и отношения',           grade:6, vertical_line_id:'ARITHMETIC',    downstream_skill_id:'ARITH_5',   upstream_skill_id:'ARITH_7',  impacted_skills:['Перевод % в дробь','Нахождение % от числа'] },
  { skill_id:'ARITH_7', skill_name:'Степени и корни (базовые)',      grade:7, vertical_line_id:'ARITHMETIC',    downstream_skill_id:'ARITH_6',   upstream_skill_id:'ARITH_8',  impacted_skills:['Степень с натуральным показателем','Квадратный корень'] },
  { skill_id:'ARITH_8', skill_name:'Степени и корни (расширенные)', grade:8, vertical_line_id:'ARITHMETIC',    downstream_skill_id:'ARITH_7',   upstream_skill_id:'ARITH_9',  impacted_skills:['Степень с рациональным показателем','Свойства корней'] },
  { skill_id:'ARITH_9', skill_name:'Логарифмы и прогрессии',         grade:9, vertical_line_id:'ARITHMETIC',    downstream_skill_id:'ARITH_8',   upstream_skill_id:null,        impacted_skills:['Арифметическая прогрессия','Геометрическая прогрессия'] },
  // ALGEBRA 5→9
  { skill_id:'ALGE_5',  skill_name:'Буквенные выражения',            grade:5, vertical_line_id:'ALGEBRA',       downstream_skill_id:null,        upstream_skill_id:'ALGE_6',   impacted_skills:['Подстановка значений','Раскрытие скобок'] },
  { skill_id:'ALGE_6',  skill_name:'Линейные уравнения',             grade:6, vertical_line_id:'ALGEBRA',       downstream_skill_id:'ALGE_5',    upstream_skill_id:'ALGE_7',   impacted_skills:['Перенос слагаемых','Деление на коэффициент'] },
  { skill_id:'ALGE_7',  skill_name:'Системы линейных уравнений',     grade:7, vertical_line_id:'ALGEBRA',       downstream_skill_id:'ALGE_6',    upstream_skill_id:'ALGE_8',   impacted_skills:['Метод подстановки','Метод сложения'] },
  { skill_id:'ALGE_8',  skill_name:'Квадратные уравнения',           grade:8, vertical_line_id:'ALGEBRA',       downstream_skill_id:'ALGE_7',    upstream_skill_id:'ALGE_9',   impacted_skills:['Дискриминант','Формула корней','Теорема Виета'] },
  { skill_id:'ALGE_9',  skill_name:'Неравенства и функции',          grade:9, vertical_line_id:'ALGEBRA',       downstream_skill_id:'ALGE_8',    upstream_skill_id:null,        impacted_skills:['Квадратное неравенство','Парабола'] },
  // GEOMETRY 5→9
  { skill_id:'GEOM_5',  skill_name:'Периметр и площадь фигур',       grade:5, vertical_line_id:'GEOMETRY',      downstream_skill_id:null,        upstream_skill_id:'GEOM_6',   impacted_skills:['Площадь прямоугольника','Площадь треугольника'] },
  { skill_id:'GEOM_6',  skill_name:'Углы и параллельные прямые',     grade:6, vertical_line_id:'GEOMETRY',      downstream_skill_id:'GEOM_5',    upstream_skill_id:'GEOM_7',   impacted_skills:['Вертикальные углы','Накрест лежащие углы'] },
  { skill_id:'GEOM_7',  skill_name:'Подобие треугольников',          grade:7, vertical_line_id:'GEOMETRY',      downstream_skill_id:'GEOM_6',    upstream_skill_id:'GEOM_8',   impacted_skills:['Признаки подобия','Масштаб'] },
  { skill_id:'GEOM_8',  skill_name:'Теорема Пифагора и площади',     grade:8, vertical_line_id:'GEOMETRY',      downstream_skill_id:'GEOM_7',    upstream_skill_id:'GEOM_9',   impacted_skills:['Теорема Пифагора','Площадь трапеции'] },
  { skill_id:'GEOM_9',  skill_name:'Тригонометрия (sin/cos/tan)',    grade:9, vertical_line_id:'GEOMETRY',      downstream_skill_id:'GEOM_8',    upstream_skill_id:null,        impacted_skills:['sin/cos острого угла','Решение прямоугольного треугольника'] },
  // WORD_PROBLEMS 5→9
  { skill_id:'WORD_5',  skill_name:'Простые текстовые задачи',       grade:5, vertical_line_id:'WORD_PROBLEMS', downstream_skill_id:null,        upstream_skill_id:'WORD_6',   impacted_skills:['Задачи на части','Совместная работа'] },
  { skill_id:'WORD_6',  skill_name:'Задачи на проценты',             grade:6, vertical_line_id:'WORD_PROBLEMS', downstream_skill_id:'WORD_5',    upstream_skill_id:'WORD_7',   impacted_skills:['Скидка и наценка','Концентрация раствора'] },
  { skill_id:'WORD_7',  skill_name:'Задачи на движение',             grade:7, vertical_line_id:'WORD_PROBLEMS', downstream_skill_id:'WORD_6',    upstream_skill_id:'WORD_8',   impacted_skills:['Встречное движение','Движение по течению'] },
  { skill_id:'WORD_8',  skill_name:'Задачи на смеси и сплавы',       grade:8, vertical_line_id:'WORD_PROBLEMS', downstream_skill_id:'WORD_7',    upstream_skill_id:'WORD_9',   impacted_skills:['Система уравнений для смесей','Правило смешения'] },
  { skill_id:'WORD_9',  skill_name:'Составные задачи с уравнениями', grade:9, vertical_line_id:'WORD_PROBLEMS', downstream_skill_id:'WORD_8',    upstream_skill_id:null,        impacted_skills:['Составление уравнения по условию','Проверка ОДЗ'] },
];

// Минимальный TaskBank: 1 задача на skill_id
export const TASK_BANK: Task[] = SKILL_GRAPH.map(s => ({
  task_id:          `task_${s.skill_id}`,
  skill_id:         s.skill_id,
  vertical_line_id: s.vertical_line_id,
  grade:            s.grade,
  type:             'mcq' as const,
  question_text:    `[${s.vertical_line_id} | ${s.grade} кл] Задача по теме: «${s.skill_name}»`,
  options:          ['Вариант A', 'Вариант B', 'Вариант C', 'Вариант D'],
  correct_index:    0,
  explanation:      `Правильный ответ требует применения: ${(s.impacted_skills ?? []).join(', ')}`,
  skills_tested:    s.impacted_skills ? [...s.impacted_skills] : [s.skill_name],
}));

// ═══════════════════════════════════════════════════════════════════════════════
//  SECTION 4 — SIMULATIONS
// ═══════════════════════════════════════════════════════════════════════════════

const HR  = '═'.repeat(72);
const DIV = '─'.repeat(72);

function runSimulation(
  title:       string,
  studentId:   string,
  status:      SessionStatus,
  targetGrade: number,
  /** Returns is_correct given the skill being tested */
  answerFn:    (skill: SkillNode) => boolean,
): void {
  console.log(`\n${HR}`);
  console.log(`  ${title}`);
  console.log(HR);

  const engine = new DiagnosticEngine(
    { student_id: studentId, status, target_grade: targetGrade, hard_cap: 20 },
    SKILL_GRAPH,
    TASK_BANK,
  );

  let step = 0;
  while (true) {
    const next = engine.getNextTask();
    if (!next) break;

    const { task, skill, line_id, question_no } = next;
    const correct = answerFn(skill);

    console.log(`  Q${String(question_no).padStart(2,'0')} [${line_id.padEnd(14)}] ${skill.grade}кл — «${skill.skill_name}»`);
    console.log(`       ${correct ? '✅ Верно' : '❌ Ошибка'}`);

    const result = engine.calculateNextStep(correct, line_id);

    if (result.systemic_gap_fired) {
      const s = engine.getSession();
      console.log(`\n  ⚠️  ══ SYSTEMIC GAP ACTIVATED ══ Уровень понижен до ${s.systemic_gap_grade} кл для оставшихся линий\n`);
    }

    if (result.action === 'LINE_CLOSED' || result.action === 'SESSION_COMPLETE') {
      const s = engine.getSession();
      const st = s.results.line_states[line_id];
      console.log(`       → Линия закрыта: ${result.termination_reason} (итог: ${st.grade_current} кл)`);
    }

    if (result.action === 'SESSION_COMPLETE') break;
    if (++step > 40) break; // safety guard
  }

  const report = engine.generateReport();
  printReport(report);
}

function printReport(r: DiagnosticReport): void {
  console.log(`\n  ${DIV}`);
  console.log(`  📊 ОТЧЁТ  |  Режим: ${r.mode}  |  Задач: ${r.total_questions}  |  Завершено: ${r.terminated_by}`);
  console.log(`  Системный пробел: ${r.is_systemic_gap ? `⚠️ ДА (класс ${r.systemic_gap_grade})` : 'нет'}`);
  console.log(`  ${DIV}`);

  for (const l of r.lines) {
    const icon = l.status === 'MASTERED' ? '✅' : l.status === 'CEILING_HIT' ? '🔴' : l.status === 'BOTTOM_REACHED' ? '⛔' : '⏸';
    console.log(`  ${icon} ${l.vertical_line_id.padEnd(14)} | достигнут ${l.grade_achieved} кл | вопросов: ${l.questions_in_line} | ${l.note}`);
  }

  console.log(`\n  Средний уровень: ${r.overall_grade} класс`);

  if (r.recommended_plan.length) {
    console.log(`\n  📋 ПЛАН ОБУЧЕНИЯ:`);
    for (const p of r.recommended_plan) {
      console.log(`     ${p.line}: ${p.from_grade}→${p.to_grade} кл — ${p.skills.join(', ')}`);
    }
  }
}

// ── SIM 1: Сильный ученик (PREPARATION, 8 класс) ─────────────────────────────
runSimulation(
  'SIM 1 — Сильный ученик | PREPARATION | Цель: 8 класс',
  'student_strong',
  'PREPARATION',
  8,
  (_skill) => true,  // всегда верно → 4 линии за 4 вопроса
);

// ── SIM 2: Слабый ученик (GAP_CLOSER, потолок 6 класс) ───────────────────────
runSimulation(
  'SIM 2 — Слабый ученик | GAP_CLOSER | Цель: 9 класс',
  'student_weak',
  'GAP_CLOSER',
  9,
  (skill) => skill.grade <= 6,  // верно только 5–6 кл, на 7 кл — потолок
);

// ── SIM 3: Системный пробел (PREPARATION, пробелы в ARITH + ALGE) ────────────
runSimulation(
  'SIM 3 — Системный пробел | PREPARATION | Цель: 8 класс',
  'student_gap',
  'PREPARATION',
  8,
  (skill) => {
    // ARITH и ALGE: ошибки пока grade > 6 → drop_depth ≥ 2 в двух линиях
    if ((skill.vertical_line_id === 'ARITHMETIC' || skill.vertical_line_id === 'ALGEBRA') && skill.grade > 6) return false;
    return true;
  },
);

console.log(`\n${HR}`);
console.log('  ✅ Все симуляции завершены.');
console.log(`${HR}\n`);
