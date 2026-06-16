// Юнит-тест вердикта (Этап 2, фаза C0). Пинит пороги + ловит ДРЕЙФ двух копий:
// клиентской src/lib/parentVerdict.js (ESM) и серверной functions/parentVerdict.js (CJS).
// Запуск: npm run test:unit (без эмулятора).
import { describe, test, expect } from 'vitest';
import { computeVerdict as clientVerdict, VERDICT_THRESHOLDS as clientT } from '../../src/lib/parentVerdict.js';
import server from '../../functions/parentVerdict.js';

const serverVerdict = server.computeVerdict;
const serverT = server.VERDICT_THRESHOLDS;

// Представительные входы → ожидаемый state (пины поведения порогов/веток).
const CASES = [
  { name: 'всё по нулям → unknown',                    in: { thisWeekPoints: 0,   attempts: 0,   correct: 0,  totalPoints: 0,   masteredCount: 0 }, state: 'unknown' },
  { name: 'история есть, неделя пустая → idle',        in: { thisWeekPoints: 0,   attempts: 100, correct: 80, totalPoints: 500, masteredCount: 3 }, state: 'idle' },
  { name: 'граница idle (29 < 30) → idle',             in: { thisWeekPoints: 29,  attempts: 50,  correct: 40, totalPoints: 100, masteredCount: 1 }, state: 'idle' },
  { name: 'активен, acc<40%, attempts≥20 → struggle',  in: { thisWeekPoints: 200, attempts: 30,  correct: 9,  totalPoints: 300, masteredCount: 1 }, state: 'struggle' },
  { name: 'активен, acc низк. но attempts<20 → good',  in: { thisWeekPoints: 200, attempts: 10,  correct: 2,  totalPoints: 100, masteredCount: 0 }, state: 'good' },
  { name: 'активен, точность норм → good',             in: { thisWeekPoints: 200, attempts: 50,  correct: 45, totalPoints: 500, masteredCount: 5 }, state: 'good' },
  { name: 'граница struggle (acc ровно 40%) → good',   in: { thisWeekPoints: 200, attempts: 50,  correct: 20, totalPoints: 300, masteredCount: 1 }, state: 'good' },
  { name: 'есть mastered, неделя 0 → idle (не unknown)',in: { thisWeekPoints: 0,   attempts: 0,   correct: 0,  totalPoints: 0,   masteredCount: 2 }, state: 'idle' },
];

describe('computeVerdict — пороги + синхронность копий', () => {
  test('VERDICT_THRESHOLDS идентичны (client ↔ server)', () => {
    expect(serverT).toEqual(clientT);
  });

  for (const c of CASES) {
    test(`клиент: ${c.name}`, () => {
      expect(clientVerdict(c.in).state).toBe(c.state);
    });
    test(`сервер: ${c.name}`, () => {
      expect(serverVerdict(c.in).state).toBe(c.state);
    });
    test(`копии совпадают (state+title+tone): ${c.name}`, () => {
      expect(serverVerdict(c.in)).toEqual(clientVerdict(c.in));
    });
  }
});
