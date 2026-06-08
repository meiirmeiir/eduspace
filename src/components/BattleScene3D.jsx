import React, { useEffect, useRef, useState } from 'react';
import { loadThree } from '../lib/loadThree.js';
import { buildLego } from './LegoCharacter3D.jsx';
import { loadCharacterModel, cloneCharacterScene, pickClip, normalizeCharacter } from './Character3D.jsx';
import { buildBoss, makeEnvCube, applyBossDamageDim } from './Boss3D.jsx';
import PixelBoss from './PixelBoss.jsx';

// Общая 3D-сцена боя (ОДИН WebGL-контекст): персонаж ученика (слева, GLTF-модель
// по полу; фолбэк — Lego-минифигурка) против босса (справа). При правильном
// ответе персонаж делает выпад и стреляет лазером вправо → попадание трясёт
// босса. При настоящей ошибке — персонаж вздрагивает (встречный выстрел босса).
// Полный cleanup. Фолбэк всей сцены — PixelBoss.

const SLOTS = ['helmet', 'top', 'bottom', 'boots'];
const BOSS_BASE_Y = 1.1;                       // поднимаем босса — ноги на уровне персонажа
const MUZZLE = { x: -1.3, y: 1.5, z: 0.3 };    // точка вылета лазера (рука персонажа)
const TARGET = { x: 1.7, y: 1.15, z: 0 };      // центр босса
const SHOT_TRAVEL = 0.22, SHOT_END = 0.42;     // сек: долёт луча / конец выстрела

function makeGlowCanvas(rgb) {
  const S = 128; const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(0.4, `rgba(${rgb},0.5)`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S); return c;
}

export default function BattleScene3D({ equipped = {}, gender = 'male', bossType = 'ufo', bossHp = 100, attackSeq = 0, hitSeq = 0, height = 190 }) {
  const mountRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const hpRef = useRef(bossHp); hpRef.current = bossHp;
  const attackRef = useRef(attackSeq); attackRef.current = attackSeq;
  const hitRef = useRef(hitSeq); hitRef.current = hitSeq;
  const apiRef = useRef(null);

  const resolved = {}; SLOTS.forEach((s) => { resolved[s] = (equipped && equipped[s]) || null; });
  const resolvedKey = SLOTS.map((s) => resolved[s] || '-').join('|');
  const resolvedRef = useRef(resolved); resolvedRef.current = resolved;
  useEffect(() => { apiRef.current?.rebuild(resolvedRef.current); }, [resolvedKey]);

  useEffect(() => {
    let renderer, scene, camera, frameId, clock, ro, mixer;
    let cancelled = false;
    const mount = mountRef.current;
    if (!mount) return;
    const geos = [], mats = [], texs = [];

    loadThree().then((THREE) => {
      if (cancelled || !mount) return;
      let W = mount.clientWidth || 480;

      try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
      catch (e) { if (!cancelled) setFailed(true); return; }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(W, height);
      mount.appendChild(renderer.domElement);

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(40, W / height, 0.1, 100);
      camera.position.set(0, 1.05, 5.4); camera.lookAt(0, 1.05, 0);

      const env = makeEnvCube(THREE); texs.push(env);
      scene.add(new THREE.AmbientLight(0xffffff, 0.6));
      const keyL = new THREE.DirectionalLight(0xffffff, 1.0); keyL.position.set(3, 6, 6); scene.add(keyL);
      const fill = new THREE.DirectionalLight(0x9bd0ff, 0.4); fill.position.set(-4, 2, 3); scene.add(fill);

      // Персонаж (слева, лицом к боссу): GLTF-модель по полу; пока грузится /
      // при ошибке — Lego-минифигурка (общая группа hero, лазер/выпады едины).
      const hero = new THREE.Group();
      hero.position.set(-1.9, 0, 0); hero.rotation.y = 0.55; // лицом вправо (к боссу)
      scene.add(hero);
      let lego = buildLego(THREE, env, {});
      hero.add(lego.group);
      geos.push(...lego.geos); mats.push(...lego.mats); texs.push(...lego.texs);
      apiRef.current = { rebuild: lego.rebuildEquip, dispose: lego.dispose };
      lego.rebuildEquip(resolvedRef.current);
      let heroKind = 'lego';
      loadCharacterModel(gender).then(({ gltf }) => {
        if (cancelled || !scene) return;
        const model = cloneCharacterScene(THREE, gltf);
        normalizeCharacter(THREE, model);
        hero.remove(lego.group);          // Lego-плейсхолдер убираем (его ресурсы почистит общий cleanup)
        hero.add(model);
        heroKind = 'gltf';
        if (gltf.animations && gltf.animations.length) {
          mixer = new THREE.AnimationMixer(model);
          const clip = pickClip(gltf.animations, 'idle');
          if (clip) mixer.clipAction(clip).play();
        }
        // Экипировка в бою для GLTF — фаза 2 (привязка к костям); сейчас бой
        // показывает чистую модель.
        apiRef.current = { rebuild: () => {}, dispose: lego.dispose };
      }).catch((e) => { console.warn('[battle3d] GLTF hero failed, keep Lego:', e?.message || e); });

      // Босс (справа)
      const boss = buildBoss(THREE, env, bossType);
      boss.group.position.set(1.9, BOSS_BASE_Y, 0); boss.group.scale.setScalar(1.05); boss.group.rotation.y = -0.55; // лицом влево (к персонажу), ноги на уровне
      scene.add(boss.group); geos.push(...boss.geos); mats.push(...boss.mats);
      const bossEmisFlicker = boss.group.userData.emisFlicker;

      // ── Лазер: луч (cylinder) + вспышки (sprites) ──
      const hand = new THREE.Vector3(MUZZLE.x, MUZZLE.y, MUZZLE.z);
      const target = new THREE.Vector3(TARGET.x, TARGET.y, TARGET.z);
      const dir = new THREE.Vector3().subVectors(target, hand);
      const fullLen = dir.length(); dir.normalize();
      const beamGeo = new THREE.CylinderGeometry(0.09, 0.09, 1, 8); geos.push(beamGeo);
      const beamMat = new THREE.MeshBasicMaterial({ color: 0x66f0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }); mats.push(beamMat);
      const beam = new THREE.Mesh(beamGeo, beamMat);
      const beamQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      beam.quaternion.copy(beamQuat); scene.add(beam);
      const glowTex = new THREE.CanvasTexture(makeGlowCanvas('120,240,255')); texs.push(glowTex);
      const muzzleMat = new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }); mats.push(muzzleMat);
      const muzzle = new THREE.Sprite(muzzleMat); muzzle.position.copy(hand); muzzle.scale.set(0.8, 0.8, 1); scene.add(muzzle);
      const hitMat = new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }); mats.push(hitMat);
      const hit = new THREE.Sprite(hitMat); hit.position.copy(target); hit.scale.set(1.3, 1.3, 1); scene.add(hit);
      // встречный выстрел босса (красный) при ошибке
      const cMat = new THREE.MeshBasicMaterial({ color: 0xff5a3c, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }); mats.push(cMat);
      const counter = new THREE.Mesh(beamGeo, cMat); counter.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate()); scene.add(counter);

      ro = new ResizeObserver(() => { if (!renderer || !mount) return; W = mount.clientWidth || W; renderer.setSize(W, height); camera.aspect = W / height; camera.updateProjectionMatrix(); });
      ro.observe(mount);

      clock = new THREE.Clock(); let last = 0, lastBlink = false;
      let lastAttack = attackRef.current, lastHit = hitRef.current;
      let shotStart = null, bossShakeUntil = 0, flinchStart = null;
      const easeOut = (x) => 1 - Math.pow(1 - x, 3);

      const animate = () => {
        frameId = requestAnimationFrame(animate);
        const t = clock.getElapsedTime(); const dt = Math.min(t - last, 0.05); last = t;

        // idle персонажа: GLTF — скелетная анимация через mixer; Lego-фолбэк —
        // прежняя «боевая стойка» (подскоки/дыхание/махи/моргание).
        if (mixer) mixer.update(dt);
        hero.rotation.y = 0.55 + Math.sin(t * 0.8) * 0.07; // лёгкий разворот к боссу
        if (heroKind === 'lego') {
          hero.position.y = Math.abs(Math.sin(t * 1.9)) * 0.06;
          lego.torso.scale.y = 1 + Math.sin(t * 1.2) * 0.03;
          const swing = Math.sin(t * 1.7) * 0.2;
          if (lego.arms[0]) lego.arms[0].rotation.x = swing;
          if (lego.arms[1]) lego.arms[1].rotation.x = -swing;
          const blink = (t % 4) > 3.88;
          if (blink !== lastBlink) { lego.faceMat.map = blink ? lego.faceBlinkTex : lego.faceOpenTex; lego.faceMat.needsUpdate = true; lastBlink = blink; }
        }

        // боссы: idle tick + bob + затемнение по HP
        boss.tick(t, dt);
        boss.group.position.y = BOSS_BASE_Y + Math.sin(t * 1.3) * 0.05;
        applyBossDamageDim(boss.dmgMats, hpRef.current, t, bossEmisFlicker);

        // ── триггеры ──
        if (attackRef.current !== lastAttack) { lastAttack = attackRef.current; shotStart = t; }
        if (hitRef.current !== lastHit) { lastHit = hitRef.current; flinchStart = t; }

        // ── выстрел персонажа ──
        let lunge = 0;
        if (shotStart != null) {
          const e = t - shotStart;
          const travel = Math.min(1, e / SHOT_TRAVEL);
          if (e < SHOT_TRAVEL) { // луч растёт от руки к боссу
            const L = fullLen * travel;
            beam.scale.set(1, L, 1);
            beam.position.copy(hand).addScaledVector(dir, L / 2);
            beamMat.opacity = 0.9;
            muzzleMat.opacity = Math.max(0, 1 - e / 0.12);
            lunge = easeOut(travel) * 0.45;
          } else if (e < SHOT_END) { // попадание: вспышка + гаснет
            if (bossShakeUntil < shotStart + SHOT_TRAVEL) bossShakeUntil = t + 0.4;
            const f = (e - SHOT_TRAVEL) / (SHOT_END - SHOT_TRAVEL);
            beamMat.opacity = 0.9 * (1 - f);
            hitMat.opacity = 1 - f; hit.scale.setScalar(1.0 + f * 0.8);
            lunge = 0.45 * (1 - f);
          } else { beamMat.opacity = 0; muzzleMat.opacity = 0; hitMat.opacity = 0; shotStart = null; }
        }
        hero.position.x = -1.9 + lunge; // выпад вперёд (к боссу)
        if (heroKind === 'lego' && shotStart != null && lego.arms[1]) lego.arms[1].rotation.x += (-1.15 - lego.arms[1].rotation.x) * 0.4; // поднять стреляющую руку к боссу

        // ── boss shake (по попаданию) ──
        if (t < bossShakeUntil) { boss.group.position.x = 1.9 + Math.sin(t * 60) * 0.1; boss.group.rotation.z = Math.sin(t * 55) * 0.06; }
        else { boss.group.position.x += (1.9 - boss.group.position.x) * 0.3; boss.group.rotation.z += (0 - boss.group.rotation.z) * 0.3; }

        // ── ошибка: встречный выстрел босса + вздрагивание персонажа ──
        if (flinchStart != null) {
          const e = t - flinchStart;
          if (e < 0.2) { const L = fullLen * Math.min(1, e / 0.2); counter.scale.set(1, L, 1); counter.position.copy(target).addScaledVector(dir, -L / 2); cMat.opacity = 0.85; }
          else if (e < 0.5) { cMat.opacity = 0.85 * (1 - (e - 0.2) / 0.3); hero.position.x = -1.9 + Math.sin(t * 50) * 0.08; hero.rotation.z = Math.sin(t * 45) * 0.05; }
          else { cMat.opacity = 0; hero.rotation.z += (0 - hero.rotation.z) * 0.3; flinchStart = null; }
        } else if (shotStart == null) { hero.rotation.z += (Math.sin(t * 1.1) * 0.035 - hero.rotation.z) * 0.2; }

        renderer.render(scene, camera);
      };
      animate();
    }).catch((e) => { console.warn('[battle3d] three load failed:', e?.message || e); if (!cancelled) setFailed(true); });

    return () => {
      cancelled = true;
      if (frameId) cancelAnimationFrame(frameId);
      if (ro) ro.disconnect();
      if (mixer) { mixer.stopAllAction(); mixer.uncacheRoot(mixer.getRoot()); }
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
  }, [bossType, height, gender]);

  if (failed) {
    const legacy = (bossType === 'slime' || bossType === 'ufo') ? 'topic' : 'chapter';
    return <div style={{ width: '100%', height, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}><PixelBoss type={legacy} hpPct={bossHp} shake={false} /></div>;
  }
  return <div ref={mountRef} style={{ width: '100%', height }} />;
}
