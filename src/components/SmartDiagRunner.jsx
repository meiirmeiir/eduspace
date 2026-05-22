import React, { useState, useEffect, useRef, useCallback } from "react";
import { collection, getDocs, db } from "../firestore-rest.js";
import { DiagnosticEngine } from "../lib/diagnosticUtils.js";
import { THEME } from "../lib/appConstants.js";
import { DiagnosticRulesScreen, QuestionScreen } from "../screens/DiagnosticsScreens.jsx";

const DIAG_PAUSE_KEY = 'aapa_diag_pause';

export default function SmartDiagRunner({ user, grade, onFinish, onStop, onSectionComplete, initialEngineState, initialSectionNum }) {
  const [phase, setPhase]         = useState('loading'); // loading | rules | question | transition | done_section | error
  const [curQ,  setCurQ]          = useState(null);
  const [qNum,  setQNum]          = useState(0);   // вопрос внутри текущего раздела
  const [sectionNum, setSectionNum] = useState(initialSectionNum || 1); // номер текущего раздела
  const [accumulated, setAccumulated] = useState([]); // ответы текущего раздела
  const [transitionInfo, setTransitionInfo] = useState(null); // {engineState, stackSize}
  const [isLastQuestion, setIsLastQuestion] = useState(false); // true когда текущий вопрос — последний в разделе
  const engineRef        = useRef(null);
  const finishedRef      = useRef(false);
  const allAnswersRef    = useRef([]);  // ответы всех разделов

  useEffect(() => {
    (async () => {
      try {
        const gradeNum = parseInt(grade);
        const snap = await getDocs(collection(db, 'taskBank'));
        const docs  = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(d => Number(d.grade) <= gradeNum);
        if (!docs.length) { setPhase('error'); return; }
        const engine = new DiagnosticEngine(docs, grade);
        engineRef.current = engine;

        // Проверяем — есть ли сохранённая пауза.
        // Восстанавливаем только если paused-данные совпадают по grade И sectionNum с тем,
        // что ожидает родитель (initialSectionNum). Если ученик прошёл следующий раздел
        // и потом нажал «Начать раздел N» — устаревший snapshot из предыдущей сессии не
        // должен подменять состояние и таскать прежний qNum (это и приводило к
        // «33 вопроса в разделе»).
        try {
          const pausedStr = localStorage.getItem(DIAG_PAUSE_KEY);
          if (pausedStr) {
            const paused = JSON.parse(pausedStr);
            const expectedSection = initialSectionNum || 1;
            const pausedSection   = paused.sectionNum || 1;
            if (paused.grade === grade && pausedSection === expectedSection) {
              engine.applyExportedState(paused.engineState);
              allAnswersRef.current = paused.allAnswers || [];
              setAccumulated(paused.accumulated || []);
              setCurQ(paused.curQ);
              setQNum(paused.qNum);
              setSectionNum(pausedSection);
              setIsLastQuestion(engine.peekIsLastInSection?.() || false);
              localStorage.removeItem(DIAG_PAUSE_KEY);
              setPhase('question');
              return;
            }
            console.warn('[diag] stale pause data, restarting section', { pausedSection, expectedSection, pausedGrade: paused.grade, currentGrade: grade });
            localStorage.removeItem(DIAG_PAUSE_KEY);
          }
        } catch (_) {}

        let first;
        if (initialEngineState) {
          engine.applyExportedState(initialEngineState);
          first = engine.startNewSection();
        } else {
          first = engine.start();
        }
        if (!first) { setPhase('error'); return; }
        setCurQ(first);
        setIsLastQuestion(engine.peekIsLastInSection?.() || false);
        setPhase('rules');
      } catch (e) { console.error(e); setPhase('error'); }
    })();
  }, []);

  const handleAnswer = useCallback((answerData) => {
    if (finishedRef.current) return;
    const { task: nextQ, debug } = engineRef.current.submitAnswer(curQ.id, answerData.correct);
    const enriched = { ...answerData, _engineDebug: debug, _grade: curQ.section, skillId: curQ.skillId || curQ.id, verticalId: curQ.verticalId };
    const next = [...accumulated, enriched];
    setAccumulated(next);

    const status = debug?.sessionStatus || (nextQ ? 'ONGOING' : 'ALL_DONE');

    // SECTION_COMPLETE (стек большой) или SECTION_DONE (стек пуст, чистое завершение)
    if (status === 'SECTION_COMPLETE' || status === 'SECTION_DONE') {
      allAnswersRef.current = [...allAnswersRef.current, ...next];
      const engineState = engineRef.current.exportState();
      const stackSize = debug?.remainingStack || 0;
      setTransitionInfo({ engineState, stackSize });
      setAccumulated([]);
      setPhase('done_section');
      // Section is done — drop any in-progress autosave for this grade.
      try { localStorage.removeItem(DIAG_PAUSE_KEY); } catch {}
      // Сохраняем результаты раздела СРАЗУ — не ждём нажатия кнопки
      onSectionComplete && onSectionComplete(next, engineState, sectionNum, stackSize);
      return;
    }

    if (!nextQ || status === 'ALL_DONE') {
      // Полностью завершено
      finishedRef.current = true;
      try { localStorage.removeItem(DIAG_PAUSE_KEY); } catch {}
      onFinish([...allAnswersRef.current, ...next]);
      return;
    }

    setQNum(n => n + 1);
    setCurQ(nextQ);
    // Прогноз «следующий ответ закроет раздел» — заменяем хардкод qNum>=25.
    setIsLastQuestion(engineRef.current.peekIsLastInSection?.() || false);

    // Autosave after every answer so a closed tab doesn't lose progress.
    try {
      const engineState = engineRef.current.exportState();
      localStorage.setItem(DIAG_PAUSE_KEY, JSON.stringify({
        grade, curQ: nextQ, qNum: qNum + 1, accumulated: next,
        allAnswers: allAnswersRef.current,
        engineState, sectionNum,
      }));
    } catch (_) {}
  }, [accumulated, curQ, qNum, sectionNum, grade, onFinish, onSectionComplete]);

  const handlePause = useCallback(() => {
    if (finishedRef.current || !curQ) return;
    try {
      const engineState = engineRef.current.exportState();
      localStorage.setItem(DIAG_PAUSE_KEY, JSON.stringify({
        grade, curQ, qNum, accumulated,
        allAnswers: allAnswersRef.current,
        engineState, sectionNum,
      }));
    } catch (e) { console.error('pause save:', e); }
    onStop();
  }, [curQ, qNum, accumulated, sectionNum, grade, onStop]);

  if (phase === 'loading') return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:44,marginBottom:12,animation:'pulse 1s infinite'}}>📋</div>
        <div style={{fontFamily:"'Montserrat',sans-serif",fontWeight:700,color:THEME.primary}}>Загружаем задачи…</div>
      </div>
    </div>
  );

  if (phase === 'error') return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16,padding:32}}>
      <div style={{fontSize:52}}>😕</div>
      <h3 style={{fontFamily:"'Montserrat',sans-serif",color:THEME.primary,margin:0}}>Задачи не найдены</h3>
      <p style={{color:THEME.textLight,textAlign:'center'}}>Для класса <b>{grade}</b> задачи ещё не загружены в банк заданий.</p>
      <button onClick={onStop} className="cta-button active" style={{width:'auto',padding:'12px 28px'}}>← Назад</button>
    </div>
  );

  if (phase === 'done_section' && transitionInfo) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'linear-gradient(135deg,#0f172a,#1e293b)',padding:24}}>
      <div style={{textAlign:'center',color:'#fff',maxWidth:480,width:'100%'}}>
        <div style={{fontSize:64,marginBottom:20}}>✅</div>
        <div style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:26,marginBottom:12,color:'#D4AF37'}}>
          Раздел {sectionNum} завершён!
        </div>
        <div style={{fontSize:15,color:'rgba(255,255,255,0.75)',lineHeight:1.7,marginBottom:8}}>
          Ты ответил на <b>{allAnswersRef.current.length}</b> вопросов в этом разделе.
        </div>
        <div style={{fontSize:14,color:'rgba(255,255,255,0.6)',lineHeight:1.7,marginBottom:32}}>
          В системе ещё остались навыки, которые нужно проверить.<br/>
          Пройди следующий раздел диагностики — это поможет нам точнее выявить твои пробелы.
        </div>
        <div style={{background:'rgba(212,175,55,0.1)',border:'1px solid rgba(212,175,55,0.3)',borderRadius:16,padding:'20px 24px',marginBottom:28,textAlign:'left'}}>
          <div style={{fontFamily:"'Montserrat',sans-serif",fontWeight:700,fontSize:14,color:'#D4AF37',marginBottom:10}}>Что дальше?</div>
          <div style={{fontSize:13,color:'rgba(255,255,255,0.7)',lineHeight:1.8}}>
            На главном экране появится кнопка <b>«Начать Раздел {sectionNum + 1}»</b>.<br/>
            Ты можешь продолжить в любое удобное время — прогресс сохранён.
          </div>
        </div>
        <button
          onClick={onStop}
          style={{background:'#D4AF37',color:'#0f172a',border:'none',borderRadius:14,padding:'16px 36px',fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:16,cursor:'pointer',width:'100%',marginBottom:12}}
        >
          На главный экран →
        </button>
      </div>
    </div>
  );

  if (phase === 'rules') return (
    <DiagnosticRulesScreen
      sectionName={sectionNum > 1 ? `Умная Диагностика · Раздел ${sectionNum}` : 'Умная Диагностика'}
      questionCount={25}
      onStart={() => setPhase('question')}
      onBack={onStop}
    />
  );

  if (phase === 'question' && curQ) return (
    <div style={{position:'relative'}}>
      <div style={{position:'fixed',top:8,left:'50%',transform:'translateX(-50%)',zIndex:9999,background:'rgba(0,0,0,0.75)',color:'#fff',fontSize:12,fontFamily:"'Courier New',monospace",padding:'5px 14px',borderRadius:20,whiteSpace:'nowrap',pointerEvents:'none',backdropFilter:'blur(4px)'}}>
        🔬 Р{sectionNum} · {curQ.section} · {curQ.skillId} · {curQ.verticalId}
      </div>
      <QuestionScreen
        question={curQ}
        qNum={qNum + 1}
        adaptiveMode
        isLastQuestion={isLastQuestion}
        onComplete={handleAnswer}
        onPause={handlePause}
        canSkip={user?.status === 'tester'}
      />
    </div>
  );

  return null;
}
