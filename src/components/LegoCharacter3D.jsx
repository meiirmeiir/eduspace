import React, { useEffect, useRef, useState } from 'react';
import { loadThree } from '../lib/loadThree.js';

// 3D Lego-минифигурка (Three.js r128) из примитивов (боксы/цилиндры со
// скруглением). Idle-дыхание + моргание + авто-вращение/drag. Пластиковый глянец
// (envMap), снаряжение из equipped/tryOn. Полный cleanup. Фолбэк — 2D-силуэт.
// Билдер buildLego вынесен — переиспользуется в BattleScene3D (общая сцена боя).

const H = 380;

export function makeEnvCube(THREE) {
  const faces = [];
  for (let i = 0; i < 6; i++) {
    const S = 64;
    const c = document.createElement('canvas'); c.width = c.height = S;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, '#eef3ff'); g.addColorStop(0.5, '#9fb0d0'); g.addColorStop(1, '#33405c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    faces.push(c);
  }
  const tex = new THREE.CubeTexture(faces); tex.needsUpdate = true; return tex;
}

function roundedRectShape(THREE, w, d, r) {
  const hw = w / 2, hd = d / 2;
  const s = new THREE.Shape();
  s.moveTo(-hw + r, -hd);
  s.lineTo(hw - r, -hd); s.quadraticCurveTo(hw, -hd, hw, -hd + r);
  s.lineTo(hw, hd - r);  s.quadraticCurveTo(hw, hd, hw - r, hd);
  s.lineTo(-hw + r, hd); s.quadraticCurveTo(-hw, hd, -hw, hd - r);
  s.lineTo(-hw, -hd + r); s.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
  return s;
}

function roundedBoxGeo(THREE, w, d, h, r, bevel) {
  bevel = Math.min(bevel, h * 0.3, w * 0.08, d * 0.08);
  r = Math.max(0.01, Math.min(r, w / 2 - bevel - 0.02, d / 2 - bevel - 0.02));
  const shape = roundedRectShape(THREE, w, d, r);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.005, h - bevel * 2),
    bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, steps: 1, curveSegments: 8,
  });
  geo.rotateX(-Math.PI / 2);
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  geo.translate(-(bb.max.x + bb.min.x) / 2, -(bb.max.y + bb.min.y) / 2, -(bb.max.z + bb.min.z) / 2);
  return geo;
}

function makeFaceCanvas(blink) {
  const S = 128;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = '#1a1a1a'; ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 6; ctx.lineCap = 'round';
  if (blink) {
    ctx.beginPath(); ctx.moveTo(40, 52); ctx.lineTo(56, 52); ctx.moveTo(72, 52); ctx.lineTo(88, 52); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.ellipse(48, 50, 6, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(80, 50, 6, 8, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.beginPath(); ctx.arc(64, 70, 20, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  return c;
}

const SLOTS = ['helmet', 'top', 'bottom', 'boots'];

// Строит минифигурку (ТОЛЬКО фигуру + equipGroup, без подиума) в новую Group.
// Возвращает refs для анимации/одежды + rebuildEquip(resolved) + dispose + созданные
// geos/mats/texs (для dispose вызывающим).
export function buildLego(THREE, env, { shirtColor = '#3b82f6', pantsColor = '#3b4a6b' } = {}) {
  const geos = [], mats = [], texs = [];
  const plastic = (col, metal = 0.12, rough = 0.4, ei = 0.5) => { const m = new THREE.MeshStandardMaterial({ color: col, metalness: metal, roughness: rough, envMap: env, envMapIntensity: ei }); mats.push(m); return m; };
  const shirtMat = plastic(shirtColor);
  const pantsMat = plastic(pantsColor);
  const skinMat = plastic(0xf6c945);
  const studMat = plastic(0xf6c945);

  const group = new THREE.Group();
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; group.add(m); return m; };

  const legGeo = roundedBoxGeo(THREE, 0.4, 0.52, 0.85, 0.08, 0.04); geos.push(legGeo);
  add(legGeo, pantsMat, -0.23, 0.425, 0);
  add(legGeo, pantsMat, 0.23, 0.425, 0);
  const hipGeo = roundedBoxGeo(THREE, 0.92, 0.56, 0.30, 0.08, 0.04); geos.push(hipGeo);
  add(hipGeo, pantsMat, 0, 1.0, 0);
  const torsoGeo = new THREE.CylinderGeometry(0.4, 0.5, 0.92, 4); torsoGeo.rotateY(Math.PI / 4); geos.push(torsoGeo);
  const torso = add(torsoGeo, shirtMat, 0, 1.6, 0); torso.scale.set(1.05, 1, 0.72);
  const armGeo = roundedBoxGeo(THREE, 0.26, 0.3, 0.62, 0.07, 0.03); geos.push(armGeo);
  const handGeo = new THREE.TorusGeometry(0.09, 0.04, 8, 16); geos.push(handGeo);
  const arms = []; // [левая, правая] — шарнир в плече (для анимации рук)
  [[-1, -0.64], [1, 0.64]].forEach(([sgn, x]) => {
    const arm = new THREE.Group(); arm.position.set(x, 1.92, 0.14); arm.rotation.z = -sgn * 0.2; group.add(arm);
    arm.userData.baseZ = -sgn * 0.2;
    const upper = new THREE.Mesh(armGeo, shirtMat); upper.position.y = -0.3; upper.castShadow = true; arm.add(upper);
    const hand = new THREE.Mesh(handGeo, skinMat); hand.position.set(0, -0.62, 0.06); hand.castShadow = true; arm.add(hand);
    arms.push(arm);
  });
  const headGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.58, 24); geos.push(headGeo);
  add(headGeo, skinMat, 0, 2.32, 0);
  const studGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.12, 16); geos.push(studGeo);
  add(studGeo, studMat, 0, 2.67, 0);
  const faceOpenTex = new THREE.CanvasTexture(makeFaceCanvas(false)); texs.push(faceOpenTex);
  const faceBlinkTex = new THREE.CanvasTexture(makeFaceCanvas(true)); texs.push(faceBlinkTex);
  const faceMat = new THREE.MeshBasicMaterial({ map: faceOpenTex, transparent: true }); mats.push(faceMat);
  const faceGeo = new THREE.PlaneGeometry(0.62, 0.62); geos.push(faceGeo);
  add(faceGeo, faceMat, 0, 2.34, 0.401);

  // Снаряжение
  const equipGroup = new THREE.Group(); group.add(equipGroup);
  let equipGeos = [], equipMats = [];
  const buildPiece = (p) => {
    let geo;
    if (p.shape === 'box') geo = roundedBoxGeo(THREE, p.w, p.d, p.h, 0.05, 0.025);
    else if (p.shape === 'sphere') geo = new THREE.SphereGeometry(p.r, 20, 16);
    else if (p.shape === 'torus') geo = new THREE.TorusGeometry(p.r, p.tube, 10, 24);
    else if (p.shape === 'cone') geo = new THREE.ConeGeometry(p.r, p.h, 18);
    else geo = new THREE.CylinderGeometry(p.rTop ?? p.r, p.rBottom ?? p.r, p.h, 24);
    if (p.rot4 && p.shape === 'cyl') geo.rotateY(Math.PI / 4);
    const mat = new THREE.MeshStandardMaterial({
      color: p.color, metalness: p.metal ?? 0.4, roughness: p.rough ?? 0.5,
      envMap: env, envMapIntensity: 0.7,
      emissive: p.emissive ?? 0x000000, emissiveIntensity: p.emissive ? (p.ei ?? 0.6) : 0,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(p.x || 0, p.y || 0, p.z || 0);
    if (p.scale) m.scale.set(p.scale[0], p.scale[1], p.scale[2]);
    if (p.flip) m.rotation.x = Math.PI;
    m.castShadow = true;
    equipGroup.add(m); equipGeos.push(geo); equipMats.push(mat);
  };
  const rebuildEquip = () => {
    // Примитивный каталог EQUIPMENT_MODELS удалён (экипировка — GLTF-наряды в
    // Character3D); Lego-фолбэк показывает базовую фигурку без снаряжения.
    equipGeos.forEach((g) => g.dispose && g.dispose());
    equipMats.forEach((mm) => mm.dispose && mm.dispose());
    equipGeos = []; equipMats = [];
    while (equipGroup.children.length) equipGroup.remove(equipGroup.children[0]);
  };
  const dispose = () => { equipGeos.forEach((g) => g.dispose && g.dispose()); equipMats.forEach((mm) => mm.dispose && mm.dispose()); };

  return { group, torso, arms, shirtMat, pantsMat, faceMat, faceOpenTex, faceBlinkTex, equipGroup, rebuildEquip, dispose, geos, mats, texs };
}

export default function LegoCharacter3D({ shirtColor = '#3b82f6', pantsColor = '#3b4a6b', equipped = {}, tryOn = {}, height = H, autoSpin = 0.15 }) {
  const mountRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const shirtRef = useRef(shirtColor); shirtRef.current = shirtColor;
  const pantsRef = useRef(pantsColor); pantsRef.current = pantsColor;
  const autoSpinRef = useRef(autoSpin); autoSpinRef.current = autoSpin;
  const apiRef = useRef(null);

  const resolved = {};
  SLOTS.forEach((s) => { resolved[s] = (tryOn && tryOn[s]) || (equipped && equipped[s]) || null; });
  const resolvedKey = SLOTS.map((s) => resolved[s] || '-').join('|');
  const resolvedRef = useRef(resolved); resolvedRef.current = resolved;

  useEffect(() => { apiRef.current?.rebuild(resolvedRef.current); }, [resolvedKey]);

  useEffect(() => {
    let renderer, scene, camera, frameId, clock, ro;
    let cancelled = false;
    const mount = mountRef.current;
    if (!mount) return;
    const geos = [], mats = [], texs = [];
    const drag = { active: false, lastX: 0, targetRotY: 0.3 };
    let cleanupPointer = null;

    loadThree().then((THREE) => {
      if (cancelled || !mount) return;
      let W = mount.clientWidth || 360;

      try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
      catch (e) { if (!cancelled) setFailed(true); return; }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(W, height);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      mount.appendChild(renderer.domElement);

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(40, W / height, 0.1, 100);
      camera.position.set(0, 1.7, 6.4);
      camera.lookAt(0, 1.15, 0);

      const env = makeEnvCube(THREE); texs.push(env);
      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const keyL = new THREE.DirectionalLight(0xffffff, 1.05); keyL.position.set(4, 8, 6);
      keyL.castShadow = true; keyL.shadow.mapSize.set(1024, 1024);
      Object.assign(keyL.shadow.camera, { left: -4, right: 4, top: 6, bottom: -2, near: 0.5, far: 30 });
      scene.add(keyL);
      const fill = new THREE.DirectionalLight(0xbfd0ff, 0.4); fill.position.set(-4, 2, 3); scene.add(fill);

      // Подиум (статичен) + тень — только в showcase-режиме компонента.
      const podiumMat = new THREE.MeshStandardMaterial({ color: 0xb8c0d0, metalness: 0.9, roughness: 0.2, envMap: env, envMapIntensity: 1.4 }); mats.push(podiumMat);
      const baseGeo = new THREE.CylinderGeometry(1.0, 1.12, 0.25, 40); geos.push(baseGeo);
      const base = new THREE.Mesh(baseGeo, podiumMat); base.position.y = -0.245; base.castShadow = true; base.receiveShadow = true; scene.add(base);
      const discGeo = new THREE.CylinderGeometry(0.85, 0.85, 0.12, 40); geos.push(discGeo);
      const disc = new THREE.Mesh(discGeo, podiumMat); disc.position.y = -0.06; disc.receiveShadow = true; scene.add(disc);
      const groundGeo = new THREE.PlaneGeometry(20, 20); groundGeo.rotateX(-Math.PI / 2); geos.push(groundGeo);
      const groundMat = new THREE.ShadowMaterial({ opacity: 0.22 }); mats.push(groundMat);
      const ground = new THREE.Mesh(groundGeo, groundMat); ground.position.y = -0.37; ground.receiveShadow = true; scene.add(ground);

      // Фигура + снаряжение (вынесенный билдер)
      const lego = buildLego(THREE, env, { shirtColor, pantsColor });
      scene.add(lego.group);
      geos.push(...lego.geos); mats.push(...lego.mats); texs.push(...lego.texs);
      const { group: charGroup, torso, shirtMat, pantsMat, faceMat, faceOpenTex, faceBlinkTex } = lego;
      apiRef.current = { rebuild: lego.rebuildEquip, dispose: lego.dispose };
      lego.rebuildEquip(resolvedRef.current);

      // Drag-вращение
      const el = renderer.domElement;
      el.style.touchAction = 'none'; el.style.cursor = 'grab';
      const down = (x) => { drag.active = true; drag.lastX = x; el.style.cursor = 'grabbing'; };
      const move = (x) => { if (!drag.active) return; drag.targetRotY += (x - drag.lastX) * 0.01; drag.lastX = x; };
      const up = () => { drag.active = false; el.style.cursor = 'grab'; };
      const onPD = (e) => down(e.clientX);
      const onPM = (e) => move(e.clientX);
      const onTS = (e) => { if (e.touches[0]) down(e.touches[0].clientX); };
      const onTM = (e) => { if (e.touches[0]) { move(e.touches[0].clientX); e.preventDefault(); } };
      el.addEventListener('pointerdown', onPD);
      window.addEventListener('pointermove', onPM);
      window.addEventListener('pointerup', up);
      el.addEventListener('touchstart', onTS, { passive: true });
      el.addEventListener('touchmove', onTM, { passive: false });
      window.addEventListener('touchend', up);
      cleanupPointer = () => {
        el.removeEventListener('pointerdown', onPD);
        window.removeEventListener('pointermove', onPM);
        window.removeEventListener('pointerup', up);
        el.removeEventListener('touchstart', onTS);
        el.removeEventListener('touchmove', onTM);
        window.removeEventListener('touchend', up);
      };

      ro = new ResizeObserver(() => { if (!renderer || !mount) return; W = mount.clientWidth || W; renderer.setSize(W, height); camera.aspect = W / height; camera.updateProjectionMatrix(); });
      ro.observe(mount);

      clock = new THREE.Clock(); let last = 0, lastBlink = false;
      const animate = () => {
        frameId = requestAnimationFrame(animate);
        const t = clock.getElapsedTime(); const dt = Math.min(t - last, 0.05); last = t;
        if (shirtMat.color.getHexString() !== shirtRef.current.replace('#', '')) shirtMat.color.set(shirtRef.current);
        if (pantsMat.color.getHexString() !== pantsRef.current.replace('#', '')) pantsMat.color.set(pantsRef.current);
        if (!drag.active) drag.targetRotY += autoSpinRef.current * dt;
        charGroup.rotation.y += (drag.targetRotY - charGroup.rotation.y) * 0.12;
        charGroup.position.y = Math.sin(t * 1.2) * 0.03;
        torso.scale.y = 1 + Math.sin(t * 1.2) * 0.02;
        const blink = (t % 4) > 3.88;
        if (blink !== lastBlink) { faceMat.map = blink ? faceBlinkTex : faceOpenTex; faceMat.needsUpdate = true; lastBlink = blink; }
        renderer.render(scene, camera);
      };
      animate();
    }).catch((e) => { console.warn('[lego3d] three load failed:', e?.message || e); if (!cancelled) setFailed(true); });

    return () => {
      cancelled = true;
      if (frameId) cancelAnimationFrame(frameId);
      if (ro) ro.disconnect();
      if (cleanupPointer) cleanupPointer();
      if (apiRef.current) { apiRef.current.dispose && apiRef.current.dispose(); apiRef.current = null; }
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
  }, [height]);

  if (failed) {
    return (
      <div style={{ width: '100%', height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0, background: 'radial-gradient(ellipse at 50% 40%, #1a2348 0%, #0c1230 70%)', borderRadius: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#f6c945', border: '3px solid #d4a017', position: 'relative' }}>
          <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🙂</span>
        </div>
        <div style={{ width: 70, height: 56, background: shirtColor, borderRadius: '8px 8px 4px 4px', marginTop: 2 }} />
        <div style={{ display: 'flex', gap: 4, marginTop: 1 }}>
          <div style={{ width: 30, height: 46, background: pantsColor, borderRadius: '0 0 4px 4px' }} />
          <div style={{ width: 30, height: 46, background: pantsColor, borderRadius: '0 0 4px 4px' }} />
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: 'rgba(255,255,255,0.5)', fontFamily: "'Inter',sans-serif" }}>3D недоступно</div>
      </div>
    );
  }

  return <div ref={mountRef} style={{ width: '100%', height }} />;
}
