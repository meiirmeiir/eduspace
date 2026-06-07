import React, { useEffect, useMemo, useRef, useState } from 'react';
import { loadThree } from '../../lib/loadThree.js';

// Фон карты модулей: спокойный космос. Звёздное поле (Points+шейдер мерцания),
// приглушённые туманности (glow-спрайты) и 10 созвездий-формул — группы звёзд,
// соединённых тонкими линиями в виде матсимволов; линии проявляются волной
// (прорисовка ребро-за-ребром → держим → гаснут), у каждого созвездия своё время.
// CSS-градиент-база рисуется всегда. При сбое Three.js → CSS-звёзды. Полный
// cleanup. Фиксирован за ReactFlow — яркие планеты-узлы остаются главными.

// ── Формы созвездий: 2D-точки (лок. координаты ~[-1,1], y вверх) + пары рёбер ──
const CONSTELLATIONS = [
  { name: 'Δ', pts: [[0, 1], [-0.9, -0.8], [0.9, -0.8]], edges: [[0, 1], [1, 2], [2, 0]] },
  { name: 'π', pts: [[-0.8, 0.7], [0.8, 0.7], [-0.4, 0.7], [-0.5, -0.8], [0.4, 0.7], [0.5, -0.8]], edges: [[0, 1], [2, 3], [4, 5]] },
  { name: 'Σ', pts: [[0.8, 0.9], [-0.8, 0.9], [0, 0], [-0.8, -0.9], [0.8, -0.9]], edges: [[0, 1], [1, 2], [2, 3], [3, 4]] },
  { name: '√', pts: [[-0.9, 0], [-0.55, -0.7], [-0.1, 0.9], [0.9, 0.9]], edges: [[0, 1], [1, 2], [2, 3]] },
  { name: '∫', pts: [[0.35, 0.95], [0.05, 0.75], [0, 0.1], [0, -0.1], [-0.05, -0.75], [-0.35, -0.95]], edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]] },
  { name: '∞', pts: [[-0.9, 0], [-0.45, 0.45], [0, 0], [-0.45, -0.45], [0.45, 0.45], [0.9, 0], [0.45, -0.45]], edges: [[0, 1], [1, 2], [2, 3], [3, 0], [2, 4], [4, 5], [5, 6], [6, 2]] },
  { name: 'θ', pts: [[0, 0.9], [0.65, 0.5], [0.65, -0.5], [0, -0.9], [-0.65, -0.5], [-0.65, 0.5], [-0.5, 0], [0.5, 0]], edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [6, 7]] },
  { name: '≈', pts: [[-0.6, 0.3], [0, 0.45], [0.6, 0.3], [-0.6, -0.3], [0, -0.15], [0.6, -0.3]], edges: [[0, 1], [1, 2], [3, 4], [4, 5]] },
  { name: '×', pts: [[-0.7, 0.7], [0.7, -0.7], [0.7, 0.7], [-0.7, -0.7]], edges: [[0, 1], [2, 3]] },
  { name: '÷', pts: [[-0.7, 0], [0.7, 0], [0, 0.45], [0, -0.45]], edges: [[0, 1]] }, // 2 точки-«дота» без рёбер
];

// Размещение каждого созвездия: fx,fy (доли полукадра на глубине z), z, scale,
// цвет, период вспышки (сек), сдвиг фазы (сек) — разбросаны, вспыхивают вразнобой.
const PLACE = [
  { fx: -0.78, fy: 0.55, z: -26, scale: 4.2, color: 0x9db4ff, period: 9.0, offset: 0.0 },
  { fx: 0.72, fy: 0.68, z: -33, scale: 5.0, color: 0xc6a8ff, period: 11.0, offset: 4.5 },
  { fx: -0.28, fy: 0.82, z: -40, scale: 5.6, color: 0x8fe0ff, period: 10.0, offset: 7.0 },
  { fx: 0.42, fy: -0.18, z: -22, scale: 3.6, color: 0xffd9a0, period: 12.0, offset: 2.0 },
  { fx: -0.82, fy: -0.45, z: -30, scale: 4.6, color: 0x9db4ff, period: 10.5, offset: 5.5 },
  { fx: 0.80, fy: -0.55, z: -36, scale: 5.2, color: 0xb6c4ff, period: 9.5, offset: 1.5 },
  { fx: 0.05, fy: -0.80, z: -44, scale: 6.0, color: 0xc6a8ff, period: 11.5, offset: 8.0 },
  { fx: -0.46, fy: 0.06, z: -24, scale: 3.8, color: 0x8fe0ff, period: 10.0, offset: 3.0 },
  { fx: 0.30, fy: 0.28, z: -48, scale: 5.4, color: 0xa0ffd0, period: 12.5, offset: 6.0 },
  { fx: -0.10, fy: -0.34, z: -28, scale: 4.0, color: 0xffe0b0, period: 9.0, offset: 9.0 },
];

// Звёзды (фон + узлы созвездий): мягкая круглая точка, перспективный размер,
// мерцание по индивидуальной фазе/частоте. Узлы кодируются бóльшим aSize/aBright.
const STAR_VERT = `
  attribute float aSize; attribute float aPhase; attribute float aBright; attribute float aTw;
  uniform float uTime; uniform float uPixelRatio;
  varying float vBright; varying float vTw;
  void main() {
    float tw = 0.7 + 0.3 * sin(uTime * aTw + aPhase);
    vBright = aBright; vTw = tw;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * tw * uPixelRatio * (60.0 / -mv.z);
  }
`;
const STAR_FRAG = `
  precision mediump float;
  varying float vBright; varying float vTw;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d); a *= a;
    vec3 col = mix(vec3(0.74, 0.82, 1.0), vec3(1.0), vBright);
    gl_FragColor = vec4(col, a * vBright * vTw * 0.9);
  }
`;

// Линии созвездия: волна проявления по uCyc (0..1) и порядку ребра aT (0..1).
const LINE_VERT = `
  attribute float aT;
  varying float vT;
  void main() {
    vT = aT;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const LINE_FRAG = `
  precision mediump float;
  varying float vT;
  uniform float uCyc;
  uniform vec3 uColor;
  void main() {
    float a;
    if (uCyc < 0.35)      a = smoothstep(vT - 0.06, vT + 0.02, uCyc / 0.35); // прорисовка по порядку
    else if (uCyc < 0.60) a = 1.0;                                           // держим
    else if (uCyc < 0.78) a = 1.0 - (uCyc - 0.60) / 0.18;                    // гаснет
    else                  a = 0.0;                                           // тёмный промежуток
    // Намёк на созвездие, а не wireframe: призрак 0.02, пик вспышки ~0.055.
    gl_FragColor = vec4(uColor, 0.02 + 0.035 * a);
  }
`;

function makeGlowTexture(THREE) {
  const S = 128;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.4, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(c);
}

// CSS-звёзды для фолбэка
function starShadows(n, w, h) {
  return Array.from({ length: n }, () => `${Math.round(Math.random() * w)}px ${Math.round(Math.random() * h)}px #fff`).join(', ');
}

export default function MapBackground({ progress = 0 }) {
  const mountRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const warm = Math.min(0.3, Math.max(0, progress) * 0.32);
  const stars1 = useMemo(() => starShadows(70, 1600, 1000), []);
  const stars2 = useMemo(() => starShadows(34, 1600, 1000), []);

  useEffect(() => {
    let renderer, scene, camera, frameId, clock;
    const geos = []; const mats = []; const texs = [];
    let cancelled = false, ro = null;
    const mount = mountRef.current;
    if (!mount) return;

    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMove = (e) => { mouse.tx = (e.clientX / window.innerWidth) * 2 - 1; mouse.ty = (e.clientY / window.innerHeight) * 2 - 1; };

    loadThree().then((THREE) => {
      if (cancelled || !mount) return;
      let W = mount.clientWidth || 800, H = mount.clientHeight || 600;
      const FOV = 60, fovR = (FOV * Math.PI) / 180;
      const pr = Math.min(window.devicePixelRatio || 1, 2);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(pr);
      renderer.setSize(W, H);
      mount.appendChild(renderer.domElement);
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(FOV, W / H, 0.1, 1000);
      camera.position.set(0, 0, 0); camera.lookAt(0, 0, -30);

      const frustumAt = (z) => { const hH = Math.tan(fovR / 2) * Math.abs(z); return { hH, hW: hH * (W / H) }; };

      // ── Звёзды: фоновое поле + узлы созвездий в одной геометрии ──
      const pos = [], aSize = [], aPhase = [], aBright = [], aTw = [];
      const pushStar = (x, y, z, size, bright, tw) => {
        pos.push(x, y, z); aSize.push(size); aBright.push(bright); aTw.push(tw); aPhase.push(Math.random() * Math.PI * 2);
      };

      // фоновое поле (~500): разброс по глубине для параллакса, чуть шире кадра.
      // Три класса звёзд: 70% мелкая пыль · 25% обычные · 5% яркие с glow.
      const STAR_COUNT = 500;
      for (let i = 0; i < STAR_COUNT; i++) {
        const z = -(12 + Math.random() * 58);
        const { hH, hW } = frustumAt(z);
        const r = Math.random();
        let size, bright;
        if (r < 0.70)      { size = 1.0 + Math.random() * 0.4; bright = 0.30 + Math.random() * 0.20; }
        else if (r < 0.95) { size = 1.6 + Math.random() * 0.6; bright = 0.50 + Math.random() * 0.20; }
        else               { size = 2.6 + Math.random() * 0.8; bright = 0.85 + Math.random() * 0.15; }
        pushStar((Math.random() * 2 - 1) * hW * 1.4, (Math.random() * 2 - 1) * hH * 1.4, z,
          size, bright, 0.4 + Math.random() * 0.8);
      }

      // узлы созвездий (мировые координаты) + линии
      const lineRecords = [];
      CONSTELLATIONS.forEach((cst, ci) => {
        const p = PLACE[ci % PLACE.length];
        const { hH, hW } = frustumAt(p.z);
        const cx = p.fx * hW, cy = p.fy * hH;
        // мировые точки символа
        const wp = cst.pts.map(([px, py]) => [cx + px * p.scale, cy + py * p.scale, p.z]);
        // узлы-звёзды — ярче и крупнее фоновых, спокойное мерцание
        wp.forEach(([x, y, z]) => pushStar(x, y, z, 2.6 + Math.random() * 1.0, 0.9 + Math.random() * 0.1, 0.3 + Math.random() * 0.3));

        // линии-рёбра: 2 вершины на ребро, aT = порядок ребра
        const lp = [], lt = [];
        const denom = Math.max(1, cst.edges.length - 1);
        cst.edges.forEach(([i, j], ei) => {
          const t = ei / denom;
          lp.push(wp[i][0], wp[i][1], wp[i][2], wp[j][0], wp[j][1], wp[j][2]);
          lt.push(t, t);
        });
        if (lp.length) {
          const lg = new THREE.BufferGeometry();
          lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
          lg.setAttribute('aT', new THREE.Float32BufferAttribute(lt, 1));
          const lm = new THREE.ShaderMaterial({
            uniforms: { uCyc: { value: 0 }, uColor: { value: new THREE.Color(p.color) } },
            vertexShader: LINE_VERT, fragmentShader: LINE_FRAG,
            transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
          });
          const seg = new THREE.LineSegments(lg, lm);
          scene.add(seg); geos.push(lg); mats.push(lm);
          lineRecords.push({ mat: lm, period: p.period, offset: p.offset });
        }
      });

      const starGeo = new THREE.BufferGeometry();
      starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      starGeo.setAttribute('aSize', new THREE.Float32BufferAttribute(aSize, 1));
      starGeo.setAttribute('aPhase', new THREE.Float32BufferAttribute(aPhase, 1));
      starGeo.setAttribute('aBright', new THREE.Float32BufferAttribute(aBright, 1));
      starGeo.setAttribute('aTw', new THREE.Float32BufferAttribute(aTw, 1));
      const starMat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uPixelRatio: { value: pr } },
        vertexShader: STAR_VERT, fragmentShader: STAR_FRAG,
        transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
      });
      const starField = new THREE.Points(starGeo, starMat);
      scene.add(starField); geos.push(starGeo); mats.push(starMat);

      // ── Туманности: 3 приглушённых сине-фиолетовых glow-спрайта в глубине ──
      const glowTex = makeGlowTexture(THREE); texs.push(glowTex);
      const nebulae = [];
      [[0x3b3a8f, -0.45, 0.25, -74], [0x5b3a8a, 0.5, -0.3, -84], [0x2a4a8f, -0.05, -0.5, -92]].forEach(([col, fx, fy, z]) => {
        const m = new THREE.SpriteMaterial({ map: glowTex, color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, opacity: 0.09 });
        const sp = new THREE.Sprite(m);
        const { hH, hW } = frustumAt(z);
        sp.position.set(fx * hW, fy * hH, z);
        const sc = 70 + Math.random() * 40; sp.scale.set(sc, sc, 1);
        sp.userData = { vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25, baseOp: 0.07 + Math.random() * 0.04, twFreq: 0.18 + Math.random() * 0.18, phase: Math.random() * 6, z };
        scene.add(sp); nebulae.push(sp); mats.push(m);
      });

      clock = new THREE.Clock(); let last = 0;
      const animate = () => {
        frameId = requestAnimationFrame(animate);
        const t = clock.getElapsedTime(); const dt = Math.min(t - last, 0.05); last = t;
        mouse.x += (mouse.tx - mouse.x) * 0.04; mouse.y += (mouse.ty - mouse.y) * 0.04;
        camera.position.x = mouse.x * 3; camera.position.y = -mouse.y * 3; camera.lookAt(0, 0, -30);

        starMat.uniforms.uTime.value = t;

        for (const sp of nebulae) {
          const u = sp.userData;
          sp.position.x += u.vx * dt; sp.position.y += u.vy * dt;
          const { hH, hW } = frustumAt(u.z), mx = hW + sp.scale.x, my = hH + sp.scale.y;
          if (sp.position.x > mx) sp.position.x = -mx; else if (sp.position.x < -mx) sp.position.x = mx;
          if (sp.position.y > my) sp.position.y = -my; else if (sp.position.y < -my) sp.position.y = my;
          sp.material.opacity = u.baseOp * (0.8 + 0.2 * Math.sin(t * u.twFreq + u.phase));
        }

        for (const r of lineRecords) {
          r.mat.uniforms.uCyc.value = ((t + r.offset) % r.period) / r.period;
        }

        renderer.render(scene, camera);
      };
      animate();

      ro = new ResizeObserver(() => {
        if (!renderer || !mount) return;
        W = mount.clientWidth || W; H = mount.clientHeight || H;
        renderer.setSize(W, H); camera.aspect = W / H; camera.updateProjectionMatrix();
      });
      ro.observe(mount);
      window.addEventListener('mousemove', onMove);
    }).catch((e) => { console.warn('[mapbg] three load failed:', e?.message || e); if (!cancelled) setFailed(true); });

    return () => {
      cancelled = true;
      if (frameId) cancelAnimationFrame(frameId);
      if (ro) ro.disconnect();
      window.removeEventListener('mousemove', onMove);
      geos.forEach((g) => g.dispose && g.dispose());
      mats.forEach((m) => m.dispose && m.dispose());
      texs.forEach((t) => t.dispose && t.dispose());
      if (renderer) {
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
        renderer.dispose();
        if (renderer.forceContextLoss) renderer.forceContextLoss();
      }
    };
  }, []);

  return (
    <div aria-hidden="true" style={{
      position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0,
      // Nebula-пятна (верхние слои) поверх базового тёмного градиента: очень
      // мягкие цветовые туманности для глубины. CSS-градиенты с плавным spадом
      // до transparent — работают и при WebGL-фолбэке, ноды рисуются поверх.
      background: [
        'radial-gradient(circle 380px at 22% 20%, rgba(124,58,237,0.10), transparent 70%)',  // фиолетовая, верх-лево
        'radial-gradient(circle 350px at 74% 46%, rgba(59,130,246,0.08), transparent 70%)',  // синяя, центр-право
        'radial-gradient(circle 260px at 44% 88%, rgba(190,24,93,0.06), transparent 70%)',   // тёмно-розовая, низ
        'radial-gradient(circle 200px at 10% 60%, rgba(6,182,212,0.05), transparent 70%)',   // бирюзовая, между классами
        'radial-gradient(ellipse at 50% 38%, #14132e 0%, #0a0a1e 46%, #05050f 100%)',
      ].join(', '),
    }}>
      {/* WebGL-космос поверх градиента; при сбое — CSS-звёзды */}
      {!failed
        ? <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />
        : (
          <>
            <div className="map-stars map-stars-a" style={{ boxShadow: stars1 }} />
            <div className="map-stars map-stars-b" style={{ boxShadow: stars2 }} />
          </>
        )}
      {/* тёплый подсвет по прогрессу */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: `radial-gradient(ellipse at 50% 62%, rgba(251,191,36,${warm}) 0%, transparent 58%)` }} />
    </div>
  );
}
