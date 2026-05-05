// ── SRS (Spaced Repetition System) utilities ─────────────────────────────────

export function getAlmatyNextMidnightAfter(date) {
  const OFFSET = 5 * 60 * 60 * 1000; // UTC+5
  const almatyMs = date.getTime() + OFFSET;
  const almatyDate = new Date(almatyMs);
  const nextDayUTC = new Date(Date.UTC(
    almatyDate.getUTCFullYear(), almatyDate.getUTCMonth(), almatyDate.getUTCDate() + 1
  ));
  return new Date(nextDayUTC.getTime() - OFFSET);
}
export function isStageUnlocked(lastCompletedAtISO) {
  if (!lastCompletedAtISO) return true;
  return Date.now() >= getAlmatyNextMidnightAfter(new Date(lastCompletedAtISO)).getTime();
}
export function getAlmatyDateStr(offsetDays = 0) {
  const OFFSET = 5 * 60 * 60 * 1000;
  const d = new Date(Date.now() + OFFSET + offsetDays * 86400000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}
export const SRS_INTERVALS = [1, 3, 7, 14, 30]; // days for review stages 1-5

export function fmtCountdown(ms) {
  if (ms <= 0) return '00:00:00';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
