import { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import dialogues from './constants/npcDialogues.json';
import { TOURS } from './constants/npcTours.js';
import { useAuth } from './contexts/AuthContext.jsx';
import { doc, setDoc, db } from './firestore-rest.js';

const NpcContext = createContext(null);

function getRandomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function applyName(message, name) {
  if (typeof message !== 'string') return '';
  return message.replace(/\{name\}/g, name || 'друг');
}

function resolveMessage(key, name) {
  if (!key) return '';
  const entry = dialogues[key];
  if (Array.isArray(entry)) return applyName(getRandomFrom(entry), name);
  // Одиночные строковые ключи (onboard_diag / onboard_skillmap и т.п.).
  if (typeof entry === 'string') return applyName(entry, name);
  if (key.startsWith('intros.')) {
    const topic = key.slice(7);
    return applyName(dialogues.intros?.[topic] ?? '', name);
  }
  // Фолбэк: ключа в словаре нет — трактуем сам key как литеральный текст.
  return applyName(key, name);
}

// Ключи в localStorage — оба per-uid: разные аккаунты в одном браузере
// не делят ни прогресс туров, ни персональный toggle помощника.
const SEEN_KEY_PREFIX = 'aapa_npc_seen_tours';
// User-controlled toggle. Default: hints are ON; user can opt out via profile.
const ENABLED_KEY_PREFIX = 'aapa_npc_enabled';

function seenKeyFor(uid) {
  return uid ? `${SEEN_KEY_PREFIX}_${uid}` : SEEN_KEY_PREFIX;
}
function enabledKeyFor(uid) {
  return uid ? `${ENABLED_KEY_PREFIX}_${uid}` : ENABLED_KEY_PREFIX;
}
function getSeenTours(uid) {
  try { return JSON.parse(localStorage.getItem(seenKeyFor(uid)) || '{}'); } catch { return {}; }
}
function markTourSeen(uid, screenKey) {
  try {
    const seen = getSeenTours(uid);
    seen[screenKey] = true;
    localStorage.setItem(seenKeyFor(uid), JSON.stringify(seen));
    // Серверная персистентность (users/{uid}.npcToursSeen): на новом
    // устройстве или после чистки localStorage туры не запускаются заново.
    // fire-and-forget — сбой записи не ломает UX.
    if (uid) setDoc(doc(db, 'users', uid), { npcToursSeen: seen }, { merge: true }).catch(() => {});
  } catch {}
}
export function isNpcEnabled(uid) {
  try { return localStorage.getItem(enabledKeyFor(uid)) !== '0'; } catch { return true; }
}
export function setNpcEnabled(uid, enabled) {
  try { localStorage.setItem(enabledKeyFor(uid), enabled ? '1' : '0'); } catch {}
}

export function NpcProvider({ children }) {
  const { profile, firebaseUser } = useAuth();
  const uid = firebaseUser?.uid;
  const [state, setState] = useState({ visible: false, message: '', selector: null, tourActive: false, spotlight: false });
  const timerRef = useRef(null);
  const tourRef = useRef({ steps: [], idx: 0, screenKey: '', onComplete: null });

  // Серверные npcToursSeen → localStorage при загрузке профиля: просмотренные
  // на другом устройстве туры не показываются здесь заново. Local выигрывает
  // при конфликте (мог быть помечен позже сервера).
  useEffect(() => {
    if (!uid || !profile?.npcToursSeen) return;
    try {
      const local = getSeenTours(uid);
      localStorage.setItem(seenKeyFor(uid), JSON.stringify({ ...profile.npcToursSeen, ...local }));
    } catch {}
  }, [uid, profile?.npcToursSeen]);

  // showNpcMessage(key, durationMs, options)
  //   options.selector — если задан, помощник подсвечивает этот элемент
  //   (spotlight: затемнение фона + рамка, как в турах, но без шагов/кнопок
  //   «Далее»). Используется онбординг-репликами onboard_diag/onboard_skillmap.
  const showNpcMessage = useCallback((key, durationMs = 0, options = {}) => {
    if (!isNpcEnabled(uid)) return;
    const message = resolveMessage(key, profile?.firstName);
    if (!message) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    const selector = options.selector || null;
    setState({ visible: true, message, selector, tourActive: false, spotlight: !!selector });
    if (durationMs > 0) {
      timerRef.current = setTimeout(() => {
        setState(s => ({ ...s, visible: false }));
      }, durationMs);
    }
  }, [profile?.firstName, uid]);

  const hideNpc = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setState({ visible: false, message: '', selector: null, tourActive: false, spotlight: false });
    tourRef.current = { steps: [], idx: 0, screenKey: '', onComplete: null };
  }, []);

  // Показать конкретный шаг тура
  const showTourStep = useCallback((steps, idx, screenKey) => {
    // Очищаем таймер автоскрытия от предыдущего showNpcMessage —
    // иначе таймер от greeting (8с) скроет начавшийся тур.
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    // Помечаем тур просмотренным сразу на первом шаге — если пользователь
    // закроет вкладку до завершения, тур не запустится повторно.
    if (idx === 0) markTourSeen(uid, screenKey);
    if (idx >= steps.length) {
      markTourSeen(uid, screenKey);
      const cb = tourRef.current.onComplete;
      setState({ visible: false, message: '', selector: null, tourActive: false });
      tourRef.current = { steps: [], idx: 0, screenKey: '', onComplete: null };
      cb?.();
      return;
    }
    const step = steps[idx];
    // На мобильном (≤ 768px) — используем альтернативные селектор/текст,
    // если шаг их определяет (например, sidebar → bottom-nav).
    const isMobile = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
    const stepSelector = (isMobile && step.mobileSelector) || step.selector;
    const stepMessage  = (isMobile && step.mobileMessage)  || step.message;
    tourRef.current = { steps, idx, screenKey, onComplete: tourRef.current.onComplete };
    setState({ visible: true, message: applyName(stepMessage, profile?.firstName), selector: stepSelector || null, tourActive: true, stepIdx: idx, totalSteps: steps.length });
  }, [profile?.firstName, uid]);

  const nextTourStep = useCallback(() => {
    const { steps, idx, screenKey } = tourRef.current;
    showTourStep(steps, idx + 1, screenKey);
  }, [showTourStep]);

  const skipTour = useCallback(() => {
    const { screenKey, onComplete } = tourRef.current;
    if (screenKey) markTourSeen(uid, screenKey);
    hideNpc();
    onComplete?.();
  }, [hideNpc, uid]);

  // Запустить тур для экрана — только если ещё не видели и помощник включён.
  // Возвращает true если тур реально запустится (с задержкой), false иначе.
  // onComplete — опциональный колбек, вызывается когда тур завершён или пропущен.
  // Не запускает тур пока auth не загрузил uid — иначе markTourSeen
  // запишет в legacy-ключ, и тур повторится при следующем входе.
  const startTourIfNew = useCallback((screenKey, onComplete) => {
    if (!uid) return false;
    if (!isNpcEnabled(uid)) return false;
    const steps = TOURS[screenKey];
    if (!steps || !steps.length) return false;
    const seen = getSeenTours(uid);
    if (seen[screenKey]) return false;
    // Серверный флаг напрямую — на случай, если тур стартует раньше, чем
    // npcToursSeen из профиля домержится в localStorage (гонка при загрузке).
    if (profile?.npcToursSeen?.[screenKey]) return false;
    // Сохраняем onComplete до отложенного запуска первого шага
    tourRef.current = { steps: [], idx: 0, screenKey: '', onComplete: onComplete || null };
    // Небольшая задержка чтобы экран успел отрисоваться
    setTimeout(() => {
      showTourStep(steps, 0, screenKey);
    }, 600);
    return true;
  }, [showTourStep, uid, profile?.npcToursSeen]);

  return (
    <NpcContext.Provider value={{ npcState: state, showNpcMessage, hideNpc, startTourIfNew, nextTourStep, skipTour }}>
      {children}
    </NpcContext.Provider>
  );
}

export function useNpc() {
  return useContext(NpcContext);
}
