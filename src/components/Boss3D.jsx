import React, { useEffect, useRef, useState } from 'react';
import { loadThree } from '../lib/loadThree.js';
import { pickClip, cloneCharacterScene } from './Character3D.jsx';
import { BOSSES, bossById, loadBossModel, normalizeBoss } from '../lib/bossConfig.js';
import PixelBoss from './PixelBoss.jsx';

// 3D-боссы на GLB-моделях (public/models/bosses/*.glb), единый загрузчик с
// персонажами (GLTFLoader r128). Idle — встроенная анимация GLB через
// AnimationMixer, иначе программное покачивание (sin, период ~2с, амплитуда 0.1).
// Сохранены: shake при уроне, dim+pulse при низком HP. Фолбэк → PixelBoss.
// buildBossFromGltf переиспользуется в BattleScene3D (общая сцена боя).

// Лёгкий env-cube для металлических бликов (используется и в BattleScene3D).
export function makeEnvCube(THREE) {
  const faces = [];
  for (let i = 0; i < 6; i++) {
    const S = 64;
    const c = document.createElement('canvas'); c.width = c.height = S;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, '#cdd8f0'); g.addColorStop(0.5, '#6b7aa0'); g.addColorStop(1, '#222a40');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    faces.push(c);
  }
  const tex = new THREE.CubeTexture(faces); tex.needsUpdate = true; return tex;
}

// Клонирует GLB-сцену босса в новую Group: материалы клонируются per-instance
// (для dim по HP без порчи кеша), геометрии шарятся с кешем (не диспозить).
// Возвращает { group, dmgMats, mixer, tick, hasAnim }.
export function buildBossFromGltf(THREE, gltf, targetH = 3.0) {
  const group = new THREE.Group();
  const model = cloneCharacterScene(THREE, gltf); // SkeletonUtils.clone (или scene.clone)
  const dmgMats = [];
  model.traverse((o) => {
    if (o.isMesh || o.isSkinnedMesh) {
      o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
      const list = Array.isArray(o.material) ? o.material : [o.material];
      list.forEach((m) => {
        m.userData = m.userData || {};
        m.userData.baseColor = m.color ? m.color.clone() : null;
        m.userData.baseEmis = m.emissiveIntensity ?? 0;
        m.userData.isEmis = !!(m.emissive && (m.emissive.r || m.emissive.g || m.emissive.b));
        dmgMats.push(m);
      });
    }
  });
  normalizeBoss(THREE, model, targetH);
  group.add(model);

  let mixer = null;
  if (gltf.animations && gltf.animations.length) {
    mixer = new THREE.AnimationMixer(model);
    const clip = pickClip(gltf.animations, 'idle');
    if (clip) mixer.clipAction(clip).play();
  }
  const tick = (t, dt) => { if (mixer) mixer.update(dt); };
  group.userData.emisFlicker = true;
  return { group, dmgMats, mixer, tick, hasAnim: !!mixer };
}

// Затемнение/тревожный пульс материалов по проценту HP (0..100).
export function applyBossDamageDim(dmgMats, hpPct, t, emisFlicker = true) {
  const dim = hpPct < 25 ? 0.55 : hpPct < 50 ? 0.78 : 1;
  const lowPulse = hpPct < 25 ? (0.6 + 0.4 * Math.sin(t * 8)) : 1;
  for (const m of dmgMats) {
    if (m.userData?.baseColor && m.color) m.color.copy(m.userData.baseColor).multiplyScalar(dim);
    if (m.userData?.isEmis && emisFlicker) m.emissiveIntensity = m.userData.baseEmis * lowPulse;
  }
}

export default function Boss3D({ bossId = BOSSES[0].id, hpPct = 100, shake = false, height = 150 }) {
  const mountRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const hpRef = useRef(hpPct); hpRef.current = hpPct;
  const shakeRef = useRef(shake); shakeRef.current = shake;
  const boss = bossById(bossId);

  useEffect(() => {
    let renderer, scene, camera, frameId, clock, ro, mixer;
    let cancelled = false;
    const mount = mountRef.current;
    if (!mount) return;
    const texs = [], clonedMats = [];

    Promise.all([loadThree(), loadBossModel(boss.model)]).then(([THREE, { gltf }]) => {
      if (cancelled || !mount) return;
      let W = mount.clientWidth || 180;

      try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
      catch (e) { if (!cancelled) setFailed(true); return; }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(W, height);
      mount.appendChild(renderer.domElement);

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(40, W / height, 0.1, 100);
      camera.position.set(0, 1.7, 5.4);
      camera.lookAt(0, 1.4, 0);

      scene.add(new THREE.AmbientLight(0xffffff, 0.65));
      const keyL = new THREE.DirectionalLight(0xffffff, 1.0); keyL.position.set(3, 5, 6); scene.add(keyL);
      const fill = new THREE.DirectionalLight(0x9bd0ff, 0.4); fill.position.set(-4, 1, 3); scene.add(fill);
      // драматичный красный контровой свет за боссом
      const rim = new THREE.PointLight(0xff5a2b, 0.8, 30); rim.position.set(0, 2.5, -3); scene.add(rim);

      const built = buildBossFromGltf(THREE, gltf);
      mixer = built.mixer;
      clonedMats.push(...built.dmgMats);
      scene.add(built.group);
      const emisFlicker = built.group.userData.emisFlicker;

      ro = new ResizeObserver(() => { if (!renderer || !mount) return; W = mount.clientWidth || W; renderer.setSize(W, height); camera.aspect = W / height; camera.updateProjectionMatrix(); });
      ro.observe(mount);

      clock = new THREE.Clock(); let last = 0;
      const animate = () => {
        frameId = requestAnimationFrame(animate);
        const t = clock.getElapsedTime(); const dt = Math.min(t - last, 0.05); last = t;
        built.tick(t, dt);
        // idle-покачивание: без встроенной анимации — заметнее (sin период ~2с, амп 0.1)
        built.group.position.y = built.hasAnim ? Math.sin(t * 1.3) * 0.04 : Math.sin(t * Math.PI) * 0.1;
        if (shakeRef.current) { built.group.position.x = Math.sin(t * 60) * 0.08; built.group.rotation.z = Math.sin(t * 55) * 0.05; }
        else { built.group.position.x += (0 - built.group.position.x) * 0.3; built.group.rotation.z += (0 - built.group.rotation.z) * 0.3; }
        applyBossDamageDim(built.dmgMats, hpRef.current, t, emisFlicker);
        renderer.render(scene, camera);
      };
      animate();
    }).catch((e) => { console.warn('[boss3d] load failed → PixelBoss:', e?.message || e); if (!cancelled) setFailed(true); });

    return () => {
      cancelled = true;
      if (frameId) cancelAnimationFrame(frameId);
      if (ro) ro.disconnect();
      if (mixer) { mixer.stopAllAction(); try { mixer.uncacheRoot(mixer.getRoot()); } catch { /* noop */ } }
      // Чистим только клонированные per-instance материалы и текстуры; геометрии
      // шарятся с GLB-кешем — не диспозим (как в Character3D).
      clonedMats.forEach((m) => m.dispose && m.dispose());
      texs.forEach((tx) => tx.dispose && tx.dispose());
      if (renderer) {
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
        renderer.dispose();
        if (renderer.forceContextLoss) renderer.forceContextLoss();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bossId, height]);

  if (failed) {
    const legacy = (boss.tier <= 2) ? 'topic' : 'chapter';
    return <PixelBoss type={legacy} hpPct={hpPct} shake={shake} />;
  }
  return <div ref={mountRef} style={{ width: '100%', height }} />;
}
