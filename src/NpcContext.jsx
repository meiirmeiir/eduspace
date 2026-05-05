import { createContext, useContext, useCallback, useRef, useState } from 'react';
import dialogues from './constants/npcDialogues.json';
import { TOURS } from './constants/npcTours.js';

const NpcContext = createContext(null);

function getRandomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function resolveMessage(key) {
  if (!key) return '';
  if (Array.isArray(dialogues[key])) return getRandomFrom(dialogues[key]);
  if (key.startsWith('intros.')) {
    const topic = key.slice(7);
    return dialogues.intros?.[topic] ?? '';
  }
  return key;
}

// Ключ в localStorage для хранения просмотренных туров
const SEEN_KEY = 'aapa_npc_seen_tours';

function getSeenTours() {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); } catch { return {}; }
}
function markTourSeen(screenKey) {
  try {
    const seen = getSeenTours();
    seen[screenKey] = true;
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {}
}

export function NpcProvider({ children }) {
  const [state, setState] = useState({ visible: false, message: '', selector: null, tourActive: false });
  const timerRef = useRef(null);
  const tourRef = useRef({ steps: [], idx: 0, screenKey: '' });

  const showNpcMessage = useCallback((key, durationMs = 0) => {
    const message = resolveMessage(key);
    if (!message) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setState({ visible: true, message, selector: null, tourActive: false });
    if (durationMs > 0) {
      timerRef.current = setTimeout(() => {
        setState(s => ({ ...s, visible: false }));
      }, durationMs);
    }
  }, []);

  const hideNpc = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setState({ visible: false, message: '', selector: null, tourActive: false });
    tourRef.current = { steps: [], idx: 0, screenKey: '' };
  }, []);

  // Показать конкретный шаг тура
  const showTourStep = useCallback((steps, idx, screenKey) => {
    if (idx >= steps.length) {
      markTourSeen(screenKey);
      setState({ visible: false, message: '', selector: null, tourActive: false });
      tourRef.current = { steps: [], idx: 0, screenKey: '' };
      return;
    }
    const step = steps[idx];
    tourRef.current = { steps, idx, screenKey };
    setState({ visible: true, message: step.message, selector: step.selector || null, tourActive: true, stepIdx: idx, totalSteps: steps.length });
  }, []);

  const nextTourStep = useCallback(() => {
    const { steps, idx, screenKey } = tourRef.current;
    showTourStep(steps, idx + 1, screenKey);
  }, [showTourStep]);

  const skipTour = useCallback(() => {
    const { screenKey } = tourRef.current;
    if (screenKey) markTourSeen(screenKey);
    hideNpc();
  }, [hideNpc]);

  // Запустить тур для экрана — только если ещё не видели
  const startTourIfNew = useCallback((screenKey) => {
    const steps = TOURS[screenKey];
    if (!steps || !steps.length) return;
    const seen = getSeenTours();
    if (seen[screenKey]) return;
    // Небольшая задержка чтобы экран успел отрисоваться
    setTimeout(() => {
      showTourStep(steps, 0, screenKey);
    }, 600);
  }, [showTourStep]);

  return (
    <NpcContext.Provider value={{ npcState: state, showNpcMessage, hideNpc, startTourIfNew, nextTourStep, skipTour }}>
      {children}
    </NpcContext.Provider>
  );
}

export function useNpc() {
  return useContext(NpcContext);
}
