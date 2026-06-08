import React, { useEffect, useRef, useState } from 'react';
import { loadThree, loadThreeGLTF } from '../lib/loadThree.js';
import LegoCharacter3D, { makeEnvCube } from './LegoCharacter3D.jsx';
import { OUTFIT_SETS, OUTFIT_EQUIPMENT_SETS, loadOutfitModel } from '../lib/outfitSets.js';

// 3D-персонаж ученика на GLTF-моделях (Quaternius, CC0, poly.pizza) — замена
// Lego-минифигурки. Фаза 1: интеграция моделей + выбор пола; экипировка пока
// рендерится по старым Lego-координатам (фаза 2 — привязка к костям скелета).
//
// Модели: public/models/character_male.glb / character_female.glb.
// Скелет + встроенные анимации; idle проигрывается через AnimationMixer.
// Кеш GLB — на уровне модуля (загрузка один раз), экземпляры клонируются через
// THREE.SkeletonUtils.clone (фолбэк — scene.clone(true)).
//
// АНИМАЦИИ (проверено загрузкой, длительности в сек):
//   male (HumanArmature|…): 0 Man_Clapping 1.7 · 1 Man_Death 2.1 · 2 Man_Idle 4.2 ·
//     3 Man_Jump 1.0 · 4 Man_Punch 0.9 · 5 Man_Run 0.9 · 6 Man_RunningJump 1.25 ·
//     7 Man_Sitting 8.3 · 8 Man_Standing 0.8 · 9 Man_SwordSlash 1.0 · 10 Man_Walk 1.0
//   female (Armature|…): 0 Death 2.6 · 1 Idle 8.3 · 2 Jump 2.6 · 3 Jump2 1.0 ·
//     4 PickUp 6.0 · 5 Punch 1.0 · 6 Running 0.7 · 7 SitIdle 6.4 · 8 Sitting 4.4 ·
//     9 Walking 1.2
//
// КОСТИ (фаза 2 — привязка экипировки):
//   male: Bone, Body, Hips, Abdomen, Torso, Neck, Head, Shoulder/UpperArm/
//     LowerArm/Palm/MiddleHand/Fingers/Thumb1-2 (L/R), UpperLeg/LowerLeg/Foot (L/R), PoleTarget (L/R)
//   female (Mixamo-схема): Hips, Spine/1/2, Neck, Head, HeadTop_End,
//     Left/Right Shoulder-Arm-ForeArm-Hand (+Thumb1-4, Index1-4),
//     Left/Right UpLeg-Leg-Foot-ToeBase-Toe_End
//
// Props (совместимы с LegoCharacter3D + новое):
//   gender: 'male' | 'female' (default 'male')
//   equipped / tryOn: слоты экипировки (tryOn приоритетнее, как в магазине)
//   height, autoSpin — как раньше; shirtColor/pantsColor для GLTF игнорируются
//   animation: имя клипа (default 'idle' — ищется по имени, иначе эвристика)
//
// Фолбэк: при ошибке загрузки Three/GLTF — старая Lego-фигурка (LegoCharacter3D).

const MODEL_URLS = {
  male: '/models/character_male.glb',
  female: '/models/character_female.glb',
};
const SLOTS = ['helmet', 'top', 'bottom', 'boots'];
const TARGET_HEIGHT = 2.62; // мировая высота персонажа ≈ Lego-фигурка (2.7 со шипом)

// ── Кеш загруженных GLB (промисы — повторные mount'ы не грузят заново) ──
const _modelCache = {};

export function loadCharacterModel(gender) {
  const g = MODEL_URLS[gender] ? gender : 'male';
  if (_modelCache[g]) return _modelCache[g];
  _modelCache[g] = loadThreeGLTF().then((THREE) => new Promise((resolve, reject) => {
    new THREE.GLTFLoader().load(
      MODEL_URLS[g],
      (gltf) => {
        // Материалы: glTF без metallicFactor даёт metalness=1 → без env-карты
        // модель выглядит тёмной и «блестящей». Приводим к матовому виду как в
        // оригинале poly.pizza (текстуры НЕ трогаем — только PBR-параметры).
        // Делается один раз на кеш — все клоны делят материалы.
        gltf.scene.traverse((o) => {
          const m = o.material;
          if (!m) return;
          (Array.isArray(m) ? m : [m]).forEach((mm) => {
            if (mm.metalness !== undefined && mm.metalness > 0.15) mm.metalness = 0.05;
            if (mm.roughness !== undefined && mm.roughness < 0.8) mm.roughness = 0.85;
            mm.needsUpdate = true;
          });
        });
        resolve({ THREE, gltf });
      },
      undefined,
      (e) => reject(e || new Error('GLB load failed')),
    );
  })).catch((e) => { delete _modelCache[g]; throw e; });
  return _modelCache[g];
}

// Независимый экземпляр сцены модели (своя поза/миксер).
export function cloneCharacterScene(THREE, gltf) {
  return THREE.SkeletonUtils ? THREE.SkeletonUtils.clone(gltf.scene) : gltf.scene.clone(true);
}

// Выбор клипа: по имени (idle и т.п.); для безымянных клипов мужской модели —
// эвристика Quaternius-паков (алфавитный экспорт: [0]=Death, [1]=Idle).
// Выбор клипа: wanted — паттерны через «|» В ПОРЯДКЕ ПРИОРИТЕТА (а не просто
// regex-альтернативы). Базовые модели и наряды называют клипы по-разному
// (Man_Jump / Jump / Wave), поэтому реакции передают цепочку фолбэков.
export function pickClip(animations, wanted = 'idle') {
  if (!animations || !animations.length) return null;
  // У нарядов обычный Idle — «шаговая» поза; Idle_Neutral симметричнее.
  const chain = /^idle$/i.test(wanted) ? 'idle_neutral|idle' : String(wanted);
  for (const w of chain.split('|')) {
    const re = new RegExp(w, 'i');
    const byName = animations.find((a) => re.test(a.name || ''));
    if (byName) return byName;
  }
  if (/idle/i.test(chain)) return animations[1] || animations[0];
  return animations[0];
}

// Нормализация: масштаб к TARGET_HEIGHT, ноги на y=0, центр по X/Z.
export function normalizeCharacter(THREE, sceneRoot) {
  const box = new THREE.Box3().setFromObject(sceneRoot);
  const size = new THREE.Vector3(); box.getSize(size);
  const s = size.y > 0 ? TARGET_HEIGHT / size.y : 1;
  sceneRoot.scale.setScalar(s);
  const box2 = new THREE.Box3().setFromObject(sceneRoot);
  const center = new THREE.Vector3(); box2.getCenter(center);
  sceneRoot.position.x -= center.x;
  sceneRoot.position.z -= center.z;
  sceneRoot.position.y -= box2.min.y;
  return s;
}

// Включить тени на всех мешах модели.
export function enableShadows(sceneRoot) {
  sceneRoot.traverse((o) => { if (o.isMesh || o.isSkinnedMesh) { o.castShadow = true; } });
}

// Зум камеры: [мин (крупный план лица), макс (вся фигура с запасом), дефолт]
const ZOOM_MIN = 2.5, ZOOM_MAX = 6.0, ZOOM_DEF = 4.35;

export default function Character3D({ gender = 'male', equipped = {}, tryOn = {}, height = 380, autoSpin = 0.15, animation = 'idle', zoomable = false, zoomBottom = 10, shirtColor, pantsColor }) {
  const mountRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const autoSpinRef = useRef(autoSpin); autoSpinRef.current = autoSpin;
  const apiRef = useRef(null);
  const zoomApiRef = useRef(null); // (delta) => зум кнопками [+]/[−]
  const animApiRef = useRef(null); // (name) => сменить анимацию без пересоздания сцены

  const resolved = {};
  SLOTS.forEach((s) => { resolved[s] = (tryOn && tryOn[s]) || (equipped && equipped[s]) || null; });
  const resolvedKey = SLOTS.map((s) => resolved[s] || '-').join('|');

  // ── ПОЛНЫЙ СЕТ → подмена модели целиком. Наряд-модель уже содержит
  // персонажа в костюме; извлечение частей даёт глитчи (тело просвечивает,
  // пропорции). Частичная/смешанная экипировка → базовая модель без визуала
  // (HP-бонусы считаются как раньше в computePlayerHp). ──
  const equippedIds = SLOTS.map((s) => resolved[s]).filter(Boolean);
  const fullSetKey = Object.entries(OUTFIT_EQUIPMENT_SETS).find(([, set]) =>
    set.gender === gender && set.items.length > 0 && set.items.every((id) => equippedIds.includes(id))
  )?.[0] || null;

  useEffect(() => {
    let renderer, scene, camera, frameId, clock, ro, mixer;
    let cancelled = false;
    const mount = mountRef.current;
    if (!mount) return;
    setLoading(true);
    const geos = [], mats = [], texs = [];
    const drag = { active: false, lastX: 0, targetRotY: 0.3 };
    let cleanupPointer = null;

    // Источник модели: полный сет → GLB наряда (свои анимации), иначе базовая
    const modelPromise = fullSetKey
      ? loadOutfitModel(OUTFIT_SETS[fullSetKey].file)
      : loadCharacterModel(gender);

    Promise.all([modelPromise, loadThree()]).then(([{ THREE, gltf }]) => {
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
      // Камера близко: персонаж занимает ~80-85% высоты кадра (подиум виден,
      // но не доминирует). При zoomable z управляется зумом (lerp в animate).
      camera.position.set(0, 1.5, ZOOM_DEF);
      camera.lookAt(0, 1.22, 0);
      // Зум: target/current для плавного lerp; lookAt подстраивается — при
      // приближении смотрим выше (на лицо), при отдалении — на центр тела.
      const zoom = { target: ZOOM_DEF, current: ZOOM_DEF };
      const clampZoom = (v) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v));
      zoomApiRef.current = (d) => { zoom.target = clampZoom(zoom.target + d); };
      // Вертикальный pan: смещение камеры и точки взгляда по Y (рассмотреть
      // ноги/голову при зуме). ПКМ или Shift+ЛКМ; на таче — два пальца
      // вертикально. lookAt клампится в [0.0 (ступни), 2.5 (макушка)] в animate.
      const pan = { target: 0, current: 0 };
      const clampPan = (v) => Math.max(-1.5, Math.min(1.35, v));
      const panState = { active: false, lastY: 0 };

      const env = makeEnvCube(THREE); texs.push(env);
      // Мягкое яркое освещение: высокий ambient + умеренный key — тёплая кожа
      // и матовая одежда как в оригинале, читается в light и dark.
      scene.add(new THREE.AmbientLight(0xffffff, 0.95));
      const keyL = new THREE.DirectionalLight(0xffffff, 0.95); keyL.position.set(4, 8, 6);
      keyL.castShadow = true; keyL.shadow.mapSize.set(1024, 1024);
      Object.assign(keyL.shadow.camera, { left: -4, right: 4, top: 6, bottom: -2, near: 0.5, far: 30 });
      scene.add(keyL);
      const fill = new THREE.DirectionalLight(0xbfd0ff, 0.5); fill.position.set(-4, 2, 3); scene.add(fill);

      // Подиум + тень (как в Lego-версии)
      const podiumMat = new THREE.MeshStandardMaterial({ color: 0xb8c0d0, metalness: 0.9, roughness: 0.2, envMap: env, envMapIntensity: 1.4 }); mats.push(podiumMat);
      const baseGeo = new THREE.CylinderGeometry(1.0, 1.12, 0.25, 40); geos.push(baseGeo);
      const base = new THREE.Mesh(baseGeo, podiumMat); base.position.y = -0.245; base.castShadow = true; base.receiveShadow = true; scene.add(base);
      const discGeo = new THREE.CylinderGeometry(0.85, 0.85, 0.12, 40); geos.push(discGeo);
      const disc = new THREE.Mesh(discGeo, podiumMat); disc.position.y = -0.06; disc.receiveShadow = true; scene.add(disc);
      const groundGeo = new THREE.PlaneGeometry(20, 20); groundGeo.rotateX(-Math.PI / 2); geos.push(groundGeo);
      const groundMat = new THREE.ShadowMaterial({ opacity: 0.22 }); mats.push(groundMat);
      const ground = new THREE.Mesh(groundGeo, groundMat); ground.position.y = -0.001; ground.receiveShadow = true; scene.add(ground);

      // ── Персонаж: клон GLTF-сцены + idle-анимация ──
      const charGroup = new THREE.Group();
      scene.add(charGroup);
      const model = cloneCharacterScene(THREE, gltf);
      normalizeCharacter(THREE, model);
      enableShadows(model);
      charGroup.add(model);

      if (gltf.animations && gltf.animations.length) {
        mixer = new THREE.AnimationMixer(model);
        let curAction = null;
        // Смена клипа crossfade'ом — без пересоздания сцены (реакции на ответ
        // в ежедневных задачах: jump / hit, потом обратно в idle).
        const playAnim = (name) => {
          const clip = pickClip(gltf.animations, name);
          if (!clip) return;
          const next = mixer.clipAction(clip);
          if (curAction === next) { next.reset(); return; }
          next.reset();
          if (!/idle|walk|run/i.test(name)) { next.setLoop(THREE.LoopOnce, 1); next.clampWhenFinished = true; }
          else { next.setLoop(THREE.LoopRepeat, Infinity); next.clampWhenFinished = false; }
          next.play();
          if (curAction) { curAction.crossFadeTo(next, 0.22, false); }
          curAction = next;
        };
        playAnim(animation);
        mixer.update(0);
        animApiRef.current = playAnim;
      }
      // Экипировка-визуал: ПОЛНЫЙ сет уже отрисован подменой модели (наряд
      // содержит персонажа в костюме); частичная/смешанная — базовая модель.
      apiRef.current = { rebuild: () => {}, dispose: () => {} };

      // Drag-вращение (как в Lego-версии) + зум (wheel / pinch двумя пальцами)
      const el = renderer.domElement;
      el.style.touchAction = 'none'; el.style.cursor = 'grab';
      const down = (x) => { drag.active = true; drag.lastX = x; el.style.cursor = 'grabbing'; };
      const move = (x) => { if (!drag.active) return; drag.targetRotY += (x - drag.lastX) * 0.01; drag.lastX = x; };
      const up = () => { drag.active = false; panState.active = false; el.style.cursor = 'grab'; };
      const onPD = (e) => {
        // ПКМ или Shift+ЛКМ → вертикальный pan (только zoomable)
        if (zoomable && (e.button === 2 || e.shiftKey)) {
          panState.active = true; panState.lastY = e.clientY;
          el.style.cursor = 'ns-resize';
          e.preventDefault();
          return;
        }
        down(e.clientX);
      };
      const onPM = (e) => {
        if (panState.active) {
          // мышь вниз → взгляд выше (контент следует за курсором)
          pan.target = clampPan(pan.target + (e.clientY - panState.lastY) * 0.008);
          panState.lastY = e.clientY;
          return;
        }
        move(e.clientX);
      };
      const onCtx = (e) => { if (zoomable) e.preventDefault(); }; // ПКМ занята pan'ом
      const onDbl = () => { if (zoomable) { zoom.target = ZOOM_DEF; pan.target = 0; } }; // сброс камеры
      const pinchDist = (e) => Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const pinchMidY = (e) => (e.touches[0].clientY + e.touches[1].clientY) / 2;
      let lastPinch = 0, lastMidY = 0;
      const onTS = (e) => {
        if (zoomable && e.touches.length === 2) { lastPinch = pinchDist(e); lastMidY = pinchMidY(e); drag.active = false; return; }
        if (e.touches[0]) down(e.touches[0].clientX);
      };
      const onTM = (e) => {
        if (zoomable && e.touches.length === 2) {
          // два пальца: развод → зум, синхронное вертикальное движение → pan
          const d = pinchDist(e), my = pinchMidY(e);
          zoom.target = clampZoom(zoom.target - (d - lastPinch) * 0.012);
          pan.target = clampPan(pan.target + (my - lastMidY) * 0.008);
          lastPinch = d; lastMidY = my;
          e.preventDefault();
          return;
        }
        if (e.touches[0]) { move(e.touches[0].clientX); e.preventDefault(); }
      };
      const onWheel = (e) => {
        if (!zoomable) return;
        e.preventDefault(); // не скроллить страницу под канвасом
        zoom.target = clampZoom(zoom.target + e.deltaY * 0.0035); // вверх → ближе
      };
      el.addEventListener('pointerdown', onPD);
      window.addEventListener('pointermove', onPM);
      window.addEventListener('pointerup', up);
      el.addEventListener('touchstart', onTS, { passive: true });
      el.addEventListener('touchmove', onTM, { passive: false });
      window.addEventListener('touchend', up);
      el.addEventListener('wheel', onWheel, { passive: false });
      el.addEventListener('contextmenu', onCtx);
      el.addEventListener('dblclick', onDbl);
      cleanupPointer = () => {
        el.removeEventListener('pointerdown', onPD);
        window.removeEventListener('pointermove', onPM);
        window.removeEventListener('pointerup', up);
        el.removeEventListener('touchstart', onTS);
        el.removeEventListener('touchmove', onTM);
        window.removeEventListener('touchend', up);
        el.removeEventListener('wheel', onWheel);
        el.removeEventListener('contextmenu', onCtx);
        el.removeEventListener('dblclick', onDbl);
      };

      ro = new ResizeObserver(() => { if (!renderer || !mount) return; W = mount.clientWidth || W; renderer.setSize(W, height); camera.aspect = W / height; camera.updateProjectionMatrix(); });
      ro.observe(mount);

      setLoading(false);

      clock = new THREE.Clock();
      let last = 0;
      const animate = () => {
        frameId = requestAnimationFrame(animate);
        const t = clock.getElapsedTime();
        const dt = Math.min(t - last, 0.05); last = t;
        if (mixer) mixer.update(dt);
        // авто-вращение + drag (во время drag/pan авто-вращение на паузе)
        if (!drag.active && !panState.active) drag.targetRotY += autoSpinRef.current * dt;
        charGroup.rotation.y += (drag.targetRotY - charGroup.rotation.y) * 0.12;
        // зум: плавный lerp z; взгляд скользит от лица (близко) к центру тела (далеко)
        zoom.current += (zoom.target - zoom.current) * 0.12;
        camera.position.z = zoom.current;
        // pan: камера и точка взгляда смещаются по Y вместе (без наклона)
        pan.current += (pan.target - pan.current) * 0.12;
        camera.position.y = 1.5 + pan.current;
        const zt = (zoom.current - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN);
        const lookY = Math.max(0.0, Math.min(2.5, 2.05 - zt * 0.88 + pan.current));
        camera.lookAt(0, lookY, 0); // 2.5→лицо · 6.0→центр тела · pan сдвигает в [0, 2.5]
        renderer.render(scene, camera);
      };
      animate();
    }).catch((e) => {
      console.warn('[character3d] load failed → Lego fallback:', e?.message || e);
      if (!cancelled) setFailed(true);
    });

    return () => {
      cancelled = true;
      if (frameId) cancelAnimationFrame(frameId);
      if (ro) ro.disconnect();
      if (cleanupPointer) cleanupPointer();
      animApiRef.current = null;
      if (mixer) { mixer.stopAllAction(); mixer.uncacheRoot(mixer.getRoot()); }
      if (apiRef.current) { apiRef.current.dispose && apiRef.current.dispose(); apiRef.current = null; }
      // Геометрии/материалы/текстуры КЛОНА модели (кеш-оригинал не трогаем —
      // клоны делят geometry/material с оригиналом, dispose сломал бы кеш;
      // поэтому чистим только созданное этим компонентом).
      geos.forEach((g) => g.dispose && g.dispose());
      mats.forEach((m) => m.dispose && m.dispose());
      texs.forEach((tx) => tx.dispose && tx.dispose());
      if (renderer) {
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
        renderer.dispose();
        if (renderer.forceContextLoss) renderer.forceContextLoss();
      }
    };
    // Пересоздание сцены при смене пола/высоты/наряда; смена анимации —
    // без пересоздания (эффект ниже, через animApiRef).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gender, height, fullSetKey]);

  // Реакции (jump/hit/...) и возврат в idle — плавный crossfade на живой сцене.
  useEffect(() => { animApiRef.current?.(animation); }, [animation]);

  // Фолбэк: GLTF недоступен → старая Lego-фигурка (полная совместимость).
  if (failed) return <LegoCharacter3D shirtColor={shirtColor} pantsColor={pantsColor} equipped={equipped} tryOn={tryOn} height={height} autoSpin={autoSpin} />;

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <div ref={mountRef} style={{ width: '100%', height }} />
      {loading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: '#94a3b8' }}>Загрузка героя…</div>
        </div>
      )}
      {/* Кнопки зума [+]/[−] — полупрозрачные, в углу (только zoomable) */}
      {zoomable && !loading && (
        <div style={{ position: 'absolute', right: 10, bottom: zoomBottom, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[['+', -0.5], ['−', 0.5]].map(([label, d]) => (
            <button key={label} onClick={() => zoomApiRef.current?.(d)} aria-label={label === '+' ? 'Приблизить' : 'Отдалить'}
              style={{
                width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', lineHeight: 1,
                background: 'rgba(15,23,42,0.45)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)',
                fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                backdropFilter: 'blur(2px)',
              }}>{label}</button>
          ))}
        </div>
      )}
    </div>
  );
}
