import React, { useEffect, useRef, useState } from 'react';
import { loadThree, loadTypeface } from '../lib/loadThree.js';
import { useTheme } from '../ThemeContext.jsx';
import { FRAME_STYLES } from '../lib/shopItems.js';

// Гибрид-подиум топ-3: 3D-тумбы (Three.js) + CSS-аватары поверх canvas.
// Тумбы металлические (envMap-блики, bumpMap-гравировка номера), мягко
// покачиваются ±15° через sin. Аватары — обычные DOM-узлы; их экранные
// координаты пересчитываются КАЖДЫЙ КАДР проекцией мировой точки верха тумбы
// через камеру (camera.project) → аватары «приклеены» к качающимся тумбам.
// Клик по аватару → onOpenPublicProfile. При сбое Three.js → fallbackRender().

const ACCENT_HEX = ['#fbbf24', '#94a3b8', '#b45309'];   // rank 1/2/3 — для CSS-аватаров/подписей
const METAL_NUM = [0xd4af37, 0x94a3b8, 0xb45309];        // 3D-металл: глубокое золото / серебро / бронза
const VELVET_HEX = 0x4c1d95;                             // пурпурный бархат драпировки
const NUMBER_HEX = 0xf0e6c8;                             // светлый металл цифры (контраст с бархатом)
const FONT_URL = 'https://unpkg.com/three@0.128.0/examples/fonts/helvetiker_bold.typeface.json';
// Ярусы постамента: доли высоты slot.h (сумма = 1) + ширина footprint (мир).
const TIERS = [
  { wf: 2.05, hf: 0.14 },                 // основание (нижняя плита)
  { wf: 1.85, hf: 0.10 },                 // ступень/фаска
  { wf: 1.55, hf: 0.62, column: true },   // основной столб
  { wf: 1.95, hf: 0.14 },                 // карниз (выступ под аватаром)
];
const COLUMN_WF = 1.55;
const SLOTS = [{ x: 0, h: 2.2 }, { x: -2.4, h: 1.5 }, { x: 2.4, h: 1.0 }]; // #1 центр, #2 лево, #3 право
const H = 360;
const SWAY_AMP = 0.26;    // ~15° в радианах
const SWAY_SPEED = 0.5;   // рад/с — медленное престижное покачивание
const initialsOf = (e) => ((e?.firstName?.[0] || '') + (e?.lastName?.[0] || '')).toUpperCase() || '?';

// Тканевый bump-канвас бархата: мягкие вертикальные складки (синус + лёгкий
// шум) в grayscale → рельеф складок ткани.
function makeFabricBumpCanvas() {
  const W = 256, Hc = 512;
  const c = document.createElement('canvas'); c.width = W; c.height = Hc;
  const ctx = c.getContext('2d');
  const folds = 7;
  for (let x = 0; x < W; x++) {
    const base = 128 + 55 * Math.sin((x / W) * folds * Math.PI * 2);
    for (let y = 0; y < Hc; y += 4) {
      const v = Math.max(0, Math.min(255, Math.round(base + (Math.random() - 0.5) * 14)));
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, y, 1, 4);
    }
  }
  return c;
}

// Фолбэк-цифра: светлая цифра на прозрачном фоне (map для плоскости поверх
// бархата) — на случай, если шрифт/аддоны TextGeometry не загрузятся.
function makeNumberFaceCanvas(rank) {
  const S = 256;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, S, S);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = "800 180px 'Montserrat', sans-serif";
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 8;
  ctx.fillStyle = '#f0e6c8';
  ctx.fillText(String(rank), S / 2, S / 2 + 8);
  return c;
}

// Геральдический баннер: скруглённый верх + V-вырез снизу, выдавлен вдоль +Z
// (лицом к камере). Низ shape на y=0 (позиционируется по миру через mesh.y).
function makeBannerGeo(THREE, w, h, depth) {
  const hw = w / 2;
  const r = Math.min(0.08, w * 0.1);
  const notch = h * 0.18;
  const s = new THREE.Shape();
  s.moveTo(-hw, h - r);
  s.lineTo(-hw, 0);
  s.lineTo(0, notch);
  s.lineTo(hw, 0);
  s.lineTo(hw, h - r);
  s.quadraticCurveTo(hw, h, hw - r, h);
  s.lineTo(-hw + r, h);
  s.quadraticCurveTo(-hw, h, -hw, h - r);
  return new THREE.ExtrudeGeometry(s, {
    depth, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 1, steps: 1, curveSegments: 6,
  });
}

// Процедурный env-куб (6 граней с вертикальным градиентом) — металлу
// отражения/блеск без внешних ассетов.
function makeEnvCube(THREE) {
  const faces = [];
  for (let i = 0; i < 6; i++) {
    const S = 64;
    const c = document.createElement('canvas'); c.width = c.height = S;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#dfe6f2'); g.addColorStop(1, '#3a4658'); // ярче медали
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    faces.push(c);
  }
  const tex = new THREE.CubeTexture(faces);
  tex.needsUpdate = true;
  return tex;
}

// Радиальный золотой градиент для ауры-спрайта за тумбой #1.
function makeAuraCanvas() {
  const S = 256;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(251,191,36,0.85)');
  g.addColorStop(0.45, 'rgba(251,191,36,0.35)');
  g.addColorStop(1, 'rgba(251,191,36,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  return c;
}

// 2D-shape скруглённого прямоугольника (footprint яруса).
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

// Вертикальный ярус постамента с фасками: ExtrudeGeometry скруглённого
// прямоугольника + bevel, выдавливание вдоль Y, низ на y=0. bevel/r клампятся
// под тонкие ярусы (врезка), чтобы depth не ушёл в минус.
function makeTierGeo(THREE, w, d, h, opts = {}) {
  const bevel = Math.min(opts.bevel ?? 0.04, h * 0.3, w * 0.08, d * 0.08);
  const r = Math.max(0.01, Math.min(opts.r ?? 0.1, w / 2 - bevel - 0.02, d / 2 - bevel - 0.02));
  const shape = roundedRectShape(THREE, w, d, r);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.005, h - bevel * 2),
    bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, steps: 1, curveSegments: 8,
  });
  geo.rotateX(-Math.PI / 2);          // ось выдавливания Z → вертикаль Y
  geo.computeBoundingBox();
  geo.translate(0, -geo.boundingBox.min.y, 0); // низ яруса на y=0
  return geo;
}

// Мягкая круглая искра для частиц (радиальный градиент).
function makeSparkCanvas() {
  const S = 64;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,240,200,0.8)');
  g.addColorStop(1, 'rgba(255,220,150,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  return c;
}

export default function Podium3D({ top3 = [], onOpenPublicProfile, fallbackRender }) {
  const { theme: THEME } = useTheme();
  const wrapRef = useRef(null);
  const mountRef = useRef(null);
  const avatarRefs = useRef([]);   // DOM-узлы аватаров по индексам top3
  const [failed, setFailed] = useState(false);

  // onOpenPublicProfile через ref — чтобы не пересобирать сцену при смене ссылки.
  const onOpenRef = useRef(onOpenPublicProfile);
  onOpenRef.current = onOpenPublicProfile;

  // Стабильный ключ: пересоздаём сцену только при смене состава топ-3.
  const key = top3.map(e => (e ? `${e.uid}:${e.points}` : 'x')).join('|');

  useEffect(() => {
    if (!key) return;
    let renderer, scene, camera, group, frameId, ro, clock, spotlight;
    let cancelled = false;
    const mount = mountRef.current;
    if (!mount) return;
    const geos = [], mats = [], texs = [], anchors = [];
    let curW = mount.clientWidth || 600;
    const tmp = { project: null };

    loadThree().then((THREE) => {
      if (cancelled || !mount) return;
      const W = mount.clientWidth || 600; curW = W;
      const tmpVec = new THREE.Vector3();

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(W, H);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      mount.appendChild(renderer.domElement);

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 100);
      camera.position.set(0, 3.6, 7.5);
      camera.lookAt(0, 1.0, 0);

      group = new THREE.Group();
      scene.add(group);

      const envCube = makeEnvCube(THREE); texs.push(envCube);

      // ── Свет: env-база + key/fill + point для бликов на металле ──────────────
      scene.add(new THREE.AmbientLight(0xffffff, 0.45));
      const key1 = new THREE.DirectionalLight(0xffffff, 1.0);
      key1.position.set(4, 8, 6);
      key1.castShadow = true;
      key1.shadow.mapSize.set(1024, 1024);
      Object.assign(key1.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 0.5, far: 30 });
      scene.add(key1);
      const fill = new THREE.DirectionalLight(0xffffff, 0.35); fill.position.set(-4, 2, 3); scene.add(fill);
      const pt = new THREE.PointLight(0xffffff, 0.6); pt.position.set(-1.5, 4, 4); scene.add(pt);

      // Невидимый пол — только приём теней (сам пол не виден).
      const groundGeo = new THREE.PlaneGeometry(40, 40); groundGeo.rotateX(-Math.PI / 2);
      const groundMat = new THREE.ShadowMaterial({ opacity: 0.24 });
      const ground = new THREE.Mesh(groundGeo, groundMat); ground.receiveShadow = true;
      scene.add(ground); geos.push(groundGeo); mats.push(groundMat);

      // ── Постаменты (многоуровневые «королевские» пьедесталы) ─────────────────
      const bevelOpts = { r: 0.1, bevel: 0.04 };
      const numberSlots = [];
      top3.forEach((entry, i) => {
        if (!entry || i > 2) return;
        const slot = SLOTS[i];

        // Глубокий металл (золото/серебро/бронза).
        const metalMat = new THREE.MeshStandardMaterial({
          color: METAL_NUM[i], metalness: 0.95, roughness: 0.15,
          envMap: envCube, envMapIntensity: 1.6,
          emissive: METAL_NUM[i], emissiveIntensity: 0.12,
        });
        mats.push(metalMat);

        // Стопка ярусов снизу вверх; верх карниза = slot.h (сумма hf = 1).
        let cum = 0, columnBottom = 0, columnH = 0;
        TIERS.forEach((t) => {
          const h = t.hf * slot.h;
          const geo = makeTierGeo(THREE, t.wf, t.wf, h, bevelOpts);
          const mesh = new THREE.Mesh(geo, metalMat);
          mesh.position.set(slot.x, cum, 0);
          mesh.castShadow = true; mesh.receiveShadow = true;
          group.add(mesh); geos.push(geo);
          if (t.column) { columnBottom = cum; columnH = h; }
          cum += h;
        });

        // Бархатная драпировка (геральдический баннер) на передней грани столба —
        // матовый пурпур с тканевым bumpMap (складки).
        const bw = 1.1, bh = columnH * 0.8, bd = 0.06;
        const bannerGeo = makeBannerGeo(THREE, bw, bh, bd);
        const fabricTex = new THREE.CanvasTexture(makeFabricBumpCanvas());
        const velvetMat = new THREE.MeshStandardMaterial({
          color: VELVET_HEX, metalness: 0.05, roughness: 0.9,
          bumpMap: fabricTex, bumpScale: 0.02,
          envMap: envCube, envMapIntensity: 0.2,
          emissive: 0x1a0a33, emissiveIntensity: 0.15,
        });
        texs.push(fabricTex); mats.push(velvetMat);
        const banner = new THREE.Mesh(bannerGeo, velvetMat);
        const bannerBottomY = columnBottom + columnH * 0.12;
        banner.position.set(slot.x, bannerBottomY, COLUMN_WF / 2 + 0.005);
        banner.castShadow = true; banner.receiveShadow = true;
        group.add(banner); geos.push(bannerGeo);

        // Слот под выпуклую 3D-цифру (строится асинхронно после загрузки шрифта).
        numberSlots.push({
          rank: i + 1,
          x: slot.x,
          y: bannerBottomY + bh * 0.5,
          z: COLUMN_WF / 2 + 0.005 + bd + 0.02,
        });

        // Якорь верха карниза — проекция экранной позиции аватара (с учётом sway).
        const anchor = new THREE.Object3D();
        anchor.position.set(slot.x, slot.h + 0.18, 0);
        group.add(anchor);
        anchors.push({ i, anchor });
      });

      // ── 3D-цифры мест: TextGeometry (выпуклая, ловит свет/тень) ───────────────
      // Фолбэк — CanvasTexture-цифра на плоскости, если шрифт/аддоны не загрузятся.
      const buildFallbackNumber = (ns) => {
        const tex = new THREE.CanvasTexture(makeNumberFaceCanvas(ns.rank));
        const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
        const geo = new THREE.PlaneGeometry(0.6, 0.6);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(ns.x, ns.y, ns.z - 0.02);
        group.add(mesh); geos.push(geo); mats.push(mat); texs.push(tex);
      };
      loadTypeface(FONT_URL).then((font) => {
        if (cancelled) return;
        const numMat = new THREE.MeshStandardMaterial({
          color: NUMBER_HEX, metalness: 0.9, roughness: 0.2,
          envMap: envCube, envMapIntensity: 1.4,
        });
        mats.push(numMat);
        numberSlots.forEach((ns) => {
          const geo = new THREE.TextGeometry(String(ns.rank), {
            font, size: 0.55, height: 0.14, curveSegments: 6,
            bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2,
          });
          geo.computeBoundingBox();
          const bb = geo.boundingBox;
          geo.translate(-(bb.max.x + bb.min.x) / 2, -(bb.max.y + bb.min.y) / 2, 0);
          const mesh = new THREE.Mesh(geo, numMat);
          mesh.position.set(ns.x, ns.y, ns.z);
          mesh.castShadow = true;
          group.add(mesh); geos.push(geo);
        });
      }).catch((e) => {
        console.warn('[podium3d] font load failed, fallback to canvas number:', e?.message || e);
        if (cancelled) return;
        numberSlots.forEach(buildFallbackNumber);
      });

      // ── Spotlight + конус + аура-гало + частицы у тумбы #1 ───────────────────
      let particleUpdate = null;
      if (top3[0]) {
        const sx = SLOTS[0].x, topY = SLOTS[0].h;

        // Тёплый spotlight сверху (свет + драматичная тень). Заменяет goldPt.
        spotlight = new THREE.SpotLight(0xffd9a0, 2.6, 22, 0.34, 0.5, 1);
        spotlight.position.set(sx, topY + 5.5, 2);
        spotlight.target.position.set(sx, topY - 0.2, 0);
        spotlight.castShadow = true;
        spotlight.shadow.mapSize.set(1024, 1024);
        spotlight.shadow.camera.near = 1; spotlight.shadow.camera.far = 18;
        scene.add(spotlight); scene.add(spotlight.target);

        // Аура-гало (визуал, не свет) — приглушена под spotlight.
        const auraTex = new THREE.CanvasTexture(makeAuraCanvas()); texs.push(auraTex);
        const auraMat = new THREE.SpriteMaterial({ map: auraTex, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.55, depthWrite: false });
        const aura = new THREE.Sprite(auraMat);
        aura.scale.set(4.4, 4.4, 1);
        aura.position.set(sx, topY * 0.7, -0.6);
        group.add(aura); mats.push(auraMat);

        // ~50 золотых пылинок в луче: дрейф вверх + респавн + мерцание (vertexColors).
        const COUNT = 50;
        const yBase = topY - 0.3, yTop = topY + 4;
        const sparkTex = new THREE.CanvasTexture(makeSparkCanvas()); texs.push(sparkTex);
        const pgeo = new THREE.BufferGeometry();
        const pos = new Float32Array(COUNT * 3), col = new Float32Array(COUNT * 3);
        const phase = new Float32Array(COUNT), vel = new Float32Array(COUNT);
        const gold = new THREE.Color(0xffe6a8);
        for (let i = 0; i < COUNT; i++) {
          pos[i * 3] = sx + (Math.random() - 0.5) * 2.2;
          pos[i * 3 + 1] = yBase + Math.random() * (yTop - yBase);
          pos[i * 3 + 2] = (Math.random() - 0.5) * 2.0;
          phase[i] = Math.random() * Math.PI * 2;
          vel[i] = 0.18 + Math.random() * 0.3;
          col[i * 3] = gold.r; col[i * 3 + 1] = gold.g; col[i * 3 + 2] = gold.b;
        }
        pgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        pgeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        const pmat = new THREE.PointsMaterial({
          size: 0.13, map: sparkTex, vertexColors: true, transparent: true,
          blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
        });
        const points = new THREE.Points(pgeo, pmat);
        scene.add(points); geos.push(pgeo); mats.push(pmat);
        particleUpdate = (t, dt) => {
          const p = pgeo.attributes.position.array, c = pgeo.attributes.color.array;
          for (let i = 0; i < COUNT; i++) {
            let y = p[i * 3 + 1] + vel[i] * dt;
            if (y > yTop) { y = yBase; p[i * 3] = sx + (Math.random() - 0.5) * 2.2; p[i * 3 + 2] = (Math.random() - 0.5) * 2.0; }
            p[i * 3 + 1] = y;
            const tw = 0.45 + 0.55 * Math.abs(Math.sin(t * 1.5 + phase[i]));
            c[i * 3] = gold.r * tw; c[i * 3 + 1] = gold.g * tw; c[i * 3 + 2] = gold.b * tw;
          }
          pgeo.attributes.position.needsUpdate = true;
          pgeo.attributes.color.needsUpdate = true;
        };
      }

      // ── Проекция экранных позиций аватаров (вызывается каждый кадр) ───────────
      const positionAvatars = () => {
        for (const a of anchors) {
          a.anchor.getWorldPosition(tmpVec);   // учитывает текущую ротацию group
          tmpVec.project(camera);
          const sx = (tmpVec.x * 0.5 + 0.5) * curW;
          const sy = (-tmpVec.y * 0.5 + 0.5) * H;
          const el = avatarRefs.current[a.i];
          if (el) {
            el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -100%)`;
            el.style.opacity = '1';
          }
        }
      };
      tmp.project = positionAvatars;

      // Resize
      ro = new ResizeObserver(() => {
        if (!renderer || !mount) return;
        curW = mount.clientWidth || W;
        renderer.setSize(curW, H);
        camera.aspect = curW / H; camera.updateProjectionMatrix();
        positionAvatars();
      });
      ro.observe(mount);

      clock = new THREE.Clock();
      let lastT = 0;
      const animate = () => {
        frameId = requestAnimationFrame(animate);
        const t = clock.getElapsedTime();
        const dt = Math.min(t - lastT, 0.05); lastT = t;
        group.rotation.y = Math.sin(t * SWAY_SPEED) * SWAY_AMP;
        if (particleUpdate) particleUpdate(t, dt);
        renderer.render(scene, camera);
        positionAvatars();   // аватары едут вместе с качающимися тумбами
      };
      positionAvatars();     // стартовая раскладка до первого кадра
      animate();
    }).catch((e) => { console.warn('[podium3d] three load failed:', e?.message || e); if (!cancelled) setFailed(true); });

    return () => {
      cancelled = true;
      if (frameId) cancelAnimationFrame(frameId);
      if (ro) ro.disconnect();
      if (spotlight && spotlight.shadow && spotlight.shadow.map) spotlight.shadow.map.dispose();
      geos.forEach(g => g.dispose && g.dispose());
      mats.forEach(m => m.dispose && m.dispose());
      texs.forEach(t => t.dispose && t.dispose());
      if (renderer) {
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
        renderer.dispose();
        if (renderer.forceContextLoss) renderer.forceContextLoss();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (failed) return <>{fallbackRender ? fallbackRender() : null}</>;

  const clickable = !!onOpenPublicProfile;
  const caps = [{ e: top3[1], rank: 2 }, { e: top3[0], rank: 1 }, { e: top3[2], rank: 3 }];

  return (
    <div style={{ marginBottom: 24 }}>
      <div ref={wrapRef} style={{
        position: 'relative', width: '100%', height: H, overflow: 'hidden', borderRadius: 14,
        // Виньетка зала: тёплый/пурпурный отлив в центре у пьедестала → тёмные края.
        background: 'radial-gradient(ellipse 65% 75% at 50% 42%, rgba(120,80,160,0.22), rgba(40,28,70,0.10) 45%, rgba(5,4,12,0) 70%), radial-gradient(ellipse at 50% 50%, rgba(8,6,16,0) 35%, rgba(0,0,0,0.6) 100%), #08060f',
      }}>
        <div ref={mountRef} style={{ width: '100%', height: H }} />

        {/* CSS-аватары поверх canvas — позиционируются проекцией каждый кадр */}
        {top3.map((e, i) => {
          if (!e || i > 2) return null;
          const accent = ACCENT_HEX[i];
          const av = i === 0 ? 76 : 60;
          const frameStyle = e.equippedFrame ? (FRAME_STYLES[e.equippedFrame] || null) : null;
          return (
            <div
              key={e.uid}
              ref={(el) => { avatarRefs.current[i] = el; }}
              onClick={() => clickable && onOpenRef.current?.(e.uid)}
              role={clickable ? 'button' : undefined}
              title={initialsOf(e)}
              style={{
                position: 'absolute', left: 0, top: 0,
                transform: 'translate(-9999px,-9999px)', opacity: 0,
                transition: 'opacity 0.25s',
                pointerEvents: 'auto', zIndex: 2,
                cursor: clickable ? 'pointer' : 'default',
                willChange: 'transform',
              }}
            >
              {i === 0 && (
                <div style={{ position: 'absolute', top: -22, left: '50%', transform: 'translateX(-50%)', fontSize: 18, letterSpacing: 2, lineHeight: 1, pointerEvents: 'none' }}>
                  ✨
                </div>
              )}
              {e.avatarUrl
                ? <img src={e.avatarUrl} alt="" style={{
                    width: av, height: av, borderRadius: '50%', objectFit: 'cover', display: 'block',
                    border: `3px solid ${accent}`, boxShadow: `0 0 18px ${accent}88`, ...(frameStyle || {}),
                  }} />
                : <div style={{
                    width: av, height: av, borderRadius: '50%',
                    background: 'linear-gradient(135deg,#6366f1,#a78bfa)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: i === 0 ? 24 : 18,
                    border: `3px solid ${accent}`, boxShadow: `0 0 18px ${accent}88`, ...(frameStyle || {}),
                  }}>{initialsOf(e)}</div>}
            </div>
          );
        })}
      </div>

      {/* Подписи под canvas */}
      <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
        {caps.map(({ e, rank }, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
            {e && (
              <>
                <div style={{ fontSize: 18 }}>{rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}</div>
                <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: rank === 1 ? 15 : 13, color: THEME.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {initialsOf(e)}
                </div>
                <div style={{ fontWeight: 700, fontSize: 13, color: ACCENT_HEX[rank - 1] }}>
                  {Number(e.points || 0).toLocaleString('ru-RU')} очк.
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
