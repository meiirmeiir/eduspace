// Dev-only breadcrumb-логи (поток начислений XP/очков/кристаллов/покупок/контента).
// В прод-сборке import.meta.env.DEV === false → Vite вырезает console.log внутри
// (dead-code elimination) → ноль вывода и утечки uid в проде; в dev breadcrumbs работают.
// ⚠️ ТОЛЬКО для debug-следов. Прод-диагностику (ошибки) оставляй обычным
// console.error/console.warn — они НЕ должны вырезаться.
export const devLog = (...args) => { if (import.meta.env.DEV) console.log(...args); };
