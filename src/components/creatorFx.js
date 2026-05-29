// Стили (@keyframes/классы) и звук фанфары для профиля Создателя.

let _injected = false;
export function ensureCreatorStyles() {
  if (_injected || typeof document === 'undefined') return;
  _injected = true;
  const s = document.createElement('style');
  s.id = 'creator-fx-styles';
  s.textContent = `
    @keyframes crShimmer { to { background-position: 200% center; } }
    @keyframes crSpin { to { transform: rotate(360deg); } }
    @keyframes crOrbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes crTwinkle { 0%,100% { opacity:.35; } 50% { opacity:1; } }
    @keyframes crStarTwinkle { 0%,100% { opacity:.5; } 50% { opacity:1; } }
    @keyframes crBgShift { 0% { background-position:0% 50%; } 50% { background-position:100% 50%; } 100% { background-position:0% 50%; } }
    @keyframes crFloat { 0% { transform:translateY(0); opacity:0; } 12% { opacity:1; } 88% { opacity:1; } 100% { transform:translateY(-170px); opacity:0; } }
    @keyframes crCrownDrop {
      0%   { transform:translate(-50%,-220px) scale(.6); opacity:0; }
      60%  { transform:translate(-50%,6px)   scale(1.08); opacity:1; }
      80%  { transform:translate(-50%,-3px)  scale(1); }
      100% { transform:translate(-50%,0)     scale(1); opacity:1; }
    }
    @keyframes crBurstFly { 0% { transform:translateY(-4px) scale(.4); opacity:1; } 100% { transform:translateY(-58px) scale(1); opacity:0; } }
    @keyframes crRowGlow { 0%,100% { box-shadow:0 0 14px rgba(251,191,36,.55); } 50% { box-shadow:0 0 18px rgba(168,85,247,.6); } }

    .creator-name {
      background: linear-gradient(90deg,#f59e0b,#fde68a,#a855f7,#fbbf24,#f59e0b);
      background-size: 200% auto;
      -webkit-background-clip: text; background-clip: text;
      -webkit-text-fill-color: transparent; color: transparent;
      animation: crShimmer 3s linear infinite;
    }
    .creator-badge {
      display:inline-flex; align-items:center; gap:6px;
      font-family:'Montserrat',sans-serif; font-weight:800; font-size:13px; letter-spacing:.4px;
      color:#1a1030; padding:5px 14px; border-radius:999px;
      background: linear-gradient(90deg,#fbbf24,#a855f7,#fbbf24); background-size:200% auto;
      box-shadow:0 0 14px rgba(251,191,36,.5), 0 0 22px rgba(168,85,247,.4);
      animation: crShimmer 4s linear infinite;
    }
    .creator-motto { font-style:italic; font-size:14px; color:#fcd34d; font-family:'Inter',sans-serif; }
    .creator-founded { font-size:12px; color:#c4b5fd; font-weight:600; }
    .creator-row { animation: crRowGlow 2.4s ease-in-out infinite; }
  `;
  document.head.appendChild(s);
}

// Короткая триумфальная фанфара через Web Audio API. Без ассетов.
// Тихая (master 0.12), мажорное арпеджио ~0.8с. При блокировке autoplay —
// молча пропускаем (открытие профиля обычно идёт по клику = user-gesture).
export function playFanfare() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const master = ctx.createGain();
    master.gain.value = 0.12;
    master.connect(ctx.destination);
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    const t0 = ctx.currentTime + 0.03;
    notes.forEach((f, i) => {
      const t = t0 + i * 0.09;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(1, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc.connect(g); g.connect(master);
      osc.start(t); osc.stop(t + 0.55);
    });
    setTimeout(() => { ctx.close().catch(() => {}); }, 1600);
  } catch { /* autoplay заблокирован/нет поддержки — тихо пропускаем */ }
}
