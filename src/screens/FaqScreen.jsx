import React, { useState } from "react";
import { useTheme } from "../ThemeContext.jsx";
import AppTopbar from "../components/AppTopbar.jsx";

const QUESTIONS = [
  {
    key: "diagnostic",
    icon: "🎯",
    title: "Как работает диагностика?",
    body: (
      <>
        <p>Диагностика — это адаптивный тест на 15–20 минут, который проверяет уровень знаний по нужному классу или экзамену.</p>
        <p>Особенность системы — она анализирует <b>не только правильность ответа, но и твою уверенность в нём</b>. Это даёт точную картину сильных и слабых сторон.</p>
        <p>По результатам строится карта навыков с тремя зонами:</p>
        <ul>
          <li><b style={{color:'#ef4444'}}>Красная</b> — критичные пробелы, с них начинаем работу.</li>
          <li><b style={{color:'#f59e0b'}}>Жёлтая</b> — требует внимания, есть моменты для отработки.</li>
          <li><b style={{color:'#10b981'}}>Зелёная</b> — освоено хорошо, можно идти дальше.</li>
        </ul>
        <p>После диагностики автоматически генерируется индивидуальный план обучения.</p>
      </>
    ),
  },
  {
    key: "skillMastery",
    icon: "🏋️",
    title: "Как освоить навык?",
    body: (
      <>
        <p>Каждый навык осваивается в три этапа возрастающей сложности. Между этапами нужно подождать 24 часа — это закрепляет материал.</p>
        <div style={{ background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.2)', borderRadius:10, padding:'12px 14px', marginBottom:12 }}>
          <div style={{ fontWeight:700, color:'#6366f1', marginBottom:6 }}>Этап 1 — Теория + задачи уровня A</div>
          <div style={{ fontSize:14, color:'#334155', lineHeight:1.6 }}>
            Сначала изучаешь теорию навыка, потом проходишь <b>10 базовых задач</b>. Для разблокировки этапа 2 нужно правильно ответить минимум <b>на 8 из 10</b>.
          </div>
        </div>
        <div style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:10, padding:'12px 14px', marginBottom:12 }}>
          <div style={{ fontWeight:700, color:'#f59e0b', marginBottom:6 }}>Этап 2 — Задачи уровня B</div>
          <div style={{ fontSize:14, color:'#334155', lineHeight:1.6 }}>
            Решаешь задачи среднего уровня. Каждый правильный ответ — <b>+1 к энергии</b>. Нужно набрать <b>8 единиц</b>, чтобы перейти дальше.
          </div>
        </div>
        <div style={{ background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.2)', borderRadius:10, padding:'12px 14px', marginBottom:12 }}>
          <div style={{ fontWeight:700, color:'#22c55e', marginBottom:6 }}>Этап 3 — Задачи уровня C</div>
          <div style={{ fontSize:14, color:'#334155', lineHeight:1.6 }}>
            Самые сложные задачи. Нужно решить <b>5 правильных подряд</b>, без ошибок. Если ошибёшься — счётчик обнуляется и нужно начать серию заново.
          </div>
        </div>
        <p>После всех трёх этапов навык считается освоенным и попадает в систему повторений.</p>
      </>
    ),
  },
  {
    key: "daily",
    icon: "📝",
    title: "Когда появляются ежедневные задачи?",
    body: (
      <>
        <p>Ежедневные задачи становятся доступны <b>после освоения первого навыка</b> — когда ты пройдёшь все три этапа хотя бы по одному навыку из плана.</p>
        <p>Каждый освоенный навык встаёт в очередь повторений с увеличивающимися интервалами: <b>1 → 3 → 7 → 14 → 30 дней</b>.</p>
        <p>В день можно получить до 10 задач (лимит настраивается). Если освоенных навыков много — система равномерно распределяет задачи между ними, чтобы за один заход повторить всё, что пора.</p>
        <p>Если задач на сегодня нет — значит, повторять пока нечего, можно осваивать новые навыки в плане.</p>
      </>
    ),
  },
  {
    key: "srs",
    icon: "🔁",
    title: "Что такое система повторений?",
    body: (
      <>
        <p>Это адаптация SRS (Spaced Repetition System) — научно обоснованного метода долгосрочного запоминания.</p>
        <p>Принцип простой: каждый освоенный навык повторяется через увеличивающиеся интервалы.</p>
        <ul>
          <li>1-й раз — на следующий день</li>
          <li>2-й раз — через 3 дня</li>
          <li>3-й раз — через 7 дней</li>
          <li>4-й раз — через 14 дней</li>
          <li>5-й раз — через 30 дней</li>
        </ul>
        <p>Если ответ верный — следующий интервал увеличивается. Если ошибся — навык переносится на завтра.</p>
        <p>Если ошибаться слишком часто — навык <b>деградирует</b> обратно на этап 2, и его нужно осваивать заново. Это защита: лучше пройти заново, чем продолжать с шатким фундаментом.</p>
      </>
    ),
  },
  {
    key: "plan",
    icon: "🗺️",
    title: "Как работает план обучения?",
    body: (
      <>
        <p>После диагностики система автоматически строит индивидуальный план — <b>граф навыков</b> от текущего уровня до целевого.</p>
        <p>Узлы графа — отдельные навыки. Связи показывают зависимости: чтобы открыть верхние навыки, нужно сначала освоить нижние.</p>
        <p>Цвета узлов на карте:</p>
        <ul>
          <li><b style={{color:'#ef4444'}}>Красный</b> — критичный пробел, приоритет.</li>
          <li><b style={{color:'#f59e0b'}}>Жёлтый</b> — есть пробелы, требует отработки.</li>
          <li><b style={{color:'#10b981'}}>Зелёный</b> — освоено.</li>
        </ul>
        <p>План обновляется автоматически по мере прохождения тестов и навыков. Чем больше диагностик пройдёшь — тем точнее план.</p>
      </>
    ),
  },
];

export default function FaqScreen({ onBack, initialQuestion }) {
  const { theme: THEME } = useTheme();
  const [openKey, setOpenKey] = useState(initialQuestion || null);
  const BG = '#f8fafc';

  const toggle = (key) => setOpenKey(prev => prev === key ? null : key);

  return (
    <div className="page-themed" style={{ minHeight:'100vh', background:BG }}>
      <AppTopbar title="❓ Частые вопросы" onBack={onBack} />
      <div style={{ maxWidth:760, margin:'24px auto 48px', padding:'0 16px' }}>
        <h1 style={{
          fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:24,
          color:THEME.primary, margin:'8px 0 6px',
        }}>Частые вопросы</h1>
        <p style={{ fontSize:14, color:THEME.textLight, marginBottom:20, lineHeight:1.6 }}>
          Коротко о ключевых механиках платформы. Нажми на вопрос, чтобы прочитать ответ.
        </p>

        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {QUESTIONS.map(q => {
            const isOpen = openKey === q.key;
            return (
              <div key={q.key} className="theme-card" style={{
                background:'#fff',
                border:`1px solid ${isOpen ? THEME.primary : THEME.border}`,
                borderRadius:12,
                overflow:'hidden',
                transition:'border-color 0.2s, box-shadow 0.2s',
                boxShadow: isOpen ? '0 6px 24px rgba(15,23,42,0.06)' : 'none',
              }}>
                <button
                  onClick={()=>toggle(q.key)}
                  aria-expanded={isOpen}
                  style={{
                    width:'100%',
                    display:'flex', alignItems:'center', gap:12,
                    background:'transparent', border:'none',
                    padding:'16px 18px', cursor:'pointer',
                    textAlign:'left',
                  }}
                >
                  <span style={{ fontSize:22, lineHeight:1 }}>{q.icon}</span>
                  <span style={{
                    flex:1, fontFamily:"'Montserrat',sans-serif",
                    fontWeight:700, fontSize:15, color:THEME.primary,
                  }}>{q.title}</span>
                  <span style={{
                    fontSize:14, color:THEME.textLight,
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition:'transform 0.2s',
                  }}>▾</span>
                </button>
                {isOpen && (
                  <div style={{
                    padding:'4px 22px 20px 52px',
                    fontFamily:"'Inter',sans-serif",
                    fontSize:14, color:THEME.text, lineHeight:1.7,
                  }}>
                    {q.body}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
