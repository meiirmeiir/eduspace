import React, { useEffect, useRef, useState } from 'react';
import AchievementBadge from './AchievementBadge.jsx';
import { loadThree } from '../lib/loadThree.js';

// Награда из очереди: 3D-сундук (Three.js r128) с откидывающейся крышкой,
// вспышкой света и вылетающими 3D-кристаллами. Reveal (бейдж/иконка + название
// + «+N 💎» + «Забрать») — CSS-оверлей поверх canvas. При сбое Three.js →
// фолбэк на emoji-сундук 📦 + CSS-частицы (нижняя ветка useFallback).

// ── CSS-частицы для фолбэка ───────────────────────────────────────────────
const PARTICLES = Array.from({ length: 24 }, (_, i) => ({
  angle: (Math.PI * 2 * i) / 24 + (Math.random() - 0.5),
  dist: 90 + Math.random() * 70,
  delay: Math.random() * 0.15,
  emoji: ['💎', '✨', '⭐'][i % 3],
}));

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);

// 2D-shape скруглённого прямоугольника (footprint бокса) — как в Podium3D.
function roundedRectShape(THREE, w, d, r) {
  const hw = w / 2, hd = d / 2;
  const s = new THREE.Shape();
  s.moveTo(-hw + r, -hd);
  s.lineTo(hw - r, -hd);
  s.quadraticCurveTo(hw, -hd, hw, -hd + r);
  s.lineTo(hw, hd - r);
  s.quadraticCurveTo(hw, hd, hw - r, hd);
  s.lineTo(-hw + r, hd);
  s.quadraticCurveTo(-hw, hd, -hw, hd - r);
  s.lineTo(-hw, -hd + r);
  s.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
  return s;
}

// Скруглённый бокс с фасками: ExtrudeGeometry footprint (w×d) выдавлен по высоте
// h, центрирован в начале координат. Итоговые габариты: x=w, y=h, z=d.
function roundedBoxGeo(THREE, w, d, h, r, bevel) {
  bevel = Math.min(bevel, h * 0.3, w * 0.08, d * 0.08);
  r = Math.max(0.01, Math.min(r, w / 2 - bevel - 0.02, d / 2 - bevel - 0.02));
  const shape = roundedRectShape(THREE, w, d, r);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.005, h - bevel * 2),
    bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, steps: 1, curveSegments: 8,
  });
  geo.rotateX(-Math.PI / 2); // ось выдавливания Z → вертикаль Y
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  geo.translate(-(bb.max.x + bb.min.x) / 2, -(bb.max.y + bb.min.y) / 2, -(bb.max.z + bb.min.z) / 2);
  return geo;
}

// Процедурный env-куб (вертикальный градиент) — металлу золота и кристаллам
// отражения/блики без внешних ассетов (как в Podium3D).
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

// Радиальное бирюзово-белое свечение для вспышки из сундука.
function makeGlowCanvas() {
  const S = 256;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.35, 'rgba(125,232,250,0.55)');
  g.addColorStop(1, 'rgba(103,232,249,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  return c;
}

const H = 340; // высота canvas

// Геометрия сундука (мир): база корпуса на y=0.
const BODY_W = 2.2, BODY_D = 1.4, BODY_H = 1.0;
const LID_H = 0.42;
const LID_OPEN_ANGLE = -1.95;      // рад (~-112°) — крышка откинута назад
const MOUTH_Y = BODY_H + 0.05;     // откуда вылетают кристаллы / горловина
const N_CRYSTALS = 12;
const GRAVITY = 7.0;
const CRYSTAL_TINTS = [0x67e8f9, 0x7dd3fc, 0xc4b5fd]; // бирюза / голубой / аметист

// ── 3D-сцена сундука ────────────────────────────────────────────────────────
// open — флаг открытия (читается в animate через ref). onOpened — вызывается
// однократно после вспышки (→ показать reveal). onFailed — если Three.js не
// загрузился/нет WebGL (→ переключиться на emoji-фолбэк).
function Chest3D({ open, onOpened, onFailed }) {
  const mountRef = useRef(null);
  const openRef = useRef(open);
  const onOpenedRef = useRef(onOpened);
  const onFailedRef = useRef(onFailed);
  openRef.current = open;
  onOpenedRef.current = onOpened;
  onFailedRef.current = onFailed;

  useEffect(() => {
    let renderer, scene, camera, frameId, clock, ro;
    let cancelled = false;
    const mount = mountRef.current;
    if (!mount) return;
    const geos = [], mats = [], texs = [];

    loadThree().then((THREE) => {
      if (cancelled || !mount) return;
      let W = mount.clientWidth || 360;

      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      } catch (e) {
        if (!cancelled) onFailedRef.current?.();
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(W, H);
      mount.appendChild(renderer.domElement);

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
      camera.position.set(0, 3.1, 6.0);
      camera.lookAt(0, 0.85, 0);

      const envCube = makeEnvCube(THREE); texs.push(envCube);

      // ── Свет ──────────────────────────────────────────────────────────────
      scene.add(new THREE.AmbientLight(0xffffff, 0.5));
      const key = new THREE.DirectionalLight(0xffffff, 1.0); key.position.set(3, 6, 5); scene.add(key);
      const fill = new THREE.DirectionalLight(0xffffff, 0.35); fill.position.set(-4, 2, 3); scene.add(fill);

      // ── Материалы ───────────────────────────────────────────────────────────
      const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.85, metalness: 0.05, envMap: envCube, envMapIntensity: 0.2 });
      const woodInnerMat = new THREE.MeshStandardMaterial({ color: 0x33200f, roughness: 0.95, metalness: 0.04 }); // тёмное нутро (глубина полости)
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.18, envMap: envCube, envMapIntensity: 1.4 });
      mats.push(woodMat, woodInnerMat, goldMat);

      // ── Группа сундука ───────────────────────────────────────────────────────
      const chestGroup = new THREE.Group();
      scene.add(chestGroup);

      // ── Корпус: ПОЛЫЙ ящик (дно + 4 стенки, открыт сверху) ──────────────────
      // Внешние грани — woodMat, внутренние «панели» — тёмный woodInnerMat (глубина).
      const WALL = 0.13;
      const innerW = BODY_W - WALL * 2, innerD = BODY_D - WALL * 2, innerH = BODY_H - WALL;
      const addMesh = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); chestGroup.add(m); return m; };

      const floorGeo = new THREE.BoxGeometry(BODY_W, WALL, BODY_D);
      addMesh(floorGeo, woodMat, 0, WALL / 2, 0); geos.push(floorGeo);

      const fbWallGeo = new THREE.BoxGeometry(BODY_W, BODY_H, WALL);   // передняя/задняя
      const lrWallGeo = new THREE.BoxGeometry(WALL, BODY_H, innerD);   // левая/правая
      addMesh(fbWallGeo, woodMat, 0, BODY_H / 2, BODY_D / 2 - WALL / 2);
      addMesh(fbWallGeo, woodMat, 0, BODY_H / 2, -(BODY_D / 2 - WALL / 2));
      addMesh(lrWallGeo, woodMat, BODY_W / 2 - WALL / 2, BODY_H / 2, 0);
      addMesh(lrWallGeo, woodMat, -(BODY_W / 2 - WALL / 2), BODY_H / 2, 0);
      geos.push(fbWallGeo, lrWallGeo);

      // Тёмные внутренние панели (видны при открытой крышке → ощущение полости).
      const inFloorGeo = new THREE.BoxGeometry(innerW, 0.02, innerD);
      addMesh(inFloorGeo, woodInnerMat, 0, WALL + 0.01, 0); geos.push(inFloorGeo);
      const inFBGeo = new THREE.BoxGeometry(innerW, innerH, 0.02);
      const inLRGeo = new THREE.BoxGeometry(0.02, innerH, innerD);
      const inY = WALL + innerH / 2;
      addMesh(inFBGeo, woodInnerMat, 0, inY, innerD / 2 - 0.01);
      addMesh(inFBGeo, woodInnerMat, 0, inY, -(innerD / 2 - 0.01));
      addMesh(inLRGeo, woodInnerMat, innerW / 2 - 0.01, inY, 0);
      addMesh(inLRGeo, woodInnerMat, -(innerW / 2 - 0.01), inY, 0);
      geos.push(inFBGeo, inLRGeo);

      // Золотой кант по краю проёма (рамка отверстия сверху).
      const rimFBGeo = new THREE.BoxGeometry(BODY_W, 0.07, 0.08);
      const rimLRGeo = new THREE.BoxGeometry(0.08, 0.07, BODY_D);
      addMesh(rimFBGeo, goldMat, 0, BODY_H, BODY_D / 2 - WALL / 2);
      addMesh(rimFBGeo, goldMat, 0, BODY_H, -(BODY_D / 2 - WALL / 2));
      addMesh(rimLRGeo, goldMat, BODY_W / 2 - WALL / 2, BODY_H, 0);
      addMesh(rimLRGeo, goldMat, -(BODY_W / 2 - WALL / 2), BODY_H, 0);
      geos.push(rimFBGeo, rimLRGeo);

      // Золотые накладки корпуса (front +Z): горизонтальная обвязка + 2 вертикальные полосы.
      const frontZ = BODY_D / 2 + 0.01;
      const bandGeo = new THREE.BoxGeometry(BODY_W * 1.005, 0.12, 0.05);
      const band = new THREE.Mesh(bandGeo, goldMat);
      band.position.set(0, BODY_H * 0.6, frontZ);
      chestGroup.add(band); geos.push(bandGeo);

      const strapGeo = new THREE.BoxGeometry(0.12, BODY_H * 0.96, 0.05);
      [-BODY_W * 0.33, BODY_W * 0.33].forEach((sx) => {
        const strap = new THREE.Mesh(strapGeo, goldMat);
        strap.position.set(sx, BODY_H / 2, frontZ);
        chestGroup.add(strap);
      });
      geos.push(strapGeo);

      // Угловые золотые кубики у верхней кромки корпуса.
      const cornerGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([cx, cz]) => {
        const cap = new THREE.Mesh(cornerGeo, goldMat);
        cap.position.set(cx * (BODY_W / 2 - 0.06), BODY_H - 0.05, cz * (BODY_D / 2 - 0.06));
        chestGroup.add(cap);
      });
      geos.push(cornerGeo);

      // Замок спереди (на стыке корпуса и крышки) + тёмный «глазок».
      const lockGeo = new THREE.BoxGeometry(0.28, 0.32, 0.07);
      const lock = new THREE.Mesh(lockGeo, goldMat);
      lock.position.set(0, BODY_H - 0.04, frontZ + 0.02);
      chestGroup.add(lock); geos.push(lockGeo);
      const keyGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.05, 12);
      const keyMat = new THREE.MeshStandardMaterial({ color: 0x2a1c10, roughness: 0.6, metalness: 0.3 });
      const key2 = new THREE.Mesh(keyGeo, keyMat);
      key2.rotation.x = Math.PI / 2;
      key2.position.set(0, BODY_H - 0.06, frontZ + 0.06);
      chestGroup.add(key2); geos.push(keyGeo); mats.push(keyMat);

      // ── Крышка на шарнире (pivot на задней верхней кромке) ───────────────────
      const lidPivot = new THREE.Group();
      lidPivot.position.set(0, BODY_H, -BODY_D / 2);
      chestGroup.add(lidPivot);

      const lidGeo = roundedBoxGeo(THREE, BODY_W, BODY_D, LID_H, 0.12, 0.05);
      const lid = new THREE.Mesh(lidGeo, woodMat);
      lid.position.set(0, LID_H / 2, BODY_D / 2); // лежит на корпусе при rotation.x=0
      lidPivot.add(lid); geos.push(lidGeo);

      // Золотая полоса на лицевой кромке крышки.
      const lidBandGeo = new THREE.BoxGeometry(BODY_W * 0.55, 0.1, 0.05);
      const lidBand = new THREE.Mesh(lidBandGeo, goldMat);
      lidBand.position.set(0, LID_H * 0.3, BODY_D + 0.01);
      lidPivot.add(lidBand); geos.push(lidBandGeo);

      // ── Вспышка света из сундука: PointLight + аддитивный glow-спрайт ─────────
      const flashLight = new THREE.PointLight(0x9bedf7, 0, 8, 2);
      flashLight.position.set(0, MOUTH_Y + 0.2, 0.1);
      scene.add(flashLight);

      const glowTex = new THREE.CanvasTexture(makeGlowCanvas()); texs.push(glowTex);
      const glowMat = new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, transparent: true, opacity: 0, depthWrite: false });
      const glow = new THREE.Sprite(glowMat);
      glow.position.set(0, MOUTH_Y + 0.15, 0.2);
      glow.scale.set(1, 1, 1);
      scene.add(glow); mats.push(glowMat);

      // ── Кристаллы (вылетают) ─────────────────────────────────────────────────
      const crystals = [];
      const octGeo = new THREE.OctahedronGeometry(0.16);
      const icoGeo = new THREE.IcosahedronGeometry(0.14);
      geos.push(octGeo, icoGeo);
      for (let i = 0; i < N_CRYSTALS; i++) {
        const tint = CRYSTAL_TINTS[i % CRYSTAL_TINTS.length];
        const mat = new THREE.MeshStandardMaterial({
          color: tint, transparent: true, opacity: 0,
          metalness: 0.1, roughness: 0.05, envMap: envCube, envMapIntensity: 1.6,
          emissive: tint, emissiveIntensity: 0.5,
        });
        mats.push(mat);
        const mesh = new THREE.Mesh(i % 2 ? icoGeo : octGeo, mat);
        mesh.visible = false;
        mesh.userData = { base: 0.85, active: false, age: 0, life: 0, v: { x: 0, y: 0, z: 0 }, av: { x: 0, y: 0, z: 0 } };
        scene.add(mesh);
        crystals.push(mesh);
      }

      const spawnCrystals = () => {
        for (const c of crystals) {
          const u = c.userData;
          const a = Math.random() * Math.PI * 2;
          const hs = 0.5 + Math.random() * 0.9;
          u.v = { x: Math.cos(a) * hs, y: 2.6 + Math.random() * 1.4, z: Math.sin(a) * hs * 0.7 };
          u.av = { x: (Math.random() - 0.5) * 4, y: (Math.random() - 0.5) * 4, z: (Math.random() - 0.5) * 4 };
          u.age = 0; u.life = 1.8 + Math.random() * 0.4; u.active = true;
          c.position.set((Math.random() - 0.5) * 0.5, MOUTH_Y, (Math.random() - 0.5) * 0.4);
          c.scale.setScalar(0.001);
          c.visible = true;
        }
      };

      // ── Resize ───────────────────────────────────────────────────────────────
      ro = new ResizeObserver(() => {
        if (!renderer || !mount) return;
        W = mount.clientWidth || W;
        renderer.setSize(W, H);
        camera.aspect = W / H; camera.updateProjectionMatrix();
      });
      ro.observe(mount);

      // ── Анимация ─────────────────────────────────────────────────────────────
      clock = new THREE.Clock();
      let lastT = 0, openT = null, spawned = false, firedOpened = false;
      const CRYSTAL_DELAY = 0.18;

      const animate = () => {
        frameId = requestAnimationFrame(animate);
        const t = clock.getElapsedTime();
        const dt = Math.min(t - lastT, 0.05); lastT = t;

        if (openRef.current && openT === null) openT = t;
        const opened = openT !== null;
        const op = opened ? clamp01((t - openT) / 0.5) : 0;

        // Крышка откидывается назад.
        lidPivot.rotation.x = LID_OPEN_ANGLE * easeOutCubic(op);

        // Idle-покачивание до открытия (гаснет при открытии).
        const idle = 1 - op;
        chestGroup.rotation.y = Math.sin(t * 0.6) * 0.12 * idle;
        chestGroup.position.y = Math.sin(t * 1.4) * 0.04 * idle;

        if (opened) {
          const sinceOpen = t - openT;
          if (sinceOpen >= CRYSTAL_DELAY) {
            if (!spawned) { spawnCrystals(); spawned = true; }
            const fAge = sinceOpen - CRYSTAL_DELAY;
            // Вспышка: пик и затухание.
            flashLight.intensity = fAge < 1.4 ? 5.5 * Math.exp(-fAge / 0.28) : 0;
            glowMat.opacity = fAge < 1.6 ? 0.95 * Math.exp(-fAge / 0.36) : 0;
            const gs = 1.2 + fAge * 2.4;
            glow.scale.set(gs, gs, 1);
          }
          if (!firedOpened && sinceOpen >= 0.7) { firedOpened = true; onOpenedRef.current?.(); }
        }

        // Физика кристаллов.
        for (const c of crystals) {
          const u = c.userData;
          if (!u.active) continue;
          u.age += dt;
          if (u.age >= u.life) { c.visible = false; u.active = false; continue; }
          u.v.y -= GRAVITY * dt;
          c.position.x += u.v.x * dt;
          c.position.y += u.v.y * dt;
          c.position.z += u.v.z * dt;
          c.rotation.x += u.av.x * dt;
          c.rotation.y += u.av.y * dt;
          c.rotation.z += u.av.z * dt;
          const pop = clamp01(u.age / 0.12);
          c.scale.setScalar(pop);
          const fadeIn = clamp01(u.age / 0.15);
          const fadeOut = clamp01((u.life - u.age) / 0.6);
          c.material.opacity = u.base * fadeIn * fadeOut;
        }

        renderer.render(scene, camera);
      };
      animate();
    }).catch((e) => {
      console.warn('[chest3d] three load failed:', e?.message || e);
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

  return <div ref={mountRef} style={{ width: '100%', height: H }} />;
}

// item: { type:'achievement', ach, level } | { type:'quest', quest:{icon,title,crystals} }
export default function RewardChest({ item, onClose }) {
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [useFallback, setUseFallback] = useState(false);

  // Если Three.js отвалился уже после тапа — раскрыть награду сразу (как фолбэк).
  useEffect(() => {
    if (useFallback && open && !revealed) setRevealed(true);
  }, [useFallback, open, revealed]);

  if (!item) return null;

  const isAch = item.type === 'achievement';
  const crystals = isAch ? item.level?.crystals : item.quest?.crystals;
  const title = isAch ? item.ach?.name : item.quest?.title;
  const subtitle = isAch ? (item.level?.desc || '') : 'Квест выполнен';

  const handleOpen = () => {
    if (open) return;
    setOpen(true);
    if (useFallback) setRevealed(true);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2100, overflow: 'hidden' }}>
      <style>{`
        @keyframes rcChestIdle { 0%,100%{transform:translateY(0) rotate(0)} 25%{transform:translateY(-6px) rotate(-3deg)} 75%{transform:translateY(-6px) rotate(3deg)} }
        @keyframes rcGlow { from{opacity:0;transform:scale(0.4)} to{opacity:0.9;transform:scale(1)} }
        @keyframes rcReveal { 0%{opacity:0;transform:scale(0.5) translateY(10px)} 70%{transform:scale(1.1)} 100%{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes rcParticle { 0%{opacity:0;transform:translate(-50%,-50%) scale(0.5)} 20%{opacity:1} 100%{opacity:0} }
      `}</style>

      <div style={{ position: 'relative', textAlign: 'center', color: '#fff', padding: '0 24px', width: '100%', maxWidth: 380 }}>
        {/* ── Визуал сундука: 3D или emoji-фолбэк ── */}
        <div style={{ position: 'relative', width: '100%' }}>
          {!useFallback ? (
            <Chest3D open={open} onOpened={() => setRevealed(true)} onFailed={() => setUseFallback(true)} />
          ) : (
            <div style={{ position: 'relative', height: H, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {!open ? (
                <div style={{ fontSize: 110, lineHeight: 1, animation: 'rcChestIdle 1.6s ease-in-out infinite', filter: 'drop-shadow(0 0 24px rgba(251,191,36,0.5))' }}>📦</div>
              ) : (
                <>
                  <div style={{ position: 'absolute', top: '50%', left: '50%', width: 280, height: 280, transform: 'translate(-50%,-50%)', borderRadius: '50%', background: 'radial-gradient(circle, rgba(251,191,36,0.45), transparent 70%)', animation: 'rcGlow 0.5s ease-out both', pointerEvents: 'none' }} />
                  {PARTICLES.map((p, i) => (
                    <span key={i} style={{
                      position: 'absolute', top: '50%', left: '50%', fontSize: 18, pointerEvents: 'none',
                      animation: `rcParticle 1.1s ${p.delay}s ease-out forwards`,
                      transform: `translate(calc(-50% + ${Math.cos(p.angle) * p.dist}px), calc(-50% + ${Math.sin(p.angle) * p.dist}px))`,
                    }}>{p.emoji}</span>
                  ))}
                </>
              )}
            </div>
          )}

          {/* Прозрачная кнопка-тап поверх сундука, пока закрыт */}
          {!open && (
            <button
              onClick={handleOpen}
              style={{ position: 'absolute', inset: 0, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 8 }}
            >
              <span style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 16, color: '#fbbf24' }}>Нажми, чтобы открыть</span>
            </button>
          )}
        </div>

        {/* ── Reveal награды (CSS-оверлей) ── */}
        {revealed && (
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: -8 }}>
            <div style={{ position: 'relative', animation: 'rcReveal 0.5s 0.05s ease-out both' }}>
              {isAch
                ? <AchievementBadge ach={item.ach} earnedLevel={item.level?.level || 1} />
                : <div style={{ fontSize: 64, lineHeight: 1 }}>{item.quest?.icon || '⚡'}</div>}
            </div>

            <div style={{ marginTop: 12, animation: 'rcReveal 0.5s 0.2s ease-out both' }}>
              <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 22 }}>{title}</div>
              {subtitle && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>{subtitle}</div>}
              {crystals > 0 && (
                <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 20, color: '#a78bfa', marginTop: 10 }}>
                  +{crystals} 💎
                </div>
              )}
            </div>

            <button
              onClick={onClose}
              style={{ marginTop: 22, background: '#fbbf24', color: '#0f172a', border: 'none', borderRadius: 12, padding: '12px 40px', fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 16, cursor: 'pointer', animation: 'rcReveal 0.5s 0.35s ease-out both' }}
            >
              Забрать
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
