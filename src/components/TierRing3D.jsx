import React, { useEffect, useRef, useState } from 'react';
import { loadThree } from '../lib/loadThree.js';
import { getLevelInfo } from '../lib/levelUtils.js';
import { FRAME_STYLES } from '../lib/shopItems.js';
import LevelRing from './LevelRing.jsx';

// 3D-кольцо тира вокруг большого аватара (только ProfileSection, read-mode).
// Прозрачный canvas с TorusGeometry «лицом к камере» (ortho) рисует кольцо
// СНАРУЖИ аватара; сам аватар остаётся CSS/HTML по центру (GIF, рамка магазина,
// инициалы). При сбое загрузки Three → фолбэк на плоское CSS-кольцо (LevelRing).
// Один WebGL-контекст, полный cleanup.

// Процедурный env-куб (яркий вертикальный градиент) — металлический отклик без ассетов.
function makeEnvCube(THREE) {
  const faces = [];
  for (let i = 0; i < 6; i++) {
    const S = 64;
    const c = document.createElement('canvas'); c.width = c.height = S;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#dfe6f2'); g.addColorStop(1, '#3a4658');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    faces.push(c);
  }
  const tex = new THREE.CubeTexture(faces);
  tex.needsUpdate = true;
  return tex;
}

// Мягкая круглая искра для частиц легенды.
function makeSparkCanvas() {
  const S = 64;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,210,140,0.85)');
  g.addColorStop(1, 'rgba(255,140,40,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  return c;
}

export default function TierRing3D({ xp = 0, avatarUrl, equippedFrame, size = 200, label = '' }) {
  const mountRef = useRef(null);
  const [failed, setFailed] = useState(false);

  const info = getLevelInfo(xp);
  const tier = info.tier.tier;
  const color = info.tier.color;
  const ringW = Math.max(2, Math.round(size * 0.07));
  const inner = size - ringW * 2;
  const badge = Math.max(16, Math.round(size * 0.36));
  const frameStyle = equippedFrame ? (FRAME_STYLES[equippedFrame] || null) : null;
  const canvasSize = Math.round(size * 1.35);
  const canvasOffset = Math.round(-(canvasSize - size) / 2);

  useEffect(() => {
    let renderer, scene, camera, frameId, clock;
    let torusGeo, torusMat, envCube, particles, pgeo, pmat, sparkTex;
    let cancelled = false;
    const mount = mountRef.current;
    if (!mount) return;

    loadThree().then((THREE) => {
      if (cancelled || !mount) return;
      const S = canvasSize;
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(S, S);
      mount.appendChild(renderer.domElement);

      scene = new THREE.Scene();
      camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10); // мир [-1,1] → весь canvas
      camera.position.set(0, 0, 5);
      camera.lookAt(0, 0, 0);

      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const dir = new THREE.DirectionalLight(0xffffff, 0.9); dir.position.set(2, 3, 4); scene.add(dir);

      envCube = makeEnvCube(THREE);

      // Геометрия кольца: радиус чуть больше радиуса аватара (мир: 1 ед = S/2 px).
      const px2w = 2 / S;
      const avatarR = (inner / 2) * px2w;
      const tube = ringW * 0.85 * px2w;
      const Rt = avatarR + tube + 3 * px2w;       // небольшой зазор от аватара
      const isLegend = tier === 'legend';
      const isDiamond = tier === 'diamond';
      // diamond — гранёный (низкие сегменты), остальные — гладкие.
      torusGeo = isDiamond
        ? new THREE.TorusGeometry(Rt, tube, 8, 14)
        : new THREE.TorusGeometry(Rt, tube, 16, 80);

      const C = new THREE.Color(color);
      if (isLegend) {
        torusMat = new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xf97316, emissiveIntensity: 0.9, metalness: 0.3, roughness: 0.4, envMap: envCube, envMapIntensity: 0.8 });
      } else if (isDiamond) {
        torusMat = new THREE.MeshStandardMaterial({ color: C, metalness: 0.7, roughness: 0.05, envMap: envCube, envMapIntensity: 1.8, emissive: C, emissiveIntensity: 0.08 });
      } else if (tier === 'platinum') {
        torusMat = new THREE.MeshStandardMaterial({ color: C, metalness: 0.95, roughness: 0.12, envMap: envCube, envMapIntensity: 1.5, emissive: 0x67e8f9, emissiveIntensity: 0.12 });
      } else {
        torusMat = new THREE.MeshStandardMaterial({ color: C, metalness: 0.9, roughness: 0.2, envMap: envCube, envMapIntensity: 1.2 });
      }
      const torus = new THREE.Mesh(torusGeo, torusMat);
      torus.rotation.x = 0.12; // лёгкий наклон → вращение Z читается бликами
      scene.add(torus);

      // Legend — огненные частицы по кольцу.
      let fireBase = null;
      if (isLegend) {
        const COUNT = 30;
        sparkTex = new THREE.CanvasTexture(makeSparkCanvas());
        pgeo = new THREE.BufferGeometry();
        const pos = new Float32Array(COUNT * 3), col = new Float32Array(COUNT * 3), phase = new Float32Array(COUNT);
        fireBase = new THREE.Color('#ffb347');
        for (let i = 0; i < COUNT; i++) {
          const ang = (i / COUNT) * Math.PI * 2;
          const r = Rt + (Math.random() - 0.5) * tube * 1.6;
          pos[i * 3] = Math.cos(ang) * r; pos[i * 3 + 1] = Math.sin(ang) * r; pos[i * 3 + 2] = 0.06;
          phase[i] = Math.random() * Math.PI * 2;
          col[i * 3] = fireBase.r; col[i * 3 + 1] = fireBase.g; col[i * 3 + 2] = fireBase.b;
        }
        pgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        pgeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        pmat = new THREE.PointsMaterial({ size: Math.round(S * 0.03), map: sparkTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: false });
        particles = new THREE.Points(pgeo, pmat);
        scene.add(particles);
        particles.userData = { phase, fireBase };
      }

      clock = new THREE.Clock();
      const SPIN = 0.5; // рад/с
      const animate = () => {
        frameId = requestAnimationFrame(animate);
        const t = clock.getElapsedTime();
        torus.rotation.z += SPIN * 0.016;
        if (isLegend) {
          torusMat.emissiveIntensity = 0.75 + 0.35 * Math.sin(t * 2.2);     // пульсация огня
          const s = 1 + 0.03 * Math.sin(t * 2.2);
          torus.scale.set(s, s, s);
          if (particles) {
            particles.rotation.z -= 0.3 * 0.016;
            const c = pgeo.attributes.color.array, ph = particles.userData.phase, fb = particles.userData.fireBase;
            for (let i = 0; i < ph.length; i++) {
              const tw = 0.5 + 0.5 * Math.abs(Math.sin(t * 3 + ph[i]));
              c[i * 3] = fb.r * tw; c[i * 3 + 1] = fb.g * tw; c[i * 3 + 2] = fb.b * tw;
            }
            pgeo.attributes.color.needsUpdate = true;
          }
        } else {
          torusMat.envMapIntensity = (torusMat.envMapIntensity || 1.2);
        }
        renderer.render(scene, camera);
      };
      animate();
    }).catch((e) => { console.warn('[tierring3d] three load failed:', e?.message || e); if (!cancelled) setFailed(true); });

    return () => {
      cancelled = true;
      if (frameId) cancelAnimationFrame(frameId);
      if (torusGeo) torusGeo.dispose();
      if (torusMat) torusMat.dispose();
      if (envCube) envCube.dispose();
      if (pgeo) pgeo.dispose();
      if (pmat) pmat.dispose();
      if (sparkTex) sparkTex.dispose();
      if (renderer) {
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
        renderer.dispose();
        if (renderer.forceContextLoss) renderer.forceContextLoss();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xp, tier, color, size, canvasSize, inner, ringW]);

  // Фолбэк при сбое Three — текущее плоское CSS-кольцо.
  if (failed) {
    return <LevelRing xp={xp} avatarUrl={avatarUrl} equippedFrame={equippedFrame} size={size} label={label} />;
  }

  const avatar = avatarUrl
    ? <img src={avatarUrl} alt="" style={{ width: inner, height: inner, borderRadius: '50%', objectFit: 'cover', display: 'block', ...(frameStyle || {}) }} />
    : <div style={{
        width: inner, height: inner, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg,#6366f1,#a78bfa)', color: '#fff',
        fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: Math.round(inner * 0.4), ...(frameStyle || {}),
      }}>{label}</div>;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0, display: 'inline-block' }}>
      {/* 3D-кольцо (canvas) снаружи аватара */}
      <div ref={mountRef} style={{ position: 'absolute', width: canvasSize, height: canvasSize, left: canvasOffset, top: canvasOffset, pointerEvents: 'none', zIndex: 0 }} />
      {/* аватар по центру кольца */}
      <div style={{
        position: 'absolute', top: ringW, left: ringW, width: inner, height: inner,
        borderRadius: '50%', overflow: 'hidden', background: '#0f172a',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1,
      }}>
        {avatar}
      </div>
      {/* бейдж уровня */}
      <div style={{
        position: 'absolute', right: -2, bottom: -2, zIndex: 2,
        minWidth: badge, height: badge, borderRadius: badge, padding: '0 4px', boxSizing: 'border-box',
        background: color, color: '#0f172a', border: '2px solid #0f172a',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: Math.round(badge * 0.52), lineHeight: 1,
      }}>{info.level}</div>
    </div>
  );
}
