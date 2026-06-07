import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../ThemeContext.jsx';
import { loadThree } from '../lib/loadThree.js';

// Прогресс по плану как сборка космолёта. 10 деталей; каждые 10% освоенных
// навыков открывают одну. Корабль — 3D (Three.js r128), лежит горизонтально:
// нос справа, двигатели/сопла слева. Открытые детали материализованы (металл/
// золото/стекло, envMap), неоткрытые — голо-чертёж (cyan wireframe, мерцание).
// При 100% — разовый взлёт (огонь слева, рывок вправо) + свечение. Play-once по
// uid (localStorage). Бар — голографический (неон, ромбы, бегущий блик).
// Фолбэк при сбое Three.js — SVG-корабль (ShipSvg).

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const easeIn = (x) => x * x;

// Порядок сборки 1→10 (деталь i открывается при progress ≥ i·10%). Имена — для
// меток бара и SVG-фолбэка; SVG-геометрия (d/circle/lines) — только для фолбэка.
const PARTS = [
  { id: 'hull', name: 'Корпус', d: 'M110 66 C127 66 132 86 132 108 L132 168 C132 181 122 188 110 188 C98 188 88 181 88 168 L88 108 C88 86 93 66 110 66 Z', fill: 'url(#gHull)', stroke: '#9fb6e0' },
  { id: 'engineL', name: 'Левый двигатель', d: 'M92 202 L106 202 L103 220 L95 220 Z', fill: '#3f4d6b', stroke: '#9fb0d0' },
  { id: 'engineR', name: 'Правый двигатель', d: 'M114 202 L128 202 L125 220 L117 220 Z', fill: '#3f4d6b', stroke: '#9fb0d0' },
  { id: 'tail', name: 'Хвостовой стабилизатор', d: 'M90 182 L130 182 L136 204 L84 204 Z', fill: 'url(#gHull2)', stroke: '#9fb6e0' },
  { id: 'wingL', name: 'Левое крыло', d: 'M88 122 L54 192 L72 192 L88 162 Z', fill: 'url(#gHull2)', stroke: '#9fb6e0' },
  { id: 'wingR', name: 'Правое крыло', d: 'M132 122 L166 192 L148 192 L132 162 Z', fill: 'url(#gHull2)', stroke: '#9fb6e0' },
  { id: 'cockpit', name: 'Кабина', circle: [110, 104, 13.5], fill: 'url(#gGlass)', stroke: '#bfe9ff' },
  { id: 'nose', name: 'Нос', d: 'M110 42 C119 52 128 64 130 78 L90 78 C92 64 101 52 110 42 Z', fill: 'url(#gGold)', stroke: '#ffe08a' },
  { id: 'antenna', name: 'Антенна', d: 'M110 42 L110 22', circle: [110, 20, 2.5], fill: 'none', stroke: '#bfe9ff', thin: true },
  { id: 'trim', name: 'Дюзы и детали', lines: ['M92 138 L128 138', 'M95 158 L125 158', 'M110 82 L110 130'], circles: [[99, 122, 2], [121, 122, 2]], fill: 'none', stroke: '#ffd86b', thin: true },
];

const HOLO_KEYFRAMES = `
@keyframes holoSweep { 0%{transform:translateX(-120%);} 100%{transform:translateX(320%);} }
@keyframes holoPulse { 0%,100%{box-shadow:0 0 4px rgba(245,197,24,0.6);} 50%{box-shadow:0 0 11px rgba(245,197,24,1);} }
`;

// Процедурный env-куб (как в RewardChest) — отражения металлу/золоту без ассетов.
function makeEnvCube(THREE) {
  const faces = [];
  for (let i = 0; i < 6; i++) {
    const S = 64;
    const c = document.createElement('canvas'); c.width = c.height = S;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, '#dfe9ff'); g.addColorStop(0.5, '#7f93c0'); g.addColorStop(1, '#1a2238');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    faces.push(c);
  }
  const tex = new THREE.CubeTexture(faces);
  tex.needsUpdate = true;
  return tex;
}

function makeGlowCanvas() {
  const S = 256;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.6)');
  g.addColorStop(0.4, 'rgba(155,208,255,0.35)');
  g.addColorStop(1, 'rgba(102,178,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  return c;
}

const H3D = 170; // высота canvas корабля

// Спецификация деталей в 3D (локальные коорд.: длинная ось +Y = нос; кладём
// shipGroup.rotation.z=-90° → +Y→+X (нос вправо), −Y→−X (сопла влево),
// ±X(крылья)→∓Y(вверх/вниз), +Z(кабина)→к камере). Порядок = PARTS (сборка).
const PARTS3D = [
  { id: 'hull', mat: 'steel', geo: (T) => new T.CylinderGeometry(0.5, 0.55, 3.0, 24), pos: [0, -0.2, 0] },
  { id: 'engineL', mat: 'engine', geo: (T) => new T.CylinderGeometry(0.16, 0.26, 0.5, 16), pos: [0.28, -2.55, 0] },
  { id: 'engineR', mat: 'engine', geo: (T) => new T.CylinderGeometry(0.16, 0.26, 0.5, 16), pos: [-0.28, -2.55, 0] },
  { id: 'tail', mat: 'steelDark', geo: (T) => new T.CylinderGeometry(0.55, 0.72, 0.45, 24), pos: [0, -2.05, 0] },
  { id: 'wingL', mat: 'steelDark', geo: (T) => new T.BoxGeometry(0.8, 0.42, 0.07), pos: [0.62, -0.95, 0], rot: [0, 0, -0.35] },
  { id: 'wingR', mat: 'steelDark', geo: (T) => new T.BoxGeometry(0.8, 0.42, 0.07), pos: [-0.62, -0.95, 0], rot: [0, 0, 0.35] },
  { id: 'cockpit', mat: 'glass', geo: (T) => new T.SphereGeometry(0.28, 20, 16), pos: [0, 0.7, 0.4], scale: [1, 1, 0.7] },
  { id: 'nose', mat: 'gold', geo: (T) => new T.ConeGeometry(0.5, 1.1, 24), pos: [0, 1.85, 0] },
  { id: 'antenna', mat: 'accent', geo: (T) => new T.CylinderGeometry(0.03, 0.03, 0.7, 8), pos: [0, 2.75, 0] },
  { id: 'trim', mat: 'gold', geo: (T) => new T.TorusGeometry(0.56, 0.045, 8, 28), pos: [0, 0.4, 0], rot: [Math.PI / 2, 0, 0] },
];

function makeMat(THREE, kind, env) {
  switch (kind) {
    case 'steel': return new THREE.MeshStandardMaterial({ color: 0x6c7ba6, metalness: 0.7, roughness: 0.34, envMap: env, envMapIntensity: 0.9, transparent: true });
    case 'steelDark': return new THREE.MeshStandardMaterial({ color: 0x46506e, metalness: 0.6, roughness: 0.45, envMap: env, envMapIntensity: 0.7, transparent: true });
    case 'engine': return new THREE.MeshStandardMaterial({ color: 0x2c3346, metalness: 0.85, roughness: 0.3, envMap: env, envMapIntensity: 0.8, transparent: true });
    case 'gold': return new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.2, envMap: env, envMapIntensity: 1.4, transparent: true, emissive: 0x4a3a10, emissiveIntensity: 0 });
    case 'glass': return new THREE.MeshStandardMaterial({ color: 0x66b2ff, metalness: 0.3, roughness: 0.12, envMap: env, envMapIntensity: 1.2, transparent: true, emissive: 0x2a7fd0, emissiveIntensity: 0.5 });
    case 'accent': return new THREE.MeshStandardMaterial({ color: 0x8fd0ff, metalness: 0.4, roughness: 0.3, envMap: env, transparent: true, emissive: 0x3a90d0, emissiveIntensity: 0.4 });
    default: return new THREE.MeshStandardMaterial({ color: 0x888888 });
  }
}

// ── 3D-корабль ───────────────────────────────────────────────────────────────
function Ship3D({ K, seen, onFailed }) {
  const mountRef = useRef(null);
  const kRef = useRef(K);
  const onFailedRef = useRef(onFailed);
  kRef.current = K;
  onFailedRef.current = onFailed;

  useEffect(() => {
    let renderer, scene, camera, frameId, clock, ro;
    let cancelled = false;
    const mount = mountRef.current;
    if (!mount) return;
    const geos = [], mats = [], texs = [];

    loadThree().then((THREE) => {
      if (cancelled || !mount) return;
      let W = mount.clientWidth || 440;

      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      } catch (e) { if (!cancelled) onFailedRef.current?.(); return; }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(W, H3D);
      mount.appendChild(renderer.domElement);

      scene = new THREE.Scene();
      camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
      camera.position.set(0, 0, 12);
      camera.lookAt(0, 0, 0);
      const setFrustum = () => {
        const aspect = W / H3D, halfW = 3.8, halfH = halfW / aspect;
        camera.left = -halfW; camera.right = halfW; camera.top = halfH; camera.bottom = -halfH;
        camera.updateProjectionMatrix();
      };
      setFrustum();

      const env = makeEnvCube(THREE); texs.push(env);
      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const keyL = new THREE.DirectionalLight(0xffffff, 1.0); keyL.position.set(3, 6, 5); scene.add(keyL);
      const fillL = new THREE.DirectionalLight(0x9bd0ff, 0.4); fillL.position.set(-4, 2, 3); scene.add(fillL);

      // launchGroup (мир: рывок вправо) > tiltGroup (наклон+idle) > shipGroup (лечь)
      const launchGroup = new THREE.Group(); scene.add(launchGroup);
      const tiltGroup = new THREE.Group(); tiltGroup.rotation.x = -0.18; launchGroup.add(tiltGroup);
      const shipGroup = new THREE.Group(); shipGroup.rotation.z = -Math.PI / 2; tiltGroup.add(shipGroup);

      const wireMat = new THREE.LineBasicMaterial({ color: 0x66b2ff, transparent: true, opacity: 0.3, depthWrite: false }); mats.push(wireMat);

      const parts = [];
      PARTS3D.forEach((cfg, i) => {
        const geo = cfg.geo(THREE); geos.push(geo);
        const mat = makeMat(THREE, cfg.mat, env); mat.userData.baseEmis = mat.emissiveIntensity || 0; mats.push(mat);
        const solid = new THREE.Mesh(geo, mat);
        solid.position.set(...cfg.pos);
        if (cfg.rot) solid.rotation.set(...cfg.rot);
        if (cfg.scale) solid.scale.set(...cfg.scale);
        solid.visible = false;
        shipGroup.add(solid);
        const wgeo = new THREE.WireframeGeometry(geo); geos.push(wgeo);
        const wire = new THREE.LineSegments(wgeo, wireMat);
        wire.position.copy(solid.position); wire.rotation.copy(solid.rotation); wire.scale.copy(solid.scale);
        shipGroup.add(wire);
        parts.push({ idx: i + 1, solid, mat, wire, baseScale: solid.scale.clone(), appearStart: undefined });
      });

      // Факелы из сопел (локальный −Y → мировой −X, влево)
      const flames = [];
      [0.28, -0.28].forEach((lx) => {
        const fgeo = new THREE.ConeGeometry(0.18, 0.7, 12); geos.push(fgeo);
        const fmat = new THREE.MeshBasicMaterial({ color: 0xffb13b, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }); mats.push(fmat);
        const f = new THREE.Mesh(fgeo, fmat);
        f.position.set(lx, -3.05, 0); f.rotation.z = Math.PI;
        shipGroup.add(f); flames.push(f);
      });

      // Свечение собранного корабля
      const glowTex = new THREE.CanvasTexture(makeGlowCanvas()); texs.push(glowTex);
      const glowMat = new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }); mats.push(glowMat);
      const glow = new THREE.Sprite(glowMat); glow.scale.set(7.5, 3.2, 1); glow.position.set(0, 0, -1.5);
      launchGroup.add(glow);

      ro = new ResizeObserver(() => {
        if (!renderer || !mount) return;
        W = mount.clientWidth || W;
        renderer.setSize(W, H3D); setFrustum();
      });
      ro.observe(mount);

      clock = new THREE.Clock();
      let last = 0, launchStart = null;
      const animate = () => {
        frameId = requestAnimationFrame(animate);
        const t = clock.getElapsedTime();
        Math.min(t - last, 0.05); last = t;
        const Kc = kRef.current;

        tiltGroup.rotation.y = Math.sin(t * 0.5) * 0.12;
        tiltGroup.position.y = Math.sin(t * 1.1) * 0.05;
        wireMat.opacity = 0.26 + 0.08 * Math.sin(t * 3);

        for (const p of parts) {
          const built = p.idx <= Kc;
          p.solid.visible = built;
          p.wire.visible = !built;
          if (!built) continue;
          if (p.appearStart === undefined) p.appearStart = (p.idx > seen) ? t + Math.max(0, p.idx - seen - 1) * 0.12 : -999;
          const ap = clamp01((t - p.appearStart) / 0.6);
          p.solid.scale.copy(p.baseScale).multiplyScalar(0.55 + 0.45 * easeOut(ap));
          p.mat.opacity = ap;
          if (p.mat.emissive) p.mat.emissiveIntensity = p.mat.userData.baseEmis + (1 - ap) * 0.9;
        }

        if (Kc === 10 && seen < 10 && launchStart === null) launchStart = t;
        let lx = 0, ly = 0, flame = 0;
        if (launchStart !== null) {
          const p = t - launchStart;
          if (p < 0.35) flame = p / 0.35;
          else if (p < 1.1) { const q = (p - 0.35) / 0.75; lx = easeIn(q) * 8; ly = easeIn(q) * 2.0; flame = 1; }
          else if (p < 1.6) { lx = 8; ly = 2.0; flame = 0.6; }
          else if (p < 2.4) { const q = (p - 1.6) / 0.8; lx = 8 * (1 - easeOut(q)); ly = 2.0 * (1 - easeOut(q)); flame = 0.6 * (1 - q); }
        }
        launchGroup.position.x = lx; launchGroup.position.y = ly;
        for (const f of flames) { f.material.opacity = flame; const s = 0.5 + flame; f.scale.set(0.6 + flame * 0.5, s, 0.6 + flame * 0.5); }
        glowMat.opacity = Kc === 10 ? (0.22 + 0.12 * Math.sin(t * 2)) : 0;

        renderer.render(scene, camera);
      };
      animate();
    }).catch((e) => {
      console.warn('[ship3d] three load failed:', e?.message || e);
      if (!cancelled) onFailedRef.current?.();
    });

    return () => {
      cancelled = true;
      if (frameId) cancelAnimationFrame(frameId);
      if (ro) ro.disconnect();
      geos.forEach((g) => g.dispose && g.dispose());
      mats.forEach((m) => m.dispose && m.dispose());
      texs.forEach((t) => t.dispose && t.dispose());
      if (renderer) {
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
        renderer.dispose();
        if (renderer.forceContextLoss) renderer.forceContextLoss();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={mountRef} style={{ width: '100%', height: H3D }} />;
}

// ── SVG-фолбэк (бывший основной корабль) ──────────────────────────────────────
const SVG_Z = ['wingL', 'wingR', 'tail', 'engineL', 'engineR', 'hull', 'cockpit', 'nose', 'antenna', 'trim'];
const SVG_BY_ID = Object.fromEntries(PARTS.map((p, i) => [p.id, { ...p, idx: i + 1 }]));
const STARS = [[30, 40], [180, 30], [200, 90], [22, 110], [196, 160], [34, 200], [186, 214], [60, 24], [150, 220], [16, 70]];
const SVG_KEYFRAMES = `
@keyframes shipPartAppear { 0%{opacity:0;transform:translateY(-10px) scale(.8);} 60%{opacity:1;} 100%{opacity:1;transform:none;} }
@keyframes shipGlow { 0%,100%{filter:drop-shadow(0 0 5px rgba(102,178,255,0.5));} 50%{filter:drop-shadow(0 0 16px rgba(102,178,255,0.95));} }
`;
function renderSvgPart(p, mode, style) {
  const sketch = mode === 'sketch';
  const base = sketch
    ? { fill: 'none', stroke: 'rgba(148,163,184,0.5)', strokeWidth: 1.4, strokeDasharray: '4 3', opacity: 0.5, strokeLinejoin: 'round' }
    : { fill: p.thin ? 'none' : p.fill, stroke: p.stroke, strokeWidth: p.thin ? 2 : 1.2, strokeLinejoin: 'round', strokeLinecap: 'round' };
  const els = [];
  if (p.d) els.push(<path key="d" d={p.d} {...base} />);
  if (p.circle) els.push(<circle key="c" cx={p.circle[0]} cy={p.circle[1]} r={p.circle[2]} {...base} />);
  (p.lines || []).forEach((d, k) => els.push(<path key={'l' + k} d={d} {...base} />));
  (p.circles || []).forEach((c, k) => els.push(<circle key={'cc' + k} cx={c[0]} cy={c[1]} r={c[2]} {...base} fill={sketch ? 'none' : p.stroke} />));
  return <g key={p.id + mode} style={style}>{els}</g>;
}
function ShipSvg({ K, seen }) {
  const partStyle = (idx) => (idx > seen) ? { animation: `shipPartAppear .55s ease ${(idx - seen - 1) * 120}ms both`, transformBox: 'fill-box', transformOrigin: 'center' } : undefined;
  return (
    <svg viewBox="0 0 220 250" style={{ width: '100%', maxWidth: 200, height: 'auto', display: 'block', margin: '0 auto' }}>
      <style>{SVG_KEYFRAMES}</style>
      <defs>
        <linearGradient id="gHull" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8fa8d8" /><stop offset="0.5" stopColor="#4a5e90" /><stop offset="1" stopColor="#2a3a66" /></linearGradient>
        <linearGradient id="gHull2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#42527c" /><stop offset="1" stopColor="#222f52" /></linearGradient>
        <linearGradient id="gGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe9a8" /><stop offset="1" stopColor="#e0a93b" /></linearGradient>
        <radialGradient id="gGlass"><stop offset="0" stopColor="#e6f7ff" /><stop offset="0.55" stopColor="#5ab4e6" /><stop offset="1" stopColor="#1c5e8c" /></radialGradient>
        <radialGradient id="gBg" cx="0.5" cy="0.42" r="0.7"><stop offset="0" stopColor="#1a2348" /><stop offset="0.6" stopColor="#0c1230" /><stop offset="1" stopColor="#070a1c" /></radialGradient>
      </defs>
      <rect x="3" y="3" width="214" height="244" rx="18" fill="url(#gBg)" />
      {STARS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.4 : 0.9} fill="#fff" opacity={0.45} />)}
      <g style={K === 10 ? { animation: 'shipGlow 3s ease-in-out infinite' } : undefined}>
        {SVG_Z.map((id) => renderSvgPart(SVG_BY_ID[id], 'sketch', undefined))}
        {SVG_Z.map((id) => { const p = SVG_BY_ID[id]; return p.idx <= K ? renderSvgPart(p, 'color', partStyle(p.idx)) : null; })}
      </g>
    </svg>
  );
}

// ── Голографический прогресс-бар ──────────────────────────────────────────────
function HoloBar({ pct, K }) {
  return (
    <div style={{ position: 'relative', marginTop: 18, padding: '0 6px' }}>
      <div style={{ position: 'relative', height: 16, borderRadius: 99, background: 'rgba(10,15,35,0.65)', overflow: 'hidden', border: '1px solid rgba(102,178,255,0.35)', boxShadow: 'inset 0 0 8px rgba(102,178,255,0.25)' }}>
        <div style={{ position: 'relative', height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #f5c518, #66b2ff)', borderRadius: 99, boxShadow: '0 0 10px rgba(102,178,255,0.7)', transition: 'width 0.5s ease', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, bottom: 0, width: '35%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.65), transparent)', animation: 'holoSweep 2.2s linear infinite' }} />
        </div>
      </div>
      <div style={{ position: 'absolute', top: -1, left: 6, right: 6, height: 0 }}>
        {PARTS.map((p, i) => {
          const reached = i + 1 <= K;
          return (
            <span key={p.id} title={p.name} style={{
              position: 'absolute', left: `${(i + 1) * 10}%`, top: 8, transform: 'translate(-50%,-50%) rotate(45deg)',
              width: 9, height: 9, boxSizing: 'border-box',
              border: `1.5px solid ${reached ? '#f5c518' : 'rgba(102,178,255,0.5)'}`,
              background: reached ? '#f5c518' : 'rgba(10,15,35,0.6)',
              animation: reached ? 'holoPulse 2s ease-in-out infinite' : 'none',
            }} />
          );
        })}
      </div>
    </div>
  );
}

export default function ShipProgress({ mastered = 0, total = 0, ready = false, uid }) {
  const { theme: THEME } = useTheme();
  const [failed, setFailed] = useState(false);
  const pct = total > 0 ? Math.round((mastered / total) * 100) : 0;
  const K = Math.min(10, Math.floor(pct / 10));

  const key = uid ? `aapa_ship_parts_${uid}` : 'aapa_ship_parts';
  const [seen] = useState(() => { try { return Number(localStorage.getItem(key)) || 0; } catch { return 0; } });
  useEffect(() => { if (!ready) return; try { localStorage.setItem(key, String(K)); } catch {} }, [K, key, ready]);

  if (!ready) {
    return <div className="empty-state" style={{ padding: '12px 0', fontSize: 14 }}>Пройди диагностику чтобы увидеть свой прогресс</div>;
  }

  const nextPct = (K + 1) * 10 - pct;

  return (
    <div>
      <style>{HOLO_KEYFRAMES}</style>
      {failed ? <ShipSvg K={K} seen={seen} /> : <Ship3D K={K} seen={seen} onFailed={() => setFailed(true)} />}

      <HoloBar pct={pct} K={K} />

      <div style={{ marginTop: 14, fontSize: 15, color: THEME.text, fontWeight: 700, textAlign: 'center' }}>
        Освоено <b style={{ color: THEME.primary }}>{mastered}</b> из {total} навыков · собрано <b style={{ color: '#f5c518' }}>{K}</b> из 10 деталей
      </div>
      {K < 10
        ? <div style={{ marginTop: 5, fontSize: 13.5, fontWeight: 600, color: THEME.text, textAlign: 'center', opacity: 0.85 }}>До следующей детали: ещё {nextPct}%</div>
        : <div style={{ marginTop: 6, fontSize: 14, fontWeight: 800, color: '#f5c518', textAlign: 'center', textShadow: '0 0 12px rgba(245,197,24,0.6)' }}>🚀 Корабль собран! Ты освоил весь план</div>}
    </div>
  );
}
