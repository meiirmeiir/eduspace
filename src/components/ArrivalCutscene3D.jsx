import React, { useEffect, useRef } from 'react';
import { loadThree } from '../lib/loadThree.js';
import { PLANET_VERT, PLANET_FRAG, ATMO_VERT, CLOUD_FRAG, NOISE_GLSL } from './SkillPlanet3D.jsx';

// Полноэкранная кинематографичная кат-сцена «Прибытие» (ОДИН WebGL-контекст).
// POV без аватара: bloom-открытие (маскирует remount фона→результатов) → подлёт к
// сине-океанической планете (живой mastered-мир: океаны+зелёные материки+облака из
// общих шейдеров, + ночные огни ОТДЕЛЬНЫМ оверлеем) → вход в облако (забеливание =
// вторая маска) → выныривание в ЕДИНЫЙ туманный слой, где дрон-силуэт опускает зонд
// на площадку → финальный кадр в тумане. На финале родитель кросс-фейдом передаёт
// эстафету секции «Твоя награда» (ProbeScene3D, skipDelivery) — один зонд, без дубля.
// Туман — дешёвые billboard-спрайты (НЕ volumetric). Скип по тапу/клику ВСЕГДА.
// Градиент интенсивности: I = lerp(0.35, 1.0, perf) — слабый результат тоже тёплый.

// Ночные огни/биолюм — ТОЛЬКО для кат-сцены (импорт NOISE_GLSL; PLANET_FRAG, который
// шарится со скилл-картой/теорией/лендингом, НЕ трогаем).
const NIGHT_LIGHTS_FRAG = NOISE_GLSL + `
  uniform vec3 uSunDir; uniform float uI;
  varying vec3 vPos; varying vec3 vNormalW;
  void main(){
    float ndl = dot(normalize(vNormalW), normalize(uSunDir));
    float night = smoothstep(0.10, -0.30, ndl);             // ночная сторона
    float cells = fbm(vPos * 9.0);
    float lights = smoothstep(0.63, 0.73, cells) * night;   // редкие «города»
    vec3 warm = vec3(1.0, 0.80, 0.45);
    gl_FragColor = vec4(warm * lights * (0.7 + 0.6 * uI), lights);
  }`;

// Мягкая атмосфера (front-side, перо к силуэту) + uBloom для прибытия.
const CUT_ATMO_FRAG = `
  uniform vec3 uSunDir; uniform float uIntensity;
  varying vec3 vNormalW; varying vec3 vViewDir;
  const vec3 ATMO = vec3(0.50, 0.74, 1.0);
  void main(){
    vec3 N = normalize(vNormalW); vec3 V = normalize(vViewDir);
    float rim = 1.0 - max(dot(V, N), 0.0);
    float band = pow(rim, 2.0) * smoothstep(1.0, 0.45, rim);
    float sun  = 0.5 + 0.5 * max(dot(N, normalize(uSunDir)), 0.0);
    gl_FragColor = vec4(ATMO, band * sun * uIntensity);
  }`;

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const easeInOut = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const easeOut = (x) => 1 - Math.pow(1 - x, 3);

// Софт-облако как ALPHA-КАРТА: canvas ПОЛНОСТЬЮ НЕПРОЗРАЧНЫЙ, мягкий grayscale-радиал
// (центр бел → край чёрн) = профиль АЛЬФЫ. Подключается через material.alphaMap, а цвет
// спрайта берётся ТОЛЬКО из material.color (монохром бело-голубой). У текстуры нет ни
// альфа-канала, ни цвета → на iOS Safari НЕТ цветного RGB-мусора из полупрозрачных
// пикселей (главная причина цветных крапин; десктоп его игнорировал, iOS подмешивал).
// Граница чёрная (alpha 0) → нет прямоугольного billboard-шва. Без мипмапов + линейная.
function makeCloudTex(THREE) {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, S, S);          // непрозрачная чёрная база (= alpha 0)
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.48);
  g.addColorStop(0.00, 'rgba(255,255,255,1)');           // центр → бел (alpha 1)
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)');        // поверх чёрного → серый (плавно)
  g.addColorStop(0.70, 'rgba(255,255,255,0.10)');
  g.addColorStop(1.00, 'rgba(255,255,255,0)');           // край → остаётся чёрным (alpha 0)
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.generateMipmaps = false;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

export default function ArrivalCutscene3D({ perf = 1, full = true, onDone, onFail }) {
  const mountRef = useRef(null);
  const maskRef = useRef(null);     // CSS-маска: bloom-открытие / забеливание / финал
  const doneRef = useRef(false);

  useEffect(() => {
    let renderer, scene, camera, frameId, clock, ro, resizeTimer;
    let cancelled = false;
    const mount = mountRef.current;
    if (!mount) return;
    const geos = [], mats = [], texs = [];
    const I = 0.35 + 0.65 * clamp01(perf);            // пол 0.35 — слабый результат тоже тёплый

    // Тайминги (full = первый запуск дня; иначе короче). Камера/маски — параметрически.
    const D = full
      ? { mask: 0.4, approach: 1.4, cloud: 0.8, drone: 1.7, settle: 0.6 }
      : { mask: 0.3, approach: 0.7, cloud: 0.5, drone: 1.1, settle: 0.4 };
    const t1 = D.mask, t2 = t1 + D.approach, t3 = t2 + D.cloud, t4 = t3 + D.drone, tEnd = t4 + D.settle;

    const finish = () => { if (doneRef.current) return; doneRef.current = true; onDone?.(); };

    loadThree().then((THREE) => {
      if (cancelled || !mount) return;
      const vw = () => mount.clientWidth || window.innerWidth || 1280;
      const vh = () => mount.clientHeight || window.innerHeight || 720;
      let W = vw(), H = vh();
      const isMobile = W < 760;

      try { renderer = new THREE.WebGLRenderer({ antialias: !isMobile, alpha: true, powerPreference: 'high-performance' }); }
      catch (e) { if (!cancelled) (onFail || onDone)?.(); return; }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
      renderer.setSize(W, H, false);
      const cv = renderer.domElement;
      cv.style.width = '100%'; cv.style.height = '100%'; cv.style.display = 'block';
      mount.appendChild(cv);

      scene = new THREE.Scene();
      const fovFor = (w, h) => (w < h ? 74 : 55);       // портрет — шире, планета заполняет кадр
      camera = new THREE.PerspectiveCamera(fovFor(W, H), W / H, 0.1, 200);

      const sunDir = new THREE.Vector3(0.7, 0.32, 0.55).normalize();

      // ── SPACE-набор: планета + облака + ночные огни + атмосфера + звёзды ──
      const space = new THREE.Group(); scene.add(space);
      space.position.set(0.5, 0.25, 0);            // планета чуть от центра — динамичнее
      const planetUniforms = { uLife: { value: 1.0 }, uSunDir: { value: sunDir }, uAmbient: { value: 0.16 } };
      const nightUniforms = { uSunDir: { value: sunDir }, uI: { value: I } };
      const atmoUniforms = { uSunDir: { value: sunDir }, uIntensity: { value: 1.2 + 0.8 * I } };
      const PRAD = 2.2;
      const pg = new THREE.Group(); pg.scale.setScalar(PRAD); space.add(pg);
      const planetGeo = new THREE.SphereGeometry(1, 56, 56); geos.push(planetGeo);
      const planetMat = new THREE.ShaderMaterial({ uniforms: planetUniforms, vertexShader: PLANET_VERT, fragmentShader: PLANET_FRAG }); mats.push(planetMat);
      pg.add(new THREE.Mesh(planetGeo, planetMat));
      const cloudGeo = new THREE.SphereGeometry(1.015, 44, 44); geos.push(cloudGeo);
      const cloudMat = new THREE.ShaderMaterial({ uniforms: planetUniforms, vertexShader: PLANET_VERT, fragmentShader: CLOUD_FRAG, transparent: true, depthWrite: false }); mats.push(cloudMat);
      const planetClouds = new THREE.Mesh(cloudGeo, cloudMat); pg.add(planetClouds);
      const nightGeo = new THREE.SphereGeometry(1.005, 48, 48); geos.push(nightGeo);
      const nightMat = new THREE.ShaderMaterial({ uniforms: nightUniforms, vertexShader: PLANET_VERT, fragmentShader: NIGHT_LIGHTS_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }); mats.push(nightMat);
      pg.add(new THREE.Mesh(nightGeo, nightMat));
      const atmoGeo = new THREE.SphereGeometry(1.5, 44, 44); geos.push(atmoGeo);
      const atmoMat = new THREE.ShaderMaterial({ uniforms: atmoUniforms, vertexShader: ATMO_VERT, fragmentShader: CUT_ATMO_FRAG, transparent: true, side: THREE.FrontSide, blending: THREE.AdditiveBlending, depthWrite: false }); mats.push(atmoMat);
      pg.add(new THREE.Mesh(atmoGeo, atmoMat));
      // Звёзды (дёшево)
      const starN = isMobile ? 260 : 420; const sp = new Float32Array(starN * 3);
      for (let i = 0; i < starN; i++) { const r = 40 + ((i * 53) % 30); const th = i * 2.39996, ph = Math.acos(1 - 2 * ((i % 100) / 100)); sp[i*3] = r*Math.sin(ph)*Math.cos(th); sp[i*3+1] = r*Math.cos(ph); sp[i*3+2] = r*Math.sin(ph)*Math.sin(th); }
      const starGeo = new THREE.BufferGeometry(); geos.push(starGeo); starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
      const starMat = new THREE.PointsMaterial({ color: 0xcfe0ff, size: 0.45, sizeAttenuation: true, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }); mats.push(starMat);
      space.add(new THREE.Points(starGeo, starMat));

      // ── Облачный «набегающий» спрайт у порога входа (продаёт ныряние) ──
      const cloudTex = makeCloudTex(THREE); texs.push(cloudTex);
      // alphaMap (не map) → цвет только из material.color (монохром), без RGB-мусора на iOS.
      const diveMat = new THREE.SpriteMaterial({ alphaMap: cloudTex, color: 0xdfe9ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }); mats.push(diveMat);
      const diveCloud = new THREE.Sprite(diveMat); diveCloud.scale.set(0, 0, 1); scene.add(diveCloud);

      // ── FOG-набор: туман (billboard-спрайты) + площадка + зонд + дрон ──
      const fog = new THREE.Group(); fog.visible = false; scene.add(fog);
      const FOG_COL = new THREE.Color(0xc9d6ea);
      // Рассеянный свет
      fog.add(new THREE.AmbientLight(0xdfe8f5, 0.7));
      const warm = new THREE.Color().setRGB(1.0, 0.86 + 0.1 * I, 0.66 + 0.2 * I);
      const keyL = new THREE.DirectionalLight(warm.getHex(), 0.8 + 0.5 * I); keyL.position.set(2, 4, 3); fog.add(keyL);
      const padGlow = new THREE.PointLight(0x6fc8ff, 0.6 + 0.7 * I, 9); padGlow.position.set(0, 0.6, 0); fog.add(padGlow);
      // Туманные клубы вокруг камеры (ЕДИНЫЙ слой)
      const fogN = isMobile ? 14 : 22; const puffs = [];
      const fogMatBase = { alphaMap: cloudTex, transparent: true, depthWrite: false, blending: THREE.NormalBlending };
      for (let i = 0; i < fogN; i++) {
        const m = new THREE.SpriteMaterial({ ...fogMatBase, color: FOG_COL, opacity: 0.0 }); mats.push(m);
        const s = new THREE.Sprite(m);
        const ang = i * 2.39996, rad = 2.2 + (i % 5) * 1.1, hy = -1.2 + ((i * 7) % 10) / 10 * 3.2;
        s.position.set(Math.cos(ang) * rad, hy, -2 - (i % 4) * 1.6 + Math.sin(ang) * 1.2);
        const sc = 3.5 + (i % 4) * 1.6; s.scale.set(sc, sc, 1);
        fog.add(s); puffs.push({ s, m, base: s.position.clone(), drift: 0.1 + (i % 3) * 0.05, ph: i });
      }
      // Площадка
      const padGeo = new THREE.CylinderGeometry(1.3, 1.4, 0.09, 28); geos.push(padGeo);
      const padMat = new THREE.MeshStandardMaterial({ color: 0x2c3340, metalness: 0.6, roughness: 0.5 }); mats.push(padMat);
      const pad = new THREE.Mesh(padGeo, padMat); pad.position.y = 0.045; fog.add(pad);
      const ringGeo = new THREE.TorusGeometry(1.14, 0.03, 8, 36); ringGeo.rotateX(Math.PI / 2); geos.push(ringGeo);
      const ringMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 0.7, metalness: 0.3, roughness: 0.5 }); mats.push(ringMat);
      const padRing = new THREE.Mesh(ringGeo, ringMat); padRing.position.y = 0.095; fog.add(padRing);
      // Зонд (кинематографичная капсула — те же пропорции, что ProbeScene3D)
      const probe = new THREE.Group(); fog.add(probe);
      const R = 0.5, LEN = 1.4;
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0xc7d2e0, metalness: 0.6, roughness: 0.35 }); mats.push(bodyMat);
      const hullGeo = new THREE.CylinderGeometry(R, R, LEN, 22); hullGeo.rotateZ(Math.PI / 2); geos.push(hullGeo);
      probe.add(new THREE.Mesh(hullGeo, bodyMat));
      [-1, 1].forEach((s) => { const cg = new THREE.SphereGeometry(R, 16, 12); geos.push(cg); const c = new THREE.Mesh(cg, bodyMat); c.position.x = s * LEN / 2; c.scale.set(0.55, 1, 1); probe.add(c); });
      const stripeMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 0.5, metalness: 0.4, roughness: 0.35 }); mats.push(stripeMat);
      [-0.42, 0.42].forEach((x) => { const tg = new THREE.TorusGeometry(R + 0.02, 0.03, 8, 24); tg.rotateY(Math.PI / 2); geos.push(tg); const tm = new THREE.Mesh(tg, stripeMat); tm.position.x = x; probe.add(tm); });
      const sensGeo = new THREE.SphereGeometry(0.09, 12, 10); geos.push(sensGeo);
      const sensMat = new THREE.MeshStandardMaterial({ color: 0x0b1220, emissive: 0x22d3ee, emissiveIntensity: 0.9 }); mats.push(sensMat);
      const sensor = new THREE.Mesh(sensGeo, sensMat); sensor.position.set(0, 0.06, R - 0.02); probe.add(sensor);
      // Дрон (процедурный — подход ProbeScene3D)
      const drone = new THREE.Group(); fog.add(drone);
      const droneMat = new THREE.MeshStandardMaterial({ color: 0x222a36, metalness: 0.7, roughness: 0.4 }); mats.push(droneMat);
      const dBodyGeo = new THREE.BoxGeometry(0.52, 0.13, 0.32); geos.push(dBodyGeo); drone.add(new THREE.Mesh(dBodyGeo, droneMat));
      const navG = new THREE.SphereGeometry(0.04, 10, 10); geos.push(navG);
      const navGreen = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 1.4 }); mats.push(navGreen);
      const navRed = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 1.4 }); mats.push(navRed);
      const navGM = new THREE.Mesh(navG, navGreen); navGM.position.set(0.2, 0.05, 0.17); drone.add(navGM);
      const navRM = new THREE.Mesh(navG, navRed); navRM.position.set(-0.2, 0.05, 0.17); drone.add(navRM);
      const blades = [];
      [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([sx, sz]) => {
        const armG = new THREE.BoxGeometry(0.3, 0.03, 0.05); geos.push(armG); const arm = new THREE.Mesh(armG, droneMat); arm.position.set(sx*0.32, 0.02, sz*0.2); drone.add(arm);
        const motG = new THREE.CylinderGeometry(0.045, 0.05, 0.07, 8); geos.push(motG); const mot = new THREE.Mesh(motG, droneMat); mot.position.set(sx*0.44, 0.05, sz*0.3); drone.add(mot);
        const blG = new THREE.BoxGeometry(0.34, 0.012, 0.045); geos.push(blG); const bl = new THREE.Mesh(blG, new THREE.MeshStandardMaterial({ color: 0x222831, transparent: true, opacity: 0.85 })); bl.position.set(sx*0.44, 0.1, sz*0.3); drone.add(bl); blades.push(bl);
      });
      const cableGeo = new THREE.CylinderGeometry(0.01, 0.01, 1, 6); geos.push(cableGeo);
      const cableMat = new THREE.MeshBasicMaterial({ color: 0x556070 }); mats.push(cableMat);
      const cable = new THREE.Mesh(cableGeo, cableMat); drone.add(cable);

      // ── Resize-guard (как в DailyBackground3D: игнор «дыхания» адресной строки iOS) ──
      let lastW = W, lastH = H; const ADDR_BAND = 160;
      const applyResize = () => { if (!renderer) return; const nW = vw(), nH = vh(); if (nW === lastW && nH === lastH) return; lastW = nW; lastH = nH; W = nW; H = nH; renderer.setSize(W, H, false); camera.fov = fovFor(W, H); camera.aspect = W / H; camera.updateProjectionMatrix(); };
      ro = new ResizeObserver(() => { const nW = vw(), nH = vh(); if (isMobile && nW === lastW && Math.abs(nH - lastH) <= ADDR_BAND) return; if (resizeTimer) clearTimeout(resizeTimer); resizeTimer = setTimeout(applyResize, 150); });
      ro.observe(mount);

      // CSS-маска: одна на всё (bloom-открытие → забеливание входа → финальный туман).
      const setMask = (op, bg) => { if (maskRef.current) { maskRef.current.style.opacity = op.toFixed(3); if (bg) maskRef.current.style.background = bg; } };
      const BLOOM_BG = 'radial-gradient(ellipse at 50% 45%, rgba(225,240,255,1) 0%, rgba(150,205,255,0.85) 38%, rgba(120,180,255,0) 72%)';
      const WHITE_BG = '#eef4ff';
      const FOG_BG = 'radial-gradient(ellipse at 50% 62%, rgba(201,214,234,0.0) 30%, rgba(201,214,234,0.55) 100%)';
      let curPhase = -1;

      clock = new THREE.Clock();
      const animate = () => {
        frameId = requestAnimationFrame(animate);
        const t = clock.getElapsedTime();

        // лёгкая жизнь планеты
        pg.rotation.y = t * 0.05; planetClouds.rotation.y = t * 0.07;

        if (t < t3) {
          // SPACE: bloom-открытие → подлёт → вход в облако (забеливание)
          if (curPhase !== 0) { curPhase = 0; space.visible = true; fog.visible = false; }
          // Камера летит к планете (инерция от Z_ARRIVAL фона): далеко → близко
          const ap = clamp01((t - t1) / D.approach);
          const camZ = 9 - 6.6 * easeInOut(ap);                 // 9 → 2.4
          camera.position.set(0, 0, camZ); camera.lookAt(space.position);
          // Облачный спрайт набегает у порога входа
          const cp = clamp01((t - t2) / D.cloud);
          diveCloud.position.set(0.2, 0.2, camZ - 1.6);
          diveMat.opacity = 0.85 * cp; const ds = 1 + 9 * cp; diveCloud.scale.set(ds, ds, 1);
          // Маски: открытие (0..t1) и забеливание (t2..t3)
          if (t < t1) setMask(I * (1 - t / t1), BLOOM_BG);
          else if (t < t2) setMask(0, BLOOM_BG);
          else setMask(easeInOut(cp), WHITE_BG);               // → пик белизны на t3
        } else {
          // FOG: выныривание, дрон опускает зонд, финал
          if (curPhase !== 1) {
            curPhase = 1; space.visible = false; fog.visible = true;
            camera.position.set(0, 1.5, 4.6); camera.lookAt(0, 0.7, 0);
            setMask(1, WHITE_BG);                               // держим белизну до раскрытия тумана
          }
          const ft = t - t3;                                   // время в тумане
          // Белизна спадает → туман проявляется
          const reveal = clamp01(ft / 0.5);
          // дрейф тумана + появление. Альфа СИЛЬНО ниже прежней (была 0.5-0.75 ×
          // 14-22 нахлёста = забеливание) → мягкая дымка-атмосфера ВОКРУГ, не пелена
          // ПОВЕРХ: зонд/площадка/дрон остаются хорошо видны. Плотность под I-веером.
          puffs.forEach((p) => { p.m.opacity = (0.10 + 0.08 * I) * reveal * (0.7 + 0.3 * Math.sin(t * p.drift + p.ph)); p.s.position.x = p.base.x + Math.sin(t * p.drift + p.ph) * 0.4; p.s.position.y = p.base.y + Math.cos(t * p.drift * 0.7 + p.ph) * 0.25; });
          padRing.material.emissiveIntensity = (0.5 + 0.4 * I) * (0.6 + 0.4 * Math.sin(t * 2.2)) * reveal;
          // Маска: пик белизны спадает (1 → 0.22) → остаётся лёгкая туман-вуаль.
          if (ft < 0.5) setMask(1 - reveal * 0.78, WHITE_BG);
          else setMask(0.22, FOG_BG);

          // Винты крутятся пока дрон виден
          blades.forEach((b) => { b.rotation.y += 0.5; });

          // Дрон: силуэт из глубины → фокус над площадкой → опускает зонд → отплывает → силуэт
          const dp = clamp01(ft / D.drone);
          const PROBE_REST_Y = 0.62, HANG = 1.0;
          if (dp < 0.42) {
            // влетает из глубины тумана к точке зависания
            const e = easeOut(dp / 0.42);
            drone.visible = true;
            drone.position.set(2.6 - 3.0 * e, 2.9 - 0.5 * e, -5 + 6 * e);
            drone.rotation.z = -0.16 * (1 - e);
            cable.visible = true;
            probe.position.set(drone.position.x, drone.position.y - HANG, drone.position.z);
          } else if (dp < 0.72) {
            // опускает зонд на площадку (тяга будоражит туман под ним)
            const e = easeInOut((dp - 0.42) / 0.30);
            drone.position.set(-0.4, 2.4 + Math.sin(t * 2) * 0.05, 0);
            drone.rotation.z = 0;
            const py = (drone.position.y - HANG) + ((PROBE_REST_Y) - (drone.position.y - HANG)) * e;
            probe.position.set(0, py, 0);
            cable.visible = e < 0.96;
          } else {
            // зонд лёг → дрон разворачивается и уходит в глубину тумана → силуэт
            probe.position.set(0, PROBE_REST_Y, 0);
            cable.visible = false;
            const e = easeInOut((dp - 0.72) / 0.28);
            drone.position.set(-0.4 - 2.6 * e, 2.4 + 1.0 * e, 0 - 7 * e);
            drone.rotation.z = 0.14 * e;
            const ds2 = 1 - 0.5 * e; drone.scale.set(ds2, ds2, ds2);
            if (e >= 1) drone.visible = false;
          }
          // Трос между дроном и зондом
          if (cable.visible) {
            const dx = probe.position.x - drone.position.x, dy = probe.position.y - drone.position.y, dz = probe.position.z - drone.position.z;
            const len = Math.hypot(dx, dy, dz) || 0.001;
            cable.position.set((drone.position.x + probe.position.x) / 2 - drone.position.x, (drone.position.y + probe.position.y) / 2 - drone.position.y, (drone.position.z + probe.position.z) / 2 - drone.position.z);
            cable.scale.set(1, len, 1);
          }
          // зонд idle-пульс маркировки
          stripeMat.emissiveIntensity = 0.4 + 0.3 * (0.5 + 0.5 * Math.sin(t * 2.2));

          // Готов: после settle (мин-время) — отдаём эстафету. Зонд уже в кадре → ready.
          if (ft >= (D.drone + D.settle)) finish();
        }

        renderer.render(scene, camera);
      };
      animate();
    }).catch((e) => { console.warn('[cutscene] three load failed:', e?.message || e); if (!cancelled) (onFail || onDone)?.(); });

    return () => {
      cancelled = true;
      if (frameId) cancelAnimationFrame(frameId);
      if (resizeTimer) clearTimeout(resizeTimer);
      if (ro) ro.disconnect();
      geos.forEach((g) => g.dispose && g.dispose());
      mats.forEach((m) => m.dispose && m.dispose());
      texs.forEach((tx) => tx.dispose && tx.dispose());
      if (renderer) {
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
        renderer.dispose();
        if (renderer.forceContextLoss) renderer.forceContextLoss();   // явный dispose контекста
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skip = () => { if (doneRef.current) return; doneRef.current = true; onDone?.(); };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: '#05070f', overflow: 'hidden',
      transform: 'translateZ(0)', WebkitTransform: 'translateZ(0)' }}
      onPointerDown={skip} onTouchStart={skip}>
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />
      <div ref={maskRef} aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0, background: '#fff', willChange: 'opacity' }} />
      <button
        onClick={(e) => { e.stopPropagation(); skip(); }}
        style={{
          position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 14px)', right: 'calc(env(safe-area-inset-right, 0px) + 14px)',
          zIndex: 2, padding: '8px 16px', borderRadius: 99, cursor: 'pointer',
          background: 'rgba(10,16,30,0.55)', color: 'rgba(255,255,255,0.92)', border: '1px solid rgba(255,255,255,0.28)',
          fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 700, backdropFilter: 'blur(6px)',
        }}>
        Пропустить ›
      </button>
    </div>
  );
}
