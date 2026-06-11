import React, { useEffect, useRef, useState } from 'react';
import { loadThree } from '../lib/loadThree.js';
import { makeEnvCube } from './Boss3D.jsx';

// Космический грузовой зонд с доставкой дроном — награда на экране «Миссия
// выполнена!» (заменяет сундук: космо-тема Ad Astra Per Aspera). Three.js r128
// UMD с CDN, только примитивы — тот же подход, что Boss3D/BattleScene3D.
//
// Таймлайн сцены (~5.5 сек до готовности):
//   1) ДОСТАВКА (2с)  — дрон-квадрокоптер влетает сверху-справа, капсула на тросе
//   2) СБРОС (1с)     — трос отцепляется, зонд падает с гравитацией, пыль при ударе,
//                       дрон качается от отдачи
//   3) ОТЛЁТ (1.5с)   — дрон улетает влево-вверх, уменьшаясь; пропеллеры замедляются;
//                       зонд докачивается → onLanded (родитель показывает кнопку)
//   4) ОТКРЫТИЕ (по клику, ~1.5с) — створка откидывается, свет изнутри нарастает,
//                       кристаллы вылетают с физикой → onOpenComplete
//
// Props:
//   tier:  'standard' | 'silver' | 'gold' — материалы корпуса и интенсивность лута
//   state: 'delivering' | 'open' — фаза родителя; переход на 'open' запускает
//          открытие (внутренняя машина сама проходит delivery→drop→flyaway→landed)
//   freeze: null | 'delivery' | 'landed' | 'open' — статичные позы для
//          debug-скриншотов (дрон завис с грузом / зонд на площадке / зонд открыт)
//   onLanded, onOpenComplete — колбэки фаз
//   fallback — JSX без WebGL
//
// Один WebGL-контекст, полный dispose при unmount.

const TIERS = {
  standard: {
    body:  { color: 0x9aa3ad, metal: 0.55, rough: 0.7 },
    stripe: 0xf97316,                  // оранжевая маркировка
    inner: 0xffc966, innerI: 1.7,      // тёплое жёлтое свечение
    gems: false, particles: 18, sparks: 0,
  },
  silver: {
    body:  { color: 0xc7d2e0, metal: 0.72, rough: 0.28 },
    stripe: 0x38bdf8,                  // голубая маркировка
    inner: 0xdff1ff, innerI: 2.5,      // холодный белый
    gems: false, particles: 22, sparks: 0,
  },
  gold: {
    body:  { color: 0xe6b422, metal: 0.85, rough: 0.15 },
    stripe: 0xfff1b8,
    inner: 0xffd24a, innerI: 3.4,      // легендарная награда
    gems: true, particles: 32, sparks: 70,
  },
};

// Геометрия сцены: площадка y=0..0.09, лежащая капсула R=0.5 → центр y≈0.62.
const PROBE_REST_Y = 0.62;
const DRONE_HOVER = { x: 0, y: 2.55 };
const CABLE_LEN = 0.78;
// Центр капсулы при висе на тросе: низ дрона (−0.07) − трос − радиус.
const PROBE_HANG_DY = 0.07 + CABLE_LEN + 0.5;

export default function ProbeScene3D({ tier = 'standard', state = 'delivering', freeze = null, skipDelivery = false, onLanded, onOpenComplete, fallback = null, width = 360, height = 280 }) {
  const mountRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const stateRef = useRef(state); stateRef.current = state;
  const freezeRef = useRef(freeze); freezeRef.current = freeze;
  const onLandedRef = useRef(onLanded); onLandedRef.current = onLanded;
  const onCompleteRef = useRef(onOpenComplete); onCompleteRef.current = onOpenComplete;

  // Фолбэк без WebGL: анимаций нет — сразу сообщаем фазы, чтобы родитель
  // показал кнопку и «+N 💎».
  useEffect(() => {
    if (!failed) return;
    if (state === 'delivering') onLandedRef.current?.();
    if (state === 'open') onCompleteRef.current?.();
  }, [failed, state]);

  useEffect(() => {
    let renderer, scene, camera, frameId, clock, ro;
    let cancelled = false;
    const mount = mountRef.current;
    if (!mount) return;
    const geos = [], mats = [], texs = [];
    const T = TIERS[tier] || TIERS.standard;

    loadThree().then((THREE) => {
      if (cancelled || !mount) return;
      let W = mount.clientWidth || width;

      try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
      catch (e) { if (!cancelled) setFailed(true); return; }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(W, height);
      mount.appendChild(renderer.domElement);

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(38, W / height, 0.1, 100);
      // Чуть сверху: виден и полёт дрона, и капсула на площадке
      camera.position.set(0, 2.6, 5.7);
      camera.lookAt(0, 1.15, 0);

      const env = makeEnvCube(THREE); texs.push(env);

      // ── Освещение ──
      scene.add(new THREE.AmbientLight(0xffffff, 0.42));
      const keyL = new THREE.DirectionalLight(0xffffff, 1.0); keyL.position.set(2.6, 4.4, 3.0); scene.add(keyL);
      const spot = new THREE.SpotLight(0xffffff, 0.5, 20, 0.6, 0.55);
      spot.position.set(0, 3.2, 4.8); scene.add(spot);
      spot.target.position.set(0, 0.7, 0); scene.add(spot.target);
      // Свет ИЗНУТРИ капсулы — нарастает при открытии
      const innerLight = new THREE.PointLight(T.inner, 0, 7);
      innerLight.position.set(0, 1.15, 0); scene.add(innerLight);

      const M = (o) => {
        const m = new THREE.MeshStandardMaterial({
          color: o.color, metalness: o.metal ?? 0.5, roughness: o.rough ?? 0.4,
          envMap: env, envMapIntensity: o.envI ?? 0.9,
          emissive: o.emissive ?? 0x000000, emissiveIntensity: o.emissive ? (o.ei ?? 0.7) : 0,
          transparent: !!o.transparent, opacity: o.opacity ?? 1,
          // DoubleSide для открытых поверхностей (створка): при откинутой крышке
          // видна внутренняя сторона — FrontSide делал бы её невидимой.
          side: o.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
        });
        mats.push(m); return m;
      };
      const add = (parent, geo, mat, x = 0, y = 0, z = 0) => {
        geos.push(geo);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        parent.add(mesh);
        return mesh;
      };

      // ── Посадочная площадка ──
      add(scene, new THREE.CylinderGeometry(1.42, 1.52, 0.09, 28), M({ color: 0x2c3340, metal: 0.7, rough: 0.5 }), 0, 0.045, 0);
      const padRingGeo = new THREE.TorusGeometry(1.26, 0.025, 8, 36); padRingGeo.rotateX(Math.PI / 2);
      const padRing = add(scene, padRingGeo, M({ color: T.stripe, emissive: T.stripe, ei: 0.6, metal: 0.3 }), 0, 0.095, 0);

      // ── Грузовой зонд: лежащая капсула (низ + откидная створка) ──
      const probe = new THREE.Group();
      scene.add(probe);
      const R = 0.5, LEN = 1.45;
      const bodyMat = M(T.body);
      const stripeMat = M({ color: T.stripe, emissive: T.stripe, ei: 0.45, metal: 0.4, rough: 0.35 });
      // Нижняя половина корпуса (после rotateZ исходная половина x<0 уходит вниз)
      const hullGeo = new THREE.CylinderGeometry(R, R, LEN, 24, 1, true, Math.PI, Math.PI);
      hullGeo.rotateZ(Math.PI / 2);
      add(probe, hullGeo, bodyMat, 0, 0, 0);
      // Торцы-полусферы (принадлежат нижней части; створка их перекрывает сверху)
      [-1, 1].forEach((s) => {
        const capGeo = new THREE.SphereGeometry(R, 18, 14);
        const cap = add(probe, capGeo, bodyMat, s * LEN / 2, 0, 0);
        cap.scale.set(0.55, 1, 1); // сплюснутые торцы — форма капсулы
      });
      // Полозья
      [-0.26, 0.26].forEach((z) => add(probe, new THREE.BoxGeometry(1.05, 0.05, 0.09), M({ color: 0x39404c, metal: 0.7, rough: 0.45 }), 0, -R - 0.025, z));
      // Маркировочные полукольца на нижней половине корпуса (верхние — на створке)
      [-0.42, 0.42].forEach((x) => {
        const ringGeo = new THREE.TorusGeometry(R + 0.015, 0.028, 8, 26, Math.PI);
        ringGeo.rotateY(Math.PI / 2); ringGeo.rotateX(Math.PI); // дуга вниз
        add(probe, ringGeo, stripeMat, x, 0, 0);
      });
      // Иллюминатор-сенсор спереди
      add(probe, new THREE.SphereGeometry(0.09, 14, 12), M({ color: 0x0b1220, emissive: 0x22d3ee, ei: 0.8, metal: 0.3, rough: 0.2 }), 0, 0.05, R - 0.02);
      // Светящаяся «начинка» (видна при открытой створке)
      add(probe, new THREE.BoxGeometry(LEN - 0.2, 0.1, R * 1.3), M({ color: T.inner, emissive: T.inner, ei: 0.75, metal: 0.3, rough: 0.4 }), 0, 0.06, 0);
      const heapGeo = new THREE.OctahedronGeometry(0.11); geos.push(heapGeo);
      const heapMat = M({ color: 0x57c8ff, emissive: 0x2da9ff, ei: 0.9, metal: 0.2, rough: 0.2 });
      [[-0.4, 0.05], [0.05, -0.12], [0.45, 0.1]].forEach(([x, z]) => {
        const h = new THREE.Mesh(heapGeo, heapMat); h.position.set(x, 0.16, z); h.rotation.y = x * 3; probe.add(h);
      });
      // Створка: верхний полуцилиндр, pivot на задней продольной кромке.
      // Все её материалы — DoubleSide: при откинутой крышке видна внутренняя
      // сторона (с FrontSide она была бы прозрачной).
      const lidBodyMat = M({ ...T.body, doubleSide: true });
      const lidStripeMat = M({ color: T.stripe, emissive: T.stripe, ei: 0.45, metal: 0.4, rough: 0.35, doubleSide: true });
      const lid = new THREE.Group();
      lid.position.set(0, 0, -R);
      probe.add(lid);
      const lidGeo = new THREE.CylinderGeometry(R + 0.03, R + 0.03, LEN + 0.05, 24, 1, true, 0, Math.PI);
      lidGeo.rotateZ(Math.PI / 2);
      add(lid, lidGeo, lidBodyMat, 0, 0, R);
      // Маркировочные полукольца на створке (открываются вместе с ней)
      [-0.42, 0.42].forEach((x) => {
        const ringGeo = new THREE.TorusGeometry(R + 0.045, 0.028, 8, 26, Math.PI);
        ringGeo.rotateY(Math.PI / 2); // дуга вверх
        add(lid, ringGeo, lidStripeMat, x, 0, R);
      });
      // Кромка створки + захват для троса сверху
      add(lid, new THREE.BoxGeometry(LEN + 0.05, 0.05, 0.1), lidStripeMat, 0, 0, R * 2 + 0.02);
      const hookGeo = new THREE.TorusGeometry(0.07, 0.022, 8, 14, Math.PI);
      add(lid, hookGeo, M({ color: 0x39404c, metal: 0.8, rough: 0.35 }), 0, R + 0.05, R);
      // Самоцветы на створке (gold)
      const gems = [];
      if (T.gems) {
        const gemGeo = new THREE.SphereGeometry(0.06, 12, 10); geos.push(gemGeo);
        [[-0.4, 0xff4455], [0, 0x36d96b], [0.4, 0x3b82f6]].forEach(([x, color]) => {
          const gm = M({ color, metal: 0.3, rough: 0.15, emissive: color, ei: 0.65 });
          const g = new THREE.Mesh(gemGeo, gm);
          g.position.set(x, R - 0.02, R); lid.add(g); gems.push(gm);
        });
      }

      // ── Дрон-курьер (одинаковый для всех тиров) ──
      const drone = new THREE.Group();
      scene.add(drone);
      const droneMat = M({ color: 0x3b424d, metal: 0.8, rough: 0.35 });
      add(drone, new THREE.BoxGeometry(0.52, 0.13, 0.32), droneMat, 0, 0, 0);
      add(drone, new THREE.BoxGeometry(0.2, 0.07, 0.2), M({ color: 0x2a303a, metal: 0.8, rough: 0.3 }), 0, 0.1, 0);
      // Огни статуса
      add(drone, new THREE.SphereGeometry(0.035, 10, 10), M({ color: 0x22c55e, emissive: 0x22c55e, ei: 1 }), 0.2, 0.05, 0.17);
      add(drone, new THREE.SphereGeometry(0.035, 10, 10), M({ color: 0xef4444, emissive: 0xef4444, ei: 1 }), -0.2, 0.05, 0.17);
      // 4 луча + моторы + пропеллеры
      const props = [];
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
        const arm = add(drone, new THREE.BoxGeometry(0.3, 0.03, 0.05), droneMat, sx * 0.32, 0.02, sz * 0.2);
        arm.rotation.y = Math.atan2(sz, sx);
        add(drone, new THREE.CylinderGeometry(0.045, 0.05, 0.07, 10), droneMat, sx * 0.44, 0.05, sz * 0.3);
        const blade = add(drone, new THREE.BoxGeometry(0.34, 0.012, 0.045), M({ color: 0x222831, metal: 0.5, rough: 0.5, transparent: true, opacity: 0.85 }), sx * 0.44, 0.1, sz * 0.3);
        props.push(blade);
      });
      // Трос к зонду
      const cableGeo = new THREE.CylinderGeometry(0.013, 0.013, CABLE_LEN, 8); geos.push(cableGeo);
      const cable = new THREE.Mesh(cableGeo, M({ color: 0x222831, metal: 0.4, rough: 0.6 }));
      cable.position.set(0, -0.07 - CABLE_LEN / 2, 0);
      drone.add(cable);

      // ── Частицы лута (кристаллы) + пыль при ударе ──
      const particles = [];
      let sparks = null, sparkVels = null;
      const crystalGeo = new THREE.OctahedronGeometry(0.085); geos.push(crystalGeo);
      const spawnLoot = (frozen) => {
        for (let i = 0; i < T.particles; i++) {
          const m = M({ color: 0x57c8ff, emissive: 0x2da9ff, ei: 1.1, metal: 0.2, rough: 0.2, transparent: true });
          const p = new THREE.Mesh(crystalGeo, m);
          if (frozen) {
            const a = (i / T.particles) * Math.PI;
            p.position.set(Math.cos(a) * (0.5 + (i % 3) * 0.25), PROBE_REST_Y + 0.55 + Math.sin(a) * (0.6 + (i % 2) * 0.3), ((i % 5) - 2) * 0.13);
            p.rotation.set(i, i * 0.7, 0);
          } else {
            p.position.set((Math.random() - 0.5) * 1.0, PROBE_REST_Y + 0.15, (Math.random() - 0.5) * 0.5);
          }
          scene.add(p);
          particles.push({
            mesh: p, mat: m, frozen: !!frozen, kind: 'loot', born: clock ? clock.getElapsedTime() : 0,
            vel: new THREE.Vector3((Math.random() - 0.5) * 1.7, 2.2 + Math.random() * 1.9, (Math.random() - 0.5) * 1.3),
            rs: (Math.random() - 0.5) * 6,
          });
        }
        if (T.sparks > 0) {
          const pos = new Float32Array(T.sparks * 3);
          sparkVels = [];
          for (let i = 0; i < T.sparks; i++) {
            if (frozen) {
              const a = Math.random() * Math.PI;
              pos[i * 3] = Math.cos(a) * (0.4 + Math.random() * 0.9);
              pos[i * 3 + 1] = PROBE_REST_Y + 0.5 + Math.sin(a) * (0.5 + Math.random() * 0.8);
              pos[i * 3 + 2] = (Math.random() - 0.5) * 0.8;
            } else {
              pos[i * 3] = (Math.random() - 0.5) * 0.8;
              pos[i * 3 + 1] = PROBE_REST_Y + 0.15;
              pos[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
            }
            sparkVels.push(new THREE.Vector3((Math.random() - 0.5) * 2.2, 2.4 + Math.random() * 2.2, (Math.random() - 0.5) * 1.6));
          }
          const sGeo = new THREE.BufferGeometry();
          sGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
          geos.push(sGeo);
          const sMat = new THREE.PointsMaterial({ color: 0xffe28a, size: 0.055, transparent: true, opacity: 1 });
          mats.push(sMat);
          sparks = new THREE.Points(sGeo, sMat);
          sparks.userData = { frozen: !!frozen, born: clock ? clock.getElapsedTime() : 0 };
          scene.add(sparks);
        }
      };
      const dustGeo = new THREE.SphereGeometry(0.03, 8, 8); geos.push(dustGeo);
      const spawnDust = () => {
        for (let i = 0; i < 12; i++) {
          const m = M({ color: 0x8b93a3, metal: 0.1, rough: 0.9, transparent: true });
          const p = new THREE.Mesh(dustGeo, m);
          const a = (i / 12) * Math.PI * 2;
          p.position.set(Math.cos(a) * 0.7, 0.16, Math.sin(a) * 0.55);
          scene.add(p);
          particles.push({
            mesh: p, mat: m, frozen: false, kind: 'dust', born: clock.getElapsedTime(),
            vel: new THREE.Vector3(Math.cos(a) * (1 + Math.random()), 0.5 + Math.random() * 0.6, Math.sin(a) * (1 + Math.random())),
            rs: 0,
          });
        }
      };

      // ── Машина состояний ──
      // delivery → drop → flyaway → landed → opening → open
      const OPEN_ANGLE = -1.75; // ≈ −100°: откинутая створка видна позади капсулы
      const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3);
      const easeInCubic = (p) => p * p * p;
      let phase = 'delivery';
      let phaseT0 = 0;            // старт текущей фазы (clock-время)
      let probeVy = 0;            // скорость падения в drop
      let landedAt = 0;           // для затухающего покачивания
      let lootSpawned = false, completeFired = false, landedFired = false;
      let spinSpeed = 42;         // скорость пропеллеров

      const fz = freezeRef.current;
      if (fz === 'delivery') {
        phase = 'hoverFreeze';
        drone.position.set(DRONE_HOVER.x, DRONE_HOVER.y, 0);
        probe.position.set(0, DRONE_HOVER.y - PROBE_HANG_DY, 0);
      } else if (fz === 'landed') {
        phase = 'landed';
        drone.visible = false;
        probe.position.set(0, PROBE_REST_Y, 0);
        landedFired = true;
      } else if (fz === 'open') {
        phase = 'open';
        drone.visible = false;
        probe.position.set(0, PROBE_REST_Y, 0);
        probe.rotation.y = 0.4;
        lid.rotation.x = OPEN_ANGLE;
        innerLight.intensity = T.innerI;
        spawnLoot(true);
        lootSpawned = true; completeFired = true; landedFired = true;
      } else if (skipDelivery) {
        // Кат-сцена уже доставила зонд дроном → стартуем УЖЕ приземлённым (без
        // повторной доставки) и сразу готовы к открытию. Open-ветка не меняется.
        phase = 'landed'; landedAt = 0;
        drone.visible = false;
        probe.position.set(0, PROBE_REST_Y, 0);
        landedFired = true;
        onLandedRef.current?.();
      } else {
        drone.position.set(3.4, 3.6, 0);
        probe.position.set(3.4, 3.6 - PROBE_HANG_DY, 0);
      }

      ro = new ResizeObserver(() => { if (!renderer || !mount) return; W = mount.clientWidth || W; renderer.setSize(W, height); camera.aspect = W / height; camera.updateProjectionMatrix(); });
      ro.observe(mount);

      clock = new THREE.Clock();
      let last = 0;
      const animate = () => {
        frameId = requestAnimationFrame(animate);
        const t = clock.getElapsedTime();
        const dt = Math.min(t - last, 0.05); last = t;
        const want = stateRef.current;

        // Запрос открытия: из landed — анимация; из ранних фаз (debug) — телепорт
        if (want === 'open' && (phase === 'landed' || phase === 'hoverFreeze' || phase === 'delivery' || phase === 'drop' || phase === 'flyaway')) {
          drone.visible = false;
          probe.position.set(0, PROBE_REST_Y, 0);
          probe.rotation.z = 0;
          if (freezeRef.current) {
            phase = 'open'; lid.rotation.x = OPEN_ANGLE; innerLight.intensity = T.innerI;
            if (!lootSpawned) { spawnLoot(true); lootSpawned = true; }
            completeFired = true;
          } else { phase = 'opening'; phaseT0 = t; }
        }

        // Пропеллеры: всегда крутятся, пока дрон видим
        if (drone.visible) {
          props.forEach((b) => { b.rotation.y += spinSpeed * dt; });
        }

        if (phase === 'hoverFreeze') {
          // Статичный кадр доставки: дрон висит, груз слегка качается
          drone.position.y = DRONE_HOVER.y + Math.sin(t * 2.2) * 0.04;
          probe.position.y = drone.position.y - PROBE_HANG_DY;
          probe.rotation.z = Math.sin(t * 1.8) * 0.05;
        } else if (phase === 'delivery') {
          // Влетает сверху-справа к точке зависания
          const p = Math.min(1, (t - phaseT0) / 2.0);
          const e = easeOutCubic(p);
          drone.position.x = 3.4 + (DRONE_HOVER.x - 3.4) * e;
          drone.position.y = 3.6 + (DRONE_HOVER.y - 3.6) * e + Math.sin(t * 2.4) * 0.04;
          drone.rotation.z = -0.18 * (1 - p);           // наклон в полёте
          probe.position.set(drone.position.x, drone.position.y - PROBE_HANG_DY, 0);
          probe.rotation.z = Math.sin(t * 2.0) * 0.06 + drone.rotation.z * 0.5;
          if (p >= 1) { phase = 'drop'; phaseT0 = t; probeVy = 0; cable.visible = false; }
        } else if (phase === 'drop') {
          // Свободное падение с отскоком; дрон качнулся от сброса
          const tau = t - phaseT0;
          drone.position.y = DRONE_HOVER.y + Math.min(0.16, tau * 0.7) * Math.exp(-tau * 2.2) * 3 + Math.sin(t * 2.4) * 0.04;
          drone.rotation.z = Math.sin(tau * 9) * 0.07 * Math.exp(-tau * 2.5);
          if (probe.position.y > PROBE_REST_Y || probeVy < 0) {
            probeVy -= 6.5 * dt;
            probe.position.y += probeVy * dt;
            if (probe.position.y <= PROBE_REST_Y) {
              probe.position.y = PROBE_REST_Y;
              if (probeVy < -1.2) { probeVy = -probeVy * 0.22; spawnDust(); } // отскок + пыль
              else probeVy = 0;
            }
          }
          probe.rotation.z *= 0.92;
          if (tau > 1.0) { phase = 'flyaway'; phaseT0 = t; }
        } else if (phase === 'flyaway') {
          // Дрон улетает влево-вверх, уменьшаясь; пропеллеры замедляются
          const p = Math.min(1, (t - phaseT0) / 1.5);
          const e = easeInCubic(p);
          drone.position.x = DRONE_HOVER.x + (-3.8 - DRONE_HOVER.x) * e;
          drone.position.y = DRONE_HOVER.y + (4.3 - DRONE_HOVER.y) * e;
          drone.rotation.z = 0.16 * p;
          const s = 1 - 0.55 * p;
          drone.scale.set(s, s, s);
          spinSpeed = 42 - 30 * p;
          // Зонд докачивается после приземления
          probe.rotation.z = Math.sin((t - phaseT0) * 6) * 0.04 * Math.exp(-(t - phaseT0) * 2);
          if (p >= 1) {
            drone.visible = false;
            phase = 'landed'; landedAt = t;
            if (!landedFired) { landedFired = true; onLandedRef.current?.(); }
          }
        } else if (phase === 'landed') {
          // Idle: лёгкий пульс маркировки и кольца площадки
          stripeMat.emissiveIntensity = 0.35 + 0.25 * (0.5 + 0.5 * Math.sin(t * 2.2));
          lidStripeMat.emissiveIntensity = stripeMat.emissiveIntensity;
          probe.rotation.z = Math.sin((t - landedAt) * 6) * 0.03 * Math.exp(-(t - landedAt) * 1.8);
        } else if (phase === 'opening') {
          const p = Math.min(1, (t - phaseT0) / 1.3);
          const c1 = 1.4, c3 = c1 + 1;
          const e = 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); // ease-out-back
          lid.rotation.x = OPEN_ANGLE * e;
          innerLight.intensity = T.innerI * Math.min(1, p * 1.5);
          if (!lootSpawned && p > 0.3) { spawnLoot(false); lootSpawned = true; }
          if (p >= 1 && t - phaseT0 > 1.5) {
            phase = 'open';
            if (!completeFired) { completeFired = true; onCompleteRef.current?.(); }
          }
        } else if (phase === 'open') {
          if (freezeRef.current) probe.rotation.y = 0.4; // статичный ракурс ¾
          else probe.rotation.y += dt * ((Math.PI * 2) / 11);
          innerLight.intensity = T.innerI * (0.85 + 0.15 * Math.sin(t * 2.5));
        }

        // Пульсы: самоцветы (gold) и кольцо площадки
        gems.forEach((gm, i) => { gm.emissiveIntensity = 0.5 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2.6 + i * 2)); });
        padRing.material.emissiveIntensity = 0.45 + 0.25 * (0.5 + 0.5 * Math.sin(t * 1.8));

        // Физика частиц (лут — вверх с гравитацией; пыль — короткий разлёт)
        for (const pt of particles) {
          if (pt.frozen) continue;
          const age = t - pt.born;
          const life = pt.kind === 'dust' ? 0.8 : 2.6;
          pt.vel.y -= (pt.kind === 'dust' ? 2.2 : 4.2) * dt;
          pt.mesh.position.addScaledVector(pt.vel, dt);
          if (pt.rs) { pt.mesh.rotation.x += pt.rs * dt; pt.mesh.rotation.y += pt.rs * 0.7 * dt; }
          pt.mat.opacity = age > life * 0.5 ? Math.max(0, 1 - (age - life * 0.5) / (life * 0.5)) : 1;
          if (age > life) pt.mesh.visible = false;
        }
        if (sparks && !sparks.userData.frozen) {
          const age = t - sparks.userData.born;
          const posAttr = sparks.geometry.getAttribute('position');
          for (let i = 0; i < sparkVels.length; i++) {
            sparkVels[i].y -= 4.2 * dt;
            posAttr.array[i * 3] += sparkVels[i].x * dt;
            posAttr.array[i * 3 + 1] += sparkVels[i].y * dt;
            posAttr.array[i * 3 + 2] += sparkVels[i].z * dt;
          }
          posAttr.needsUpdate = true;
          sparks.material.opacity = age > 1.2 ? Math.max(0, 1 - (age - 1.2) / 1.1) : 1;
          if (age > 2.4) sparks.visible = false;
        }

        renderer.render(scene, camera);
      };
      animate();
    }).catch((e) => { console.warn('[probe3d] three load failed:', e?.message || e); if (!cancelled) setFailed(true); });

    return () => {
      cancelled = true;
      if (frameId) cancelAnimationFrame(frameId);
      if (ro) ro.disconnect();
      geos.forEach((g) => g.dispose && g.dispose());
      mats.forEach((m) => m.dispose && m.dispose());
      texs.forEach((tx) => tx.dispose && tx.dispose());
      if (renderer) {
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
        renderer.dispose();
        if (renderer.forceContextLoss) renderer.forceContextLoss();
      }
    };
    // Пересоздаём сцену только при смене тира; state/freeze живут в ref'ах.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier, height]);

  if (failed) return fallback;
  return <div ref={mountRef} style={{ width: '100%', maxWidth: width, height, margin: '0 auto' }} />;
}
