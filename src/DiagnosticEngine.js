/**
 * DiagnosticEngine — браузерный JS-порт движка v2.
 * Без зависимостей, работает в React.
 */

const ALL_LINES = ['ARITHMETIC', 'ALGEBRA', 'GEOMETRY', 'WORD_PROBLEMS'];

function uid() { return Math.random().toString(36).slice(2, 9); }

// ─── Mock Skill Graph ─────────────────────────────────────────────────────────

export const MOCK_SKILL_GRAPH = [
  // ARITHMETIC
  { skill_id:'ARITH_5', skill_name:'Дроби и пропорции',            grade:5, vertical_line_id:'ARITHMETIC',    downstream_skill_id:null,       upstream_skill_id:'ARITH_6', impacted_skills:['Сокращение дробей','Нахождение пропорции'] },
  { skill_id:'ARITH_6', skill_name:'Проценты и отношения',          grade:6, vertical_line_id:'ARITHMETIC',    downstream_skill_id:'ARITH_5',  upstream_skill_id:'ARITH_7', impacted_skills:['Перевод % в дробь','Нахождение % от числа'] },
  { skill_id:'ARITH_7', skill_name:'Степени и корни (базовые)',     grade:7, vertical_line_id:'ARITHMETIC',    downstream_skill_id:'ARITH_6',  upstream_skill_id:'ARITH_8', impacted_skills:['Натуральный показатель','Квадратный корень'] },
  { skill_id:'ARITH_8', skill_name:'Степени и корни (расш.)',       grade:8, vertical_line_id:'ARITHMETIC',    downstream_skill_id:'ARITH_7',  upstream_skill_id:'ARITH_9', impacted_skills:['Рациональный показатель','Свойства корней'] },
  { skill_id:'ARITH_9', skill_name:'Логарифмы и прогрессии',        grade:9, vertical_line_id:'ARITHMETIC',    downstream_skill_id:'ARITH_8',  upstream_skill_id:null,      impacted_skills:['Арифм. прогрессия','Геом. прогрессия'] },
  // ALGEBRA
  { skill_id:'ALGE_5',  skill_name:'Буквенные выражения',           grade:5, vertical_line_id:'ALGEBRA',       downstream_skill_id:null,       upstream_skill_id:'ALGE_6',  impacted_skills:['Подстановка значений','Раскрытие скобок'] },
  { skill_id:'ALGE_6',  skill_name:'Линейные уравнения',            grade:6, vertical_line_id:'ALGEBRA',       downstream_skill_id:'ALGE_5',   upstream_skill_id:'ALGE_7',  impacted_skills:['Перенос слагаемых','Деление на коэффициент'] },
  { skill_id:'ALGE_7',  skill_name:'Системы уравнений',             grade:7, vertical_line_id:'ALGEBRA',       downstream_skill_id:'ALGE_6',   upstream_skill_id:'ALGE_8',  impacted_skills:['Метод подстановки','Метод сложения'] },
  { skill_id:'ALGE_8',  skill_name:'Квадратные уравнения',          grade:8, vertical_line_id:'ALGEBRA',       downstream_skill_id:'ALGE_7',   upstream_skill_id:'ALGE_9',  impacted_skills:['Дискриминант','Формула корней','Теорема Виета'] },
  { skill_id:'ALGE_9',  skill_name:'Неравенства и функции',         grade:9, vertical_line_id:'ALGEBRA',       downstream_skill_id:'ALGE_8',   upstream_skill_id:null,      impacted_skills:['Квадратное неравенство','Парабола'] },
  // GEOMETRY
  { skill_id:'GEOM_5',  skill_name:'Периметр и площадь фигур',      grade:5, vertical_line_id:'GEOMETRY',      downstream_skill_id:null,       upstream_skill_id:'GEOM_6',  impacted_skills:['Площадь прямоугольника','Площадь треугольника'] },
  { skill_id:'GEOM_6',  skill_name:'Углы и параллельные прямые',    grade:6, vertical_line_id:'GEOMETRY',      downstream_skill_id:'GEOM_5',   upstream_skill_id:'GEOM_7',  impacted_skills:['Вертикальные углы','Накрест лежащие углы'] },
  { skill_id:'GEOM_7',  skill_name:'Подобие треугольников',         grade:7, vertical_line_id:'GEOMETRY',      downstream_skill_id:'GEOM_6',   upstream_skill_id:'GEOM_8',  impacted_skills:['Признаки подобия','Масштаб'] },
  { skill_id:'GEOM_8',  skill_name:'Теорема Пифагора и площади',    grade:8, vertical_line_id:'GEOMETRY',      downstream_skill_id:'GEOM_7',   upstream_skill_id:'GEOM_9',  impacted_skills:['Теорема Пифагора','Площадь трапеции'] },
  { skill_id:'GEOM_9',  skill_name:'Тригонометрия (sin/cos/tan)',   grade:9, vertical_line_id:'GEOMETRY',      downstream_skill_id:'GEOM_8',   upstream_skill_id:null,      impacted_skills:['sin/cos угла','Прямоугольный треугольник'] },
  // WORD_PROBLEMS
  { skill_id:'WORD_5',  skill_name:'Простые текстовые задачи',      grade:5, vertical_line_id:'WORD_PROBLEMS', downstream_skill_id:null,       upstream_skill_id:'WORD_6',  impacted_skills:['Задачи на части','Совместная работа'] },
  { skill_id:'WORD_6',  skill_name:'Задачи на проценты',            grade:6, vertical_line_id:'WORD_PROBLEMS', downstream_skill_id:'WORD_5',   upstream_skill_id:'WORD_7',  impacted_skills:['Скидка и наценка','Концентрация раствора'] },
  { skill_id:'WORD_7',  skill_name:'Задачи на движение',            grade:7, vertical_line_id:'WORD_PROBLEMS', downstream_skill_id:'WORD_6',   upstream_skill_id:'WORD_8',  impacted_skills:['Встречное движение','Движение по течению'] },
  { skill_id:'WORD_8',  skill_name:'Задачи на смеси и сплавы',      grade:8, vertical_line_id:'WORD_PROBLEMS', downstream_skill_id:'WORD_7',   upstream_skill_id:'WORD_9',  impacted_skills:['Система уравнений для смесей','Правило смешения'] },
  { skill_id:'WORD_9',  skill_name:'Составные задачи с уравн.',     grade:9, vertical_line_id:'WORD_PROBLEMS', downstream_skill_id:'WORD_8',   upstream_skill_id:null,      impacted_skills:['Составление уравнения по условию','Проверка ОДЗ'] },
];

// ─── Engine Class ─────────────────────────────────────────────────────────────

export class DiagnosticEngine {
  constructor({ studentId, status, targetGrade, hardCap = 20 }, skillGraph) {
    this._graph  = new Map(skillGraph.map(n => [n.skill_id, n]));
    this._byLine = new Map();
    for (const n of skillGraph) {
      const arr = this._byLine.get(n.vertical_line_id) || [];
      this._byLine.set(n.vertical_line_id, [...arr, n]);
    }
    for (const [vl, arr] of this._byLine) {
      this._byLine.set(vl, arr.slice().sort((a, b) => a.grade - b.grade));
    }

    this._lineIdx = 0;

    const currentNodes = {};
    const lineStates   = {};

    for (const vl of ALL_LINES) {
      const startGrade = status === 'GAP_CLOSER'
        ? (this._byLine.get(vl)?.[0]?.grade ?? targetGrade)
        : targetGrade;
      const startSkill = this._skillForGrade(vl, startGrade) || this._byLine.get(vl)?.[0];
      if (!startSkill) continue;
      currentNodes[vl] = startSkill.skill_id;
      lineStates[vl]   = {
        current_skill_id: startSkill.skill_id,
        grade_start:      startGrade,
        grade_current:    startGrade,
        drop_depth:       0,
        ceiling_grade:    null,
        is_closed:        false,
        finish_reason:    null,
      };
    }

    this.session = {
      session_id:             uid(),
      student_id:             studentId,
      status,
      target_grade:           targetGrade,
      active_verticals:       ALL_LINES.filter(vl => lineStates[vl]),
      current_nodes:          currentNodes,
      results:                { answers: [], line_states: lineStates },
      questions_asked:        0,
      hard_cap:               hardCap,
      is_complete:            false,
      systemic_gap_activated: false,
      systemic_gap_grade:     null,
    };
  }

  // ── Public ────────────────────────────────────────────────────────────────

  getNextTask() {
    if (this.session.is_complete) return null;
    if (this.session.questions_asked >= this.session.hard_cap) {
      this.session.is_complete = true; return null;
    }
    const lineId = this._nextActiveLine();
    if (!lineId) { this.session.is_complete = true; return null; }

    const skillId = this.session.current_nodes[lineId];
    const skill   = this._graph.get(skillId);
    return { skill, lineId, questionNo: this.session.questions_asked + 1 };
  }

  /** Returns { action, lineId, direction, newSkill, systemicGapFired } */
  calculateNextStep(correct, lineId) {
    const state = this.session.results.line_states[lineId];
    const skill = this._graph.get(state.current_skill_id);

    this.session.results.answers.push({
      skill_id: state.current_skill_id,
      vertical_line_id: lineId,
      grade: skill.grade,
      is_correct: correct,
      timestamp: new Date().toISOString(),
    });
    this.session.questions_asked++;
    this._lineIdx++;

    let result;
    if (this.session.status === 'PREPARATION') {
      result = this._stepPrep(correct, lineId, state, skill);
    } else {
      result = this._stepGap(correct, lineId, state, skill);
    }

    const gapFired = this._checkSystemicGap();
    if (gapFired) result.systemicGapFired = true;

    // Termination
    if (!this.session.is_complete) {
      if (this.session.questions_asked >= this.session.hard_cap) {
        this.session.is_complete = true;
        result.action = 'SESSION_COMPLETE'; result.terminationReason = 'HARD_CAP';
      } else if (this.session.active_verticals.length === 0) {
        this.session.is_complete = true;
        result.action = 'SESSION_COMPLETE'; result.terminationReason = 'ALL_DONE';
      }
    }
    return result;
  }

  generateReport() {
    const lines = [];
    const plan  = [];
    let gradeSum = 0, cnt = 0;

    for (const vl of ALL_LINES) {
      const s = this.session.results.line_states[vl];
      if (!s) continue;
      const achieved = this._gradeAchieved(vl, s);
      const answersHere = this.session.results.answers.filter(a => a.vertical_line_id === vl);
      lines.push({ vl, achieved, status: s.finish_reason || 'INCOMPLETE', gradeStart: s.grade_start, qCount: answersHere.length });
      gradeSum += achieved; cnt++;
      if (achieved < this.session.target_grade) {
        const skills = [];
        for (let g = achieved + 1; g <= this.session.target_grade; g++) {
          const sk = this._skillForGrade(vl, g);
          if (sk) skills.push(sk.skill_name);
        }
        if (skills.length) plan.push({ vl, fromGrade: achieved + 1, toGrade: this.session.target_grade, skills });
      }
    }
    return {
      sessionId:       this.session.session_id,
      mode:            this.session.status,
      targetGrade:     this.session.target_grade,
      totalQuestions:  this.session.questions_asked,
      isSystemicGap:   this.session.systemic_gap_activated,
      systemicGapGrade: this.session.systemic_gap_grade,
      lines,
      overallGrade:    cnt ? Math.round(gradeSum / cnt) : 0,
      plan,
      terminatedBy:    this.session.questions_asked >= this.session.hard_cap ? 'HARD_CAP' : 'ALL_DONE',
    };
  }

  // ── Private: step handlers ────────────────────────────────────────────────

  _stepPrep(correct, lineId, state, skill) {
    if (correct) {
      if (skill.grade >= state.grade_start) return this._closeLine(lineId, state, 'MASTERED', 'STAY', skill.grade);
      if (skill.upstream_skill_id) {
        const up = this._graph.get(skill.upstream_skill_id);
        this._move(lineId, state, skill.upstream_skill_id, up.grade);
        return { action:'CONTINUE', lineId, direction:'UP', newSkill: up };
      }
      return this._closeLine(lineId, state, 'MASTERED', 'STAY', skill.grade);
    } else {
      if (!skill.downstream_skill_id) return this._closeLine(lineId, state, 'BOTTOM_REACHED', 'STAY', skill.grade - 1);
      const down = this._graph.get(skill.downstream_skill_id);
      this._move(lineId, state, skill.downstream_skill_id, down.grade);
      state.drop_depth++;
      return { action:'CONTINUE', lineId, direction:'DOWN', newSkill: down };
    }
  }

  _stepGap(correct, lineId, state, skill) {
    if (correct) {
      state.ceiling_grade = skill.grade;
      if (!skill.upstream_skill_id) return this._closeLine(lineId, state, 'MASTERED', 'UP', skill.grade);
      const up = this._graph.get(skill.upstream_skill_id);
      this._move(lineId, state, skill.upstream_skill_id, up.grade);
      return { action:'CONTINUE', lineId, direction:'UP', newSkill: up };
    } else {
      if (state.ceiling_grade === null) state.ceiling_grade = skill.grade - 1;
      return this._closeLine(lineId, state, 'CEILING_HIT', 'STAY', state.ceiling_grade);
    }
  }

  _closeLine(lineId, state, reason, dir, grade) {
    state.is_closed     = true;
    state.finish_reason = reason;
    this.session.active_verticals = this.session.active_verticals.filter(v => v !== lineId);
    return {
      action:            this.session.active_verticals.length === 0 ? 'SESSION_COMPLETE' : 'LINE_CLOSED',
      lineId, direction: dir, newGrade: grade, terminationReason: reason,
    };
  }

  // ── Private: systemic gap ─────────────────────────────────────────────────

  _checkSystemicGap() {
    if (this.session.systemic_gap_activated) return false;
    let triggers = 0, lowest = Infinity;

    for (const vl of ALL_LINES) {
      const s = this.session.results.line_states[vl];
      if (!s) continue;
      if (this.session.status === 'PREPARATION') {
        if (s.drop_depth >= 2) { triggers++; lowest = Math.min(lowest, s.grade_current); }
      } else {
        if (s.is_closed && s.finish_reason === 'CEILING_HIT') {
          const c = s.ceiling_grade ?? (s.grade_start - 1);
          if (this.session.target_grade - c >= 2) { triggers++; lowest = Math.min(lowest, c); }
        }
      }
    }

    if (triggers < 2 || !isFinite(lowest)) return false;
    this.session.systemic_gap_activated = true;
    this.session.systemic_gap_grade     = lowest;

    for (const vl of this.session.active_verticals) {
      const s = this.session.results.line_states[vl];
      const sk = this._skillForGrade(vl, lowest);
      if (sk && sk.grade < s.grade_current) this._move(vl, s, sk.skill_id, sk.grade);
    }
    return true;
  }

  // ── Private: helpers ──────────────────────────────────────────────────────

  _nextActiveLine() {
    const av = this.session.active_verticals;
    return av.length ? av[this._lineIdx % av.length] : null;
  }

  _skillForGrade(vl, grade) {
    return this._byLine.get(vl)?.find(n => n.grade === grade);
  }

  _move(vl, state, skillId, grade) {
    state.current_skill_id       = skillId;
    state.grade_current          = grade;
    this.session.current_nodes[vl] = skillId;
  }

  _gradeAchieved(vl, state) {
    if (this.session.status === 'PREPARATION')
      return state.finish_reason === 'MASTERED' ? state.grade_start : state.grade_current;
    return state.ceiling_grade ?? (state.grade_start - 1);
  }
}
