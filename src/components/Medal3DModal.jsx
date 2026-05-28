import React, { useEffect, useRef, useState } from 'react';
import { loadThree } from '../lib/loadThree.js';
import Medal from './Medal.jsx';

const TYPE_COLOR = { gold: 0xfbbf24, silver: 0x94a3b8, bronze: 0xb45309 };
const TYPE_HEX   = { gold: '#fbbf24', silver: '#94a3b8', bronze: '#b45309' };
const TYPE_EMOJI = { gold: '🥇', silver: '🥈', bronze: '🥉' };
const CAT_EMOJI  = { global: '🌍', grade: '📚', region: '📍' };
const CAT_LABEL  = { global: 'Глобальный рейтинг', grade: 'Рейтинг класса', region: 'Рейтинг области' };
const SIZE = 300;

function parseWeekId(weekId) {
  const m = /^(\d{4})-W(\d{1,2})$/.exec(weekId || '');
  return m ? { year: Number(m[1]), weekNum: Number(m[2]) } : { year: 0, weekNum: 0 };
}

export default function Medal3DModal({ medal, onClose }) {
  const mountRef = useRef(null);
  const [failed, setFailed] = useState(false);

  const type = medal?.type || 'gold';
  const category = medal?.category || 'global';
  const { year, weekNum } = parseWeekId(medal?.weekId);

  useEffect(() => {
    let renderer, scene, camera, mesh, geometry, faceTexture, frameId;
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

      // Текстура лицевой грани: фон цвета уровня + эмодзи категории.
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 256;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = TYPE_HEX[type] || TYPE_HEX.gold;
      ctx.fillRect(0, 0, 256, 256);
      ctx.font = '150px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(CAT_EMOJI[category] || CAT_EMOJI.global, 128, 138);
      faceTexture = new THREE.CanvasTexture(canvas);

      const bodyMat = new THREE.MeshStandardMaterial({ color: TYPE_COLOR[type] || TYPE_COLOR.gold, metalness: 0.8, roughness: 0.3 });
      const faceMat = new THREE.MeshStandardMaterial({ map: faceTexture, metalness: 0.5, roughness: 0.4 });
      // Порядок материалов CylinderGeometry: [боковая, верхняя крышка, нижняя].
      mats = [bodyMat, faceMat, faceMat];

      geometry = new THREE.CylinderGeometry(1, 1, 0.18, 64);
      geometry.rotateX(Math.PI / 2); // плоские грани смотрят на камеру
      mesh = new THREE.Mesh(geometry, mats);
      scene.add(mesh);

      scene.add(new THREE.AmbientLight(0xffffff, 0.6));
      const key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(2, 3, 4); scene.add(key);
      const rim = new THREE.DirectionalLight(0xffffff, 0.4); rim.position.set(-2, -1, 2); scene.add(rim);

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
      if (faceTexture) faceTexture.dispose();
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
