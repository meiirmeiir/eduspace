// ── ENV ───────────────────────────────────────────────────────────────────────
export const TELEGRAM_TOKEN  = import.meta.env.VITE_TELEGRAM_TOKEN  || "";
export const TELEGRAM_CHAT   = import.meta.env.VITE_TELEGRAM_CHAT   || "";

// ── КОНСТАНТЫ ─────────────────────────────────────────────────────────────────
export const FALLBACK_QUESTIONS = [
  { id:"f1", sectionName:"Алгебра", topic:"Линейные уравнения", type:"mcq", text:"Решите уравнение: 3x + 7 = 22", options:["x = 5","x = 3","x = 7","x = 4"], correct:0, goals:["exam","gaps","future"] },
  { id:"f2", sectionName:"Геометрия", topic:"Площадь треугольника", type:"mcq", text:"Основание треугольника 8 см, высота 5 см. Найдите площадь.", options:["20 см²","40 см²","13 см²","16 см²"], correct:0, goals:["exam","gaps","future"] },
  { id:"f3", sectionName:"Алгебра", topic:"Степени", type:"mcq", text:"Вычислите: 2⁵ + 3² = ?", options:["41","32","27","39"], correct:0, goals:["exam","gaps","future"] },
];
export const CONFIDENCE_LEVELS = [
  { v:1, label:"Сомневаюсь", color:"#EF4444" }, { v:2, label:"Не уверен", color:"#F59E0B" },
  { v:3, label:"Нейтрально", color:"#94A3B8" }, { v:4, label:"Уверен", color:"#10B981" },
  { v:5, label:"Абсолютно уверен", color:"#059669" }
];
export const RPG_NODES = [
  { id:1, name:"Уравнения", x:100, y:350 }, { id:2, name:"Степени", x:250, y:250 },
  { id:3, name:"Рубеж: Алгебра", x:400, y:150, type:"boss" }, { id:4, name:"Площадь", x:550, y:250 },
  { id:5, name:"Пифагор", x:700, y:350 }, { id:6, name:"Рубеж: Геометрия", x:850, y:250, type:"boss" },
  { id:7, name:"Вероятность", x:700, y:100 }, { id:8, name:"Цель: ЕНТ", x:850, y:50, type:"boss" }
];
export const RPG_PATHS = [[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8]];
export const REG_GOALS = { exam:"Подготовка к экзамену", gaps:"Закрытие пробелов", future:"Подготовка к следующему классу" };
export const DIFFICULTY_WEIGHTS = {A:1, B:1.5, C:2.5}; // A=20%, B=30%, C=50% when all present
export const DIFFICULTY_COLORS = {A:{bg:"#dcfce7",color:"#15803d",border:"#bbf7d0"},B:{bg:"#fef9c3",color:"#92400e",border:"#fde68a"},C:{bg:"#fee2e2",color:"#b91c1c",border:"#fecaca"}};
export const EXAMS_LIST = ["ЕНТ","SAT","NUET","Further Pure Math","IGCSE","Mechanics 1","Mechanics 2","Mechanics 3","Calculus"];
export const GRADES_LIST = ["5 класс","6 класс","7 класс","8 класс","9 класс","10 класс","11 класс","12 класс"];
export const STUDENT_STATUSES = [
  { value:"active",    label:"Активный",       color:"#10B981" },
  { value:"trial",     label:"Пробный",         color:"#F59E0B" },
  { value:"inactive",  label:"Неактивный",      color:"#94A3B8" },
  { value:"paused",    label:"Приостановлен",   color:"#EF4444" },
  { value:"graduated", label:"Выпускник",       color:"#6366F1" },
  { value:"tester",    label:"Тестировщик",     color:"#8B5CF6" },
];
export const QUESTION_TYPES = [
  { value:"mcq",       label:"Один правильный ответ (MCQ)" },
  { value:"multiple",  label:"Несколько правильных ответов" },
  { value:"matching",  label:"Установить соответствие" },
  { value:"generated", label:"Генерируемый (случайные числа)" },
  { value:"model",     label:"Модель (составь выражение)" },
  { value:"compound",  label:"Составной (условие + под-вопросы)" },
  { value:"open",      label:"Открытый ответ (текстовое поле)" },
];
export const DAY_NAMES_SHORT = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
export const DAY_NAMES_FULL  = ["Понедельник","Вторник","Среда","Четверг","Пятница","Суббота","Воскресенье"];
export const THEME = { primary:"#0f172a", accent:"#d4af37", bg:"#f8fafc", surface:"#ffffff", text:"#334155", textLight:"#64748b", border:"#e2e8f0", success:"#10B981", warning:"#F59E0B", error:"#EF4444" };

// ── TELEGRAM ──────────────────────────────────────────────────────────────────
export const escHtml = s => String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
export async function tgSend(text) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT || TELEGRAM_TOKEN==="your_bot_token_here") return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method:"POST", headers:{"content-type":"application/json"},
      body: JSON.stringify({chat_id:TELEGRAM_CHAT, text, parse_mode:"HTML"})
    });
    if (!res.ok) {
      // Fallback: retry without HTML parse mode if parse error
      const err = await res.json().catch(()=>({}));
      if (err?.description?.includes("parse")) {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
          method:"POST", headers:{"content-type":"application/json"},
          body: JSON.stringify({chat_id:TELEGRAM_CHAT, text: text.replace(/<[^>]*>/g,""), parse_mode:""})
        });
      }
    }
  } catch(e){ console.warn("Telegram sendMessage:", e); }
}
export async function tgPhoto(file, caption) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT || TELEGRAM_TOKEN==="your_bot_token_here") return;
  try {
    const form = new FormData();
    form.append("chat_id", TELEGRAM_CHAT);
    form.append("photo", file);
    if (caption) form.append("caption", caption.slice(0,1024));
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, {
      method:"POST", body: form
    });
  } catch(e){ console.warn("Telegram sendPhoto:", e); }
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
export const getSpecificList = (goalKey) => goalKey === "exam" ? EXAMS_LIST : goalKey === "gaps" || goalKey === "future" ? GRADES_LIST : [];
