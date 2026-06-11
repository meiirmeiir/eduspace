import React, { useEffect, useRef, useState } from 'react';
import { loadThree } from '../lib/loadThree.js';
import { PLANET_VERT, PLANET_FRAG, ATMO_VERT, CLOUD_FRAG } from './SkillPlanet3D.jsx';

// Живой космический фон мирного режима ежедневок (ОДИН WebGL-контекст, на весь
// экран, ПОЗАДИ карточки вопроса). Спокойнее боевой сцены: меньше звёзд, медленный
// дрейф. Переиспользует:
//   • подход к звёздному полю из BattleScene3D (canvas-glow текстура, additive Points,
//     детерминированная golden-angle раскладка) — но ~700 звёзд вместо 1800 и медленнее;
//   • шейдеры планеты из SkillPlanet3D (PLANET/ATMO/CLOUD) в состоянии «mastered»
//     (uLife=1) → синяя цветущая планета с океанами и атмосферным rim.
// Планета вынесена вдаль и к верхне-левому краю (НЕ за текстом). Контент рендерится
// поверх (карточка непрозрачна → текст и 4 варианта идеально читаются); дополнительно
// — мягкий CSS-скрим для контраста. Размонтаж: forceContextLoss (без утечки контекста).
// Гейтится снаружи: DAILY_BG_3D && !bossActive (в бою не дублировать контекст).

// Локальная «мягкая дымка» атмосферы ТОЛЬКО для фонового инстанса (ATMO в
// SkillPlanet3D не трогаем). В отличие от back-side фрезнель-оболочки (даёт
// плоское кольцо с резкой внешней границей), здесь front-side: dot(view,normal)
// меняется от 1 в центре диска до 0 у силуэта → настоящий радиальный градиент.
//   band = pow(rim, k)         — плавный подъём дымки к краю планеты;
//   Профиль плотности задаётся ОТНОСИТЕЛЬНО лимба планеты (rim=RIM_SURF), а не
//   абсолютного rim: пик у поверхности (тон/плотность как раньше), внутрь — мягко
//   к центру, наружу — ДЛИННЫЙ плавный хвост в 0 задолго до силуэта (геометрический
//   край оболочки невидим, т.к. там альфа уже ≈0 → атмосфера тает в космос).
const SOFT_ATMO_FRAG = `
  uniform vec3 uSunDir; uniform float uIntensity;
  varying vec3 vNormalW; varying vec3 vViewDir;
  const vec3 ATMO = vec3(0.42, 0.66, 1.0);
  // Лимб планеты (радиус 1.0) на оболочке радиуса 1.7: rimSurf = 1 - sqrt(1-(1/1.7)^2).
  const float RIM_SURF = 0.19;
  const float TAIL     = 0.82;   // длина внешнего затухания в rim (лимб → почти силуэт)
  const float DENSITY  = 0.21;   // плотность дымки у поверхности (как было у лимба)
  void main(){
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(vViewDir);
    float rim = 1.0 - max(dot(V, N), 0.0);            // 0 центр диска → 1 силуэт
    float d = rim - RIM_SURF;                         // 0 у лимба, <0 над планетой, >0 в космос
    // Внутрь (над планетой): плотно у лимба, мягко гаснет к центру — НЕ менялось.
    float inner = smoothstep(-0.22, 0.0, d);
    // Наружу: длинный плавный спад 1→0 на протяжении TAIL (мягкая степень → долгий хвост).
    float outer = pow(clamp(1.0 - d / TAIL, 0.0, 1.0), 2.6);
    float band = DENSITY * inner * outer;
    float sun  = 0.45 + 0.55 * max(dot(N, normalize(uSunDir)), 0.0);
    gl_FragColor = vec4(ATMO, band * sun * uIntensity);
  }`;

export default function DailyBackground3D({ isDark = true, progress = 0, boostSeq = 0, glitchSeq = 0, isLast = false, arrivalBurstSeq = 0 }) {
  const mountRef = useRef(null);
  const boostFlashRef = useRef(null);
  const glitchFlashRef = useRef(null);
  const [failed, setFailed] = useState(false);

  // Доля прохождения и импульсы ответов читаются rAF-циклом через ref'ы → смена
  // задачи НЕ пересоздаёт сцену (меняется только позиция/дистанция планеты).
  const progressRef = useRef(progress);
  const boostSeqRef = useRef(boostSeq);
  const glitchSeqRef = useRef(glitchSeq);
  const isLastRef = useRef(isLast);
  const arrivalSeqRef = useRef(arrivalBurstSeq);
  useEffect(() => { progressRef.current = Math.max(0, Math.min(1, progress)); }, [progress]);
  useEffect(() => { boostSeqRef.current = boostSeq; }, [boostSeq]);
  useEffect(() => { glitchSeqRef.current = glitchSeq; }, [glitchSeq]);
  useEffect(() => { isLastRef.current = isLast; }, [isLast]);
  useEffect(() => { arrivalSeqRef.current = arrivalBurstSeq; }, [arrivalBurstSeq]);

  useEffect(() => {
    let renderer, scene, camera, frameId, clock, ro, resizeTimer;
    let cancelled = false;
    const mount = mountRef.current;
    if (!mount) return;
    const geos = [], mats = [], texs = [];

    loadThree().then((THREE) => {
      if (cancelled || !mount) return;

      const vw = () => mount.clientWidth || window.innerWidth || 1280;
      const vh = () => mount.clientHeight || window.innerHeight || 720;
      let W = vw(), H = vh();
      const isMobile = W < 760;

      try { renderer = new THREE.WebGLRenderer({ antialias: !isMobile, alpha: true, powerPreference: 'low-power' }); }
      catch (e) { if (!cancelled) setFailed(true); return; }
      // Чуть скромнее боевой сцены: фон не должен жрать GPU.
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
      renderer.setSize(W, H, false);                  // false → НЕ трогаем CSS-размер канваса
      // Канвас всегда заполняет контейнер (inset:0) через CSS 100%. Когда высота
      // вьюпорта «дышит» от адресной строки iOS, CSS просто растягивает уже
      // отрисованный кадр — без переразмера буфера, т.е. без clear/reproject и без
      // мигания планеты.
      const cv = renderer.domElement;
      cv.style.width = '100%'; cv.style.height = '100%'; cv.style.display = 'block';
      mount.appendChild(cv);

      scene = new THREE.Scene();
      // Глубина как в BattleScene3D, но мягче (дальние звёзды слегка тонут в темноте).
      scene.fog = new THREE.FogExp2(0x070b18, 0.012);
      camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 200);
      camera.position.set(0, 0, 0.01);
      camera.lookAt(0, 0, -1);

      // ── Звёзды: мягкий glow-спрайт (плотное ядро + чистый ореол) + ПЕР-ЗВЁЗДНАЯ
      //    вариация размера/яркости/цвета — глубина вместо однородной «пыли».
      //    Кастомный шейдер Points (aSize/aAlpha/aColor) + тонкое мерцание. Звёзд
      //    меньше, чем было, но они выразительнее. ──
      const SS = 64; const sc = document.createElement('canvas'); sc.width = sc.height = SS;
      const sctx = sc.getContext('2d');
      const sg = sctx.createRadialGradient(SS/2, SS/2, 0, SS/2, SS/2, SS/2);
      sg.addColorStop(0.00, 'rgba(255,255,255,1)');     // плотное ядро
      sg.addColorStop(0.16, 'rgba(255,255,255,0.9)');
      sg.addColorStop(0.42, 'rgba(255,255,255,0.25)');  // быстрый спад → чистая звезда
      sg.addColorStop(1.00, 'rgba(255,255,255,0)');     // мягкий край ореола
      sctx.fillStyle = sg; sctx.fillRect(0, 0, SS, SS);
      const starTex = new THREE.CanvasTexture(sc); texs.push(starTex);

      const STAR_N = isMobile ? 240 : 380;               // меньше, но выразительнее
      const sPos = new Float32Array(STAR_N * 3);
      const sSize = new Float32Array(STAR_N);
      const sAlpha = new Float32Array(STAR_N);
      const sColor = new Float32Array(STAR_N * 3);
      const sPhase = new Float32Array(STAR_N);
      const frac = (x) => x - Math.floor(x);
      // Палитра: преимущественно бело-голубые, изредка тёплые (живее, чем моно).
      const COLORS = [ [0.86,0.92,1.0], [1.0,1.0,1.0], [0.70,0.82,1.0], [1.0,0.91,0.80], [0.93,0.87,1.0] ];
      for (let i = 0; i < STAR_N; i++) {
        const r = 40 + frac(i * 0.61803) * 30;           // 40..70
        const th = i * 2.399963;                         // golden-angle азимут
        const ph = Math.acos(1 - 2 * ((i % 200) / 200)); // полная сфера
        sPos[i*3]   = r * Math.sin(ph) * Math.cos(th);
        sPos[i*3+1] = r * Math.cos(ph);
        sPos[i*3+2] = r * Math.sin(ph) * Math.sin(th);
        // Степенное распределение: много мелких/тусклых, мало крупных/ярких.
        const big = Math.pow(frac(i * 0.7548 + 0.13), 3);
        sSize[i]  = 0.9 + big * 6.2;                     // px ≈ aSize·PR·300/(-z)
        sAlpha[i] = 0.30 + big * 0.65;                   // крупные — заметно ярче
        sPhase[i] = frac(i * 0.317) * 6.2831;
        const c = COLORS[i % COLORS.length];
        sColor[i*3] = c[0]; sColor[i*3+1] = c[1]; sColor[i*3+2] = c[2];
      }
      const starGeo = new THREE.BufferGeometry(); geos.push(starGeo);
      starGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
      starGeo.setAttribute('aSize',  new THREE.BufferAttribute(sSize, 1));
      starGeo.setAttribute('aAlpha', new THREE.BufferAttribute(sAlpha, 1));
      starGeo.setAttribute('aColor', new THREE.BufferAttribute(sColor, 3));
      starGeo.setAttribute('aPhase', new THREE.BufferAttribute(sPhase, 1));
      const starUniforms = { uMap: { value: starTex }, uTime: { value: 0 }, uPR: { value: renderer.getPixelRatio() } };
      const starMat = new THREE.ShaderMaterial({
        uniforms: starUniforms,
        vertexShader: `
          attribute float aSize; attribute float aAlpha; attribute vec3 aColor; attribute float aPhase;
          uniform float uTime; uniform float uPR;
          varying float vAlpha; varying vec3 vColor;
          void main(){
            float tw = 0.84 + 0.16 * sin(uTime * 1.1 + aPhase);   // тонкое мерцание
            vAlpha = aAlpha * tw; vColor = aColor;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            float sz = aSize * uPR * (300.0 / max(-mv.z, 1.0));    // перспективное затухание
            gl_PointSize = clamp(sz, 0.0, 26.0 * uPR);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          uniform sampler2D uMap; varying float vAlpha; varying vec3 vColor;
          void main(){
            vec4 tex = texture2D(uMap, gl_PointCoord);
            gl_FragColor = vec4(vColor, 1.0) * tex * vAlpha;       // additive glow
          }`,
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
      });
      mats.push(starMat);
      const stars = new THREE.Points(starGeo, starMat);
      scene.add(stars);

      // ── Планета «mastered» (шейдеры SkillPlanet3D, uLife=1) — вдали, вверху-слева ──
      const sunDir = new THREE.Vector3(0.7, 0.35, 0.6).normalize();
      const uniforms = {
        uLife:    { value: 1.0 },   // освоенная: океаны + зелень + атмосфера
        uSunDir:  { value: sunDir },
        uAmbient: { value: 0.16 },
      };
      const planetGroup = new THREE.Group();
      const PR = isMobile ? 1.5 : 1.9;
      planetGroup.scale.setScalar(PR);
      planetGroup.rotation.z = 0.35;
      scene.add(planetGroup);

      // ── Траектория «полёта к планете» по ДОЛЕ прохождения (progress 0..1) ──
      // Позиция задаётся в нормализованных экранных координатах (ndc) и переводится
      // в мир через FOV+aspect → планета НЕ уходит из кадра и адаптируется к ширине
      // экрана. По мере progress: дистанция сокращается (z: FAR→NEAR, планета
      // крупнеет), а якорь поднимается к ВЕРХНЕМУ краю и чуть вбок — растущая
      // планета заполняет верх/поля, проходя МИМО карточки (на узком мобайле не
      // наезжает на текст). Финальное «прибытие» — отдельный шаг (NEAR не вплотную).
      // progress=0 воспроизводит прежний прод-вид (углы FAR подобраны под старые
      // мировые координаты -2.0,2.4 / -3.4,2.0 при z=-9).
      const lerp = (a, b, t) => a + (b - a) * t;
      const tanHalfFov = Math.tan((55 * Math.PI / 180) / 2);
      const Z_FAR = -9, Z_NEAR = -4.4, Z_ARRIVAL = -3.4;   // последняя задача — ближе, чем когда-либо
      const NDX_FAR = isMobile ? -0.92 : -0.45, NDX_NEAR = isMobile ? -0.30 : -0.52;
      const NDY_FAR = isMobile ?  0.51 : 0.43,  NDY_NEAR = isMobile ?  1.00 : 0.74;
      const BOOST_DUR = 0.7, BOOST_DZ = 0.9;     // верный ответ: короткий рывок ближе
      const GLITCH_DUR = 0.45, SHAKE = 0.05;     // неверный: лёгкая тряска, БЕЗ отката
      const ARRIVAL_DUR = 1.4, ARRIVAL_DZ = 1.3; // финал: сильный бело-голубой bloom + рывок
      let dispProg = progressRef.current;        // дисплейная доля, плавно догоняет цель
      let seenBoost = boostSeqRef.current, boostStart = -1;
      let seenGlitch = glitchSeqRef.current, glitchStart = -1;
      let seenArrival = arrivalSeqRef.current, arrivalStart = -1;

      const planetGeo = new THREE.SphereGeometry(1, 48, 48); geos.push(planetGeo);
      const planetMat = new THREE.ShaderMaterial({ uniforms, vertexShader: PLANET_VERT, fragmentShader: PLANET_FRAG, fog: false }); mats.push(planetMat);
      const planet = new THREE.Mesh(planetGeo, planetMat);
      planetGroup.add(planet);

      const cloudGeo = new THREE.SphereGeometry(1.02, 40, 40); geos.push(cloudGeo);
      const cloudMat = new THREE.ShaderMaterial({ uniforms, vertexShader: PLANET_VERT, fragmentShader: CLOUD_FRAG, transparent: true, depthWrite: false, fog: false }); mats.push(cloudMat);
      const clouds = new THREE.Mesh(cloudGeo, cloudMat);
      planetGroup.add(clouds);

      // Атмосферная дымка: крупная оболочка (1.7) даёт длинный внешний хвост, куда
      // дымке угасать; профиль плотности в шейдере держит пик у поверхности планеты,
      // а к внешнему краю — долгий плавный градиент в 0. front-side + локальный шейдер.
      const atmoUniforms = { uSunDir: { value: sunDir }, uIntensity: { value: 1.05 } };
      const atmoGeo = new THREE.SphereGeometry(1.7, 48, 48); geos.push(atmoGeo);
      const atmoMat = new THREE.ShaderMaterial({ uniforms: atmoUniforms, vertexShader: ATMO_VERT, fragmentShader: SOFT_ATMO_FRAG, transparent: true, side: THREE.FrontSide, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }); mats.push(atmoMat);
      const atmo = new THREE.Mesh(atmoGeo, atmoMat);
      planetGroup.add(atmo);

      // ResizeObserver, устойчивый к «дыханию» вьюпорта iOS. На мобайле адресная
      // строка при скролле постоянно меняет ВЫСОТУ (ширина та же). Раньше это
      // дёргало setSize + camera.aspect на каждый кадр → офф-центровая планета
      // мигала. Теперь height-only изменения в пределах полосы адресной строки
      // игнорируем (CSS 100% и так держит канвас заполненным); реальные ресайзы
      // (поворот экрана, ресайз окна) применяем один раз, с дебаунсом.
      let lastW = W, lastH = H;
      const ADDR_BAND = 160;   // высота адресной строки iOS ≈ 60–150px
      const applyResize = () => {
        if (!renderer || !mount) return;
        const nW = vw(), nH = vh();
        if (nW === lastW && nH === lastH) return;
        lastW = nW; lastH = nH; W = nW; H = nH;
        renderer.setSize(W, H, false);
        camera.aspect = W / H; camera.updateProjectionMatrix();
      };
      ro = new ResizeObserver(() => {
        if (!renderer || !mount) return;
        const nW = vw(), nH = vh();
        // iOS-«дыхание»: ширина та же, высота сменилась в пределах полосы адресной
        // строки → НЕ пересоздаём (иначе мигание при скролле).
        if (isMobile && nW === lastW && Math.abs(nH - lastH) <= ADDR_BAND) return;
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(applyResize, 150);
      });
      ro.observe(mount);

      clock = new THREE.Clock();
      let last = 0;
      const animate = () => {
        frameId = requestAnimationFrame(animate);
        const t = clock.getElapsedTime();
        const dt = Math.min(t - last, 0.05); last = t;

        // ── Импульсы ответов (через ref, без пересоздания сцены) ──
        if (boostSeqRef.current !== seenBoost)   { seenBoost = boostSeqRef.current;   boostStart = t; }
        if (glitchSeqRef.current !== seenGlitch) { seenGlitch = glitchSeqRef.current; glitchStart = t; }
        let boost = 0;
        if (boostStart >= 0) { const e = t - boostStart; if (e < BOOST_DUR) boost = Math.sin(e / BOOST_DUR * Math.PI); else boostStart = -1; }
        let glitch = 0;
        if (glitchStart >= 0) { const e = t - glitchStart; if (e < GLITCH_DUR) glitch = 1 - e / GLITCH_DUR; else glitchStart = -1; }
        if (arrivalSeqRef.current !== seenArrival) { seenArrival = arrivalSeqRef.current; arrivalStart = t; }
        let arrival = 0;
        if (arrivalStart >= 0) { const e = t - arrivalStart; if (e < ARRIVAL_DUR) arrival = Math.sin(e / ARRIVAL_DUR * Math.PI); else arrivalStart = -1; }

        // ── Плавный lerp дисплейной доли к целевой (смена задачи — не скачком) ──
        dispProg += (progressRef.current - dispProg) * Math.min(1, dt * 2.5);

        // ── Дистанция + якорь по доле; на последней задаче — ближе всего (Z_ARRIVAL).
        // easeIn (pow 1.4): начало далеко/спокойно, к концу — заметнее «налёт». ──
        const e = Math.pow(dispProg, 1.4);
        const isLastNow = isLastRef.current;
        const eUsed = isLastNow ? Math.min(1, e + 0.18) : e;   // финал подтягивается к самому близкому
        const zNear = isLastNow ? Z_ARRIVAL : Z_NEAR;
        const z = lerp(Z_FAR, zNear, eUsed) + BOOST_DZ * boost + ARRIVAL_DZ * arrival;
        const ndcX = lerp(NDX_FAR, NDX_NEAR, eUsed);
        const ndcY = lerp(NDY_FAR, NDY_NEAR, eUsed);
        const halfH = Math.abs(z) * tanHalfFov;
        const halfW = halfH * camera.aspect;
        planetGroup.position.set(ndcX * halfW, ndcY * halfH, z);

        // Атмосфера: на финале плотнее/ярче; arrival-burst — кульминационный bloom.
        atmoUniforms.uIntensity.value = (isLastNow ? 1.5 : 1.05) + arrival * 2.4;

        // ── Сбой: лёгкая тряска камеры (без отдаления) + красный блик ──
        camera.position.x = glitch ? Math.sin(t * 72) * SHAKE * glitch : 0;
        camera.position.y = glitch ? Math.cos(t * 64) * SHAKE * glitch : 0;
        // Бело-голубая вспышка: обычный буст слабее, arrival (финал) — сильнее/ярче.
        if (boostFlashRef.current)  boostFlashRef.current.style.opacity  = Math.max(boost * 0.42, arrival * 0.78).toFixed(3);
        if (glitchFlashRef.current) glitchFlashRef.current.style.opacity = (glitch * 0.5).toFixed(3);

        starUniforms.uTime.value = t;
        // Тонкое движение: звёзды очень медленно плывут, планета чуть вращается.
        stars.rotation.y = t * 0.006;
        stars.rotation.x = Math.sin(t * 0.03) * 0.02;
        planet.rotation.y = t * 0.04;
        clouds.rotation.y = t * 0.055;
        renderer.render(scene, camera);
      };
      animate();
    }).catch((e) => { console.warn('[daily-bg] three load failed:', e?.message || e); if (!cancelled) setFailed(true); });

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
        if (renderer.forceContextLoss) renderer.forceContextLoss();   // освобождаем WebGL-контекст
      }
    };
  }, []);

  // Базовый космический фон-радиал = и подложка, и фолбэк при сбое WebGL.
  const base = isDark
    ? 'radial-gradient(ellipse at 28% 22%, #0d1430 0%, #070b18 60%, #04060e 100%)'
    : 'radial-gradient(ellipse at 28% 22%, #0c1330 0%, #070b18 62%, #04060e 100%)';

  return (
    <div aria-hidden="true" style={{
      position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', background: base,
      // Отдельный стабильный композиционный слой: iOS меньше репейнтит фон при
      // скролле (динамическая адресная строка не дёргает слой) → меньше мерцания.
      transform: 'translateZ(0)', WebkitTransform: 'translateZ(0)',
      backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
    }}>
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />
      {/* Скрим читаемости: затемняет к центру/низу, где карточка и мелкий текст,
          оставляя планету вверху-слева яркой. Поверх канваса, под контентом. */}
      {!failed && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'linear-gradient(180deg, rgba(4,6,14,0.10) 0%, rgba(4,6,14,0.38) 45%, rgba(4,6,14,0.62) 100%)',
        }} />
      )}
      {/* Импульсы ответов (opacity управляется rAF-циклом через ref): верный ответ →
          короткая голубая вспышка у планеты; неверный → красный блик по краям. */}
      <div ref={boostFlashRef} aria-hidden="true" style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0, willChange: 'opacity',
        background: 'radial-gradient(ellipse at 28% 22%, rgba(130,205,255,0.6) 0%, rgba(130,205,255,0) 55%)',
      }} />
      <div ref={glitchFlashRef} aria-hidden="true" style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0, willChange: 'opacity',
        background: 'radial-gradient(ellipse at 50% 50%, rgba(255,50,50,0) 38%, rgba(255,40,40,0.55) 100%)',
      }} />
    </div>
  );
}
