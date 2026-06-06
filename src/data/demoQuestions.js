// Набор задач для демо-диагностики без регистрации.
// Firestore-коллекция `questions` требует авторизации, поэтому демо использует
// этот автономный bundled-набор. Форма объекта совместима с боевой: text/options/
// correct (0-based) + topic/difficulty/hint. Математика — в $...$ (KaTeX), кириллица
// вне формул. Все ответы выверены вручную.

export const DEMO_QUESTIONS = [
  // ── простые ──────────────────────────────────────────────────────────────
  { id: "d1", topic: "Арифметика", difficulty: "easy", grade: 5,
    text: "Вычислите: $24 + 18 \\cdot 2$",
    options: ["84", "60", "72", "48"], correct: 1,
    hint: "Сначала умножение: $18 \\cdot 2 = 36$, затем $24 + 36 = 60$." },
  { id: "d2", topic: "Дроби", difficulty: "easy", grade: 5,
    text: "Сократите дробь $\\frac{12}{18}$",
    options: ["$\\frac{3}{4}$", "$\\frac{2}{3}$", "$\\frac{1}{2}$", "$\\frac{6}{9}$"], correct: 1,
    hint: "Числитель и знаменатель делятся на $6$: $\\frac{12}{18} = \\frac{2}{3}$." },
  { id: "d3", topic: "Проценты", difficulty: "easy", grade: 6,
    text: "Сколько будет $20\\%$ от числа $150$?",
    options: ["30", "20", "45", "25"], correct: 0,
    hint: "$20\\% = 0{,}2$, поэтому $0{,}2 \\cdot 150 = 30$." },

  // ── средние ──────────────────────────────────────────────────────────────
  { id: "d4", topic: "Уравнения", difficulty: "medium", grade: 7,
    text: "Решите уравнение: $3x - 7 = 11$",
    options: ["$x = 4$", "$x = 9$", "$x = 6$", "$x = 3$"], correct: 2,
    hint: "$3x = 18$, значит $x = 6$." },
  { id: "d5", topic: "Проценты", difficulty: "medium", grade: 7,
    text: "Цена выросла со $200$ до $260$ тг. На сколько процентов?",
    options: ["$30\\%$", "$26\\%$", "$60\\%$", "$13\\%$"], correct: 0,
    hint: "Прирост $60$ от $200$: $\\frac{60}{200} = 0{,}3 = 30\\%$." },
  { id: "d6", topic: "Геометрия", difficulty: "medium", grade: 6,
    text: "Периметр прямоугольника со сторонами $5$ и $8$?",
    options: ["40", "26", "13", "21"], correct: 1,
    hint: "$P = 2 \\cdot (5 + 8) = 26$." },
  { id: "d7", topic: "Степени", difficulty: "medium", grade: 7,
    text: "Вычислите $2^5$",
    options: ["10", "25", "16", "32"], correct: 3,
    hint: "$2 \\cdot 2 \\cdot 2 \\cdot 2 \\cdot 2 = 32$." },
  { id: "d8", topic: "Пропорции", difficulty: "medium", grade: 6,
    text: "$4$ ручки стоят $200$ тг. Сколько стоят $6$ таких ручек?",
    options: ["300", "250", "350", "280"], correct: 0,
    hint: "Одна ручка: $200 : 4 = 50$ тг, тогда $6 \\cdot 50 = 300$." },

  // ── сложные ──────────────────────────────────────────────────────────────
  { id: "d9", topic: "Уравнения", difficulty: "hard", grade: 8,
    text: "Решите уравнение: $\\frac{x}{3} + 4 = 10$",
    options: ["$x = 2$", "$x = 18$", "$x = 42$", "$x = 6$"], correct: 1,
    hint: "$\\frac{x}{3} = 6$, значит $x = 18$." },
  { id: "d10", topic: "Площади фигур", difficulty: "hard", grade: 8,
    text: "Площадь треугольника с основанием $10$ и высотой $6$?",
    options: ["60", "16", "30", "18"], correct: 2,
    hint: "$S = \\frac{1}{2} \\cdot 10 \\cdot 6 = 30$." },
  { id: "d11", topic: "Проценты", difficulty: "hard", grade: 9,
    text: "Товар $1000$ тг: скидка $15\\%$, затем ещё $10\\%$. Итоговая цена?",
    options: ["765", "750", "775", "700"], correct: 0,
    hint: "$1000 \\cdot 0{,}85 = 850$; затем $850 \\cdot 0{,}9 = 765$." },
  { id: "d12", topic: "Степени", difficulty: "hard", grade: 9,
    text: "Упростите выражение: $\\frac{a^5}{a^2}$",
    options: ["$a^7$", "$a^{10}$", "$a^3$", "$a^2$"], correct: 2,
    hint: "При делении степеней показатели вычитаются: $5 - 2 = 3$." },
];

// перемешать варианты ответа, пересчитав индекс правильного (без позиционного смещения)
function shuffleOptions(q) {
  const order = q.options.map((_, i) => i).sort(() => Math.random() - 0.5);
  return { ...q, options: order.map((i) => q.options[i]), correct: order.indexOf(q.correct) };
}

// выбрать 5 задач: 1 простая + 2 средние + 2 сложные, темы по возможности разные
export function pickDemoQuestions() {
  const out = [];
  const usedTopics = new Set();
  const pick = (difficulty, count) => {
    const pool = DEMO_QUESTIONS.filter((q) => q.difficulty === difficulty).sort(() => Math.random() - 0.5);
    let taken = 0;
    for (const q of pool) { if (taken >= count) break; if (usedTopics.has(q.topic)) continue; usedTopics.add(q.topic); out.push(q); taken++; }
    // запас: если разных тем не хватило — добираем любыми из пула
    for (const q of pool) { if (taken >= count) break; if (out.includes(q)) continue; out.push(q); taken++; }
  };
  pick("easy", 1);
  pick("medium", 2);
  pick("hard", 2);
  return out.map(shuffleOptions);
}
