import React, { useEffect, useRef, useState } from 'react';
import { loadThree } from '../lib/loadThree.js';
import Medal from './Medal.jsx';

const TYPE_COLOR = { gold: 0xfbbf24, silver: 0x94a3b8, bronze: 0xb45309 };
const TYPE_EMOJI = { gold: '🥇', silver: '🥈', bronze: '🥉' };
const CAT_EMOJI  = { global: '🌍', grade: '📚', region: '📍' };
const CAT_LABEL  = { global: 'Глобальный рейтинг', grade: 'Рейтинг класса', region: 'Рейтинг области' };
const SIZE = 300;

function parseWeekId(weekId) {
  const m = /^(\d{4})-W(\d{1,2})$/.exec(weekId || '');
  return m ? { year: Number(m[1]), weekNum: Number(m[2]) } : { year: 0, weekNum: 0 };
}

// Весь канвас → grayscale (яркость = высота для bumpMap).
function luminancePass(ctx, S) {
  const img = ctx.getImageData(0, 0, S, S);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const l = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    d[i] = d[i + 1] = d[i + 2] = l; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

// Лицевой bump-канвас: нейтральный фон + канавка у края + приподнятый бортик +
// концентрические кольца + символ категории в центре → всё в luminance.
function makeFaceBumpCanvas(category) {
  const S = 512;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d');
  const cx = S / 2, cy = S / 2;
  ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, S, S); // высота 0
  // вдавленная канавка у самого края
  ctx.lineWidth = S * 0.03; ctx.strokeStyle = '#3a3a3a';
  ctx.beginPath(); ctx.arc(cx, cy, S * 0.46, 0, Math.PI * 2); ctx.stroke();
  // приподнятый внешний бортик (имитация фаски)
  ctx.lineWidth = S * 0.05; ctx.strokeStyle = '#d4d4d4';
  ctx.beginPath(); ctx.arc(cx, cy, S * 0.42, 0, Math.PI * 2); ctx.stroke();
  // тонкие концентрические кольца — чеканка
  ctx.lineWidth = Math.max(1, S * 0.006);
  [0.36, 0.32, 0.28].forEach((r, i) => {
    ctx.strokeStyle = i % 2 ? '#9a9a9a' : '#c0c0c0';
    ctx.beginPath(); ctx.arc(cx, cy, S * r, 0, Math.PI * 2); ctx.stroke();
  });
  // символ категории в центре
  ctx.font = `${Math.round(S * 0.42)}px serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(CAT_EMOJI[category] || CAT_EMOJI.global, cx, cy + S * 0.02);
  luminancePass(ctx, S);
  return c;
}

// Боковой bump-канвас: вертикальные полосы → радиальные рёбра (reeded edge).
function makeSideBumpCanvas() {
  const W = 1024, H = 16;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const stripes = 120;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = (i % 2 === 0) ? '#ffffff' : '#404040';
    ctx.fillRect(Math.round(i * W / stripes), 0, Math.ceil(W / stripes), H);
  }
  return c;
}

// Простой процедурный env-куб (6 граней с вертикальным градиентом) — даёт
// металлу отражения/блеск без внешних ассетов.
function makeEnvCube(THREE) {
  const faces = [];
  for (let i = 0; i < 6; i++) {
    const S = 64;
    const c = document.createElement('canvas'); c.width = c.height = S;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#c8cdd6'); g.addColorStop(1, '#2b3340');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    faces.push(c);
  }
  const tex = new THREE.CubeTexture(faces);
  tex.needsUpdate = true;
  return tex;
}

export default function Medal3DModal({ medal, onClose }) {
  const mountRef = useRef(null);
  const [failed, setFailed] = useState(false);

  const type = medal?.type || 'gold';
  const category = medal?.category || 'global';
  const { year, weekNum } = parseWeekId(medal?.weekId);

  useEffect(() => {
    let renderer, scene, camera, mesh, geometry, faceBump, sideBump, envCube, frameId;
    let mats = [];
    let cancelled = false;
    const mount = mountRef.current;

    // ── Ручное вращение по Y (без авто-вращения) ──────────────────────────────
    let dragging = false, lastX = 0;
    const getX = (e) => (e.touches ? e.touches[0].clientX : e.clientX);
    const onDown = (e) => { dragging = true; lastX = getX(e); if (renderer) renderer.domElement.style.cursor = 'grabbing'; };
    const onMove = (e) => { if (!dragging || !mesh) return; const x = getX(e); mesh.rotation.y += (x - lastX) * 0.01; lastX = x; };
    const onUp   = () => { dragging = false; if (renderer) renderer.domElement.style.cursor = 'grab'; };
    const onKey  = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);

    loadThree().then((THREE) => {
      if (cancelled || !mount) return;

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(SIZE, SIZE);
      renderer.domElement.style.cursor = 'grab';
      renderer.domElement.style.touchAction = 'none';
      mount.appendChild(renderer.domElement);

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
      camera.position.set(0, 0, 4);

      // ── Рельеф через bumpMap (чеканный металл, без цветного символа) ─────────
      faceBump = new THREE.CanvasTexture(makeFaceBumpCanvas(category));
      sideBump = new THREE.CanvasTexture(makeSideBumpCanvas());
      envCube  = makeEnvCube(THREE);

      const metalColor = TYPE_COLOR[type] || TYPE_COLOR.gold;
      const sideMat = new THREE.MeshStandardMaterial({
        color: metalColor, metalness: 0.9, roughness: 0.25,
        bumpMap: sideBump, bumpScale: 0.04, envMap: envCube, envMapIntensity: 1.0,
      });
      const faceMat = new THREE.MeshStandardMaterial({
        color: metalColor, metalness: 0.9, roughness: 0.25,
        bumpMap: faceBump, bumpScale: 0.05, envMap: envCube, envMapIntensity: 1.0,
      });
      // Порядок материалов CylinderGeometry: [боковая, верхняя крышка, нижняя].
      mats = [sideMat, faceMat, faceMat];

      geometry = new THREE.CylinderGeometry(1, 1, 0.2, 128);
      geometry.rotateX(Math.PI / 2); // плоские грани смотрят на камеру
      mesh = new THREE.Mesh(geometry, mats);
      scene.add(mesh);

      // Свет: env даёт базовый металлический отклик, directional + point — блики.
      scene.add(new THREE.AmbientLight(0xffffff, 0.35));
      const key  = new THREE.DirectionalLight(0xffffff, 1.0); key.position.set(3, 4, 5);  scene.add(key);
      const fill = new THREE.DirectionalLight(0xffffff, 0.35); fill.position.set(-3, -1, 2); scene.add(fill);
      const pt   = new THREE.PointLight(0xffffff, 0.6); pt.position.set(-1.5, 2, 3); scene.add(pt);

      const el = renderer.domElement;
      el.addEventListener('pointerdown', onDown);
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      el.addEventListener('touchstart', onDown, { passive: true });
      window.addEventListener('touchmove', onMove, { passive: true });
      window.addEventListener('touchend', onUp);

      const animate = () => { frameId = requestAnimationFrame(animate); renderer.render(scene, camera); };
      animate();
    }).catch((e) => { console.warn('[medal3d] three load failed:', e?.message || e); if (!cancelled) setFailed(true); });

    // ── Cleanup: критично для предотвращения утечки WebGL-контекстов ──────────
    return () => {
      cancelled = true;
      if (frameId) cancelAnimationFrame(frameId);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
      if (renderer) {
        const el = renderer.domElement;
        el.removeEventListener('pointerdown', onDown);
        el.removeEventListener('touchstart', onDown);
        if (el.parentNode) el.parentNode.removeChild(el);
        renderer.dispose();
        if (renderer.forceContextLoss) renderer.forceContextLoss();
      }
      if (geometry) geometry.dispose();
      mats.forEach((m) => m && m.dispose && m.dispose());
      if (faceBump) faceBump.dispose();
      if (sideBump) sideBump.dispose();
      if (envCube) envCube.dispose();
    };
  }, [medal?.id, type, category, onClose]);

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#0f172a', borderRadius: 18, padding: '24px 28px', maxWidth: 360, width: '100%', textAlign: 'center', color: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
      >
        <div style={{ width: SIZE, height: SIZE, maxWidth: '100%', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {failed
            ? <Medal type={type} category={category} weekId={medal?.weekId} position={medal?.position} size={180} />
            : <div ref={mountRef} style={{ width: SIZE, height: SIZE }} />}
        </div>

        {!failed && (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
            🖱️ Зажми и двигай чтобы вращать
          </div>
        )}

        <div style={{ marginTop: 14 }}>
          <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 22, fontWeight: 800 }}>
            {TYPE_EMOJI[type] || ''} {medal?.position ? `${medal.position} место` : 'Призёр'}
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4, color: '#cbd5e1' }}>
            {CAT_LABEL[category] || ''}
          </div>
          {(year > 0 && weekNum > 0) && (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
              Сезон {year} · Неделя {weekNum}
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          style={{ marginTop: 18, background: '#fbbf24', color: '#0f172a', border: 'none', borderRadius: 10, padding: '10px 28px', fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 14, cursor: 'pointer' }}
        >
          Закрыть
        </button>
      </div>
    </div>
  );
}
