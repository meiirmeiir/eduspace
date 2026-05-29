import React, { useEffect, useMemo, useRef, useState } from 'react';
import { loadThree } from '../../lib/loadThree.js';

// Фон карты модулей: WebGL-сцена с парящими матсимволами в космической глубине.
// CSS-градиент-база рисуется всегда (и как backdrop под прозрачным canvas, и как
// фолбэк). При сбое Three.js → CSS-звёзды. Полный cleanup. Фиксирован за ReactFlow.

const SYMBOLS = ['0','1','2','3','4','5','6','7','8','9','+','−','×','÷','=','√','∫','∑','π','∞','≠','≤','≥','α','β','θ','Δ','x²','xⁿ','(',')','{','}'];
const TINTS = [0xfbbf24, 0xa855f7, 0xbfdbfe]; // золото / пурпур / сине-белый

function makeGlyphTexture(THREE, ch) {
  const S = 64;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `600 ${ch.length > 1 ? 34 : 42}px Georgia, 'Times New Roman', serif`;
  ctx.fillText(ch, S / 2, S / 2 + 2);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 2;
  return t;
}
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
    const glyphCache = {}; const mats = []; const texs = [];
    let cancelled = false, ro = null;
    const mount = mountRef.current;
    if (!mount) return;

    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMove = (e) => { mouse.tx = (e.clientX / window.innerWidth) * 2 - 1; mouse.ty = (e.clientY / window.innerHeight) * 2 - 1; };

    loadThree().then((THREE) => {
      if (cancelled || !mount) return;
      let W = mount.clientWidth || 800, H = mount.clientHeight || 600;
      const FOV = 60, fovR = (FOV * Math.PI) / 180;

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(W, H);
      mount.appendChild(renderer.domElement);
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(FOV, W / H, 0.1, 1000);
      camera.position.set(0, 0, 0); camera.lookAt(0, 0, -30);

      const getTex = (ch) => (glyphCache[ch] || (glyphCache[ch] = makeGlyphTexture(THREE, ch)));
      const sprites = [];

      // ── ~50 парящих символов ──
      const COUNT = 50;
      for (let i = 0; i < COUNT; i++) {
        const ch = SYMBOLS[(Math.random() * SYMBOLS.length) | 0];
        const tex = getTex(ch);
        const mat = new THREE.SpriteMaterial({ map: tex, color: TINTS[(Math.random() * TINTS.length) | 0], transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false });
        const sp = new THREE.Sprite(mat);
        const z = -(8 + Math.random() * 55);
        const hH = Math.tan(fovR / 2) * Math.abs(z), hW = hH * (W / H);
        sp.position.set((Math.random() * 2 - 1) * hW, (Math.random() * 2 - 1) * hH, z);
        const scale = 2.2 + Math.random() * 3.6;
        sp.scale.set(scale, scale, 1);
        sp.material.rotation = Math.random() * Math.PI * 2;
        sp.userData = {
          vx: (Math.random() - 0.5) * 1.6, vy: (Math.random() - 0.5) * 1.6,
          angVel: (Math.random() - 0.5) * 0.3,
          baseOp: 0.16 + Math.random() * 0.34,        // приглушённо (читаемость узлов)
          twFreq: 0.6 + Math.random() * 1.2, phase: Math.random() * Math.PI * 2,
        };
        scene.add(sp); sprites.push(sp); mats.push(mat);
      }

      // ── 3 лёгких glow-спрайта (туманность) ──
      const glowTex = makeGlowTexture(THREE); texs.push(glowTex);
      const glows = [];
      [[0xfbbf24, -0.4, 0.2], [0xa855f7, 0.5, -0.3], [0x6366f1, -0.1, -0.5]].forEach(([col, fx, fy], k) => {
        const m = new THREE.SpriteMaterial({ map: glowTex, color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.1 });
        const sp = new THREE.Sprite(m);
        const z = -75 - k * 8, hH = Math.tan(fovR / 2) * Math.abs(z), hW = hH * (W / H);
        sp.position.set(fx * hW, fy * hH, z);
        const sc = 60 + Math.random() * 40; sp.scale.set(sc, sc, 1);
        sp.userData = { baseOp: 0.08 + Math.random() * 0.06, twFreq: 0.25 + Math.random() * 0.25, phase: Math.random() * 6 };
        scene.add(sp); glows.push(sp); mats.push(m);
      });

      clock = new THREE.Clock(); let last = 0;
      const animate = () => {
        frameId = requestAnimationFrame(animate);
        const t = clock.getElapsedTime(); const dt = Math.min(t - last, 0.05); last = t;
        mouse.x += (mouse.tx - mouse.x) * 0.04; mouse.y += (mouse.ty - mouse.y) * 0.04;
        camera.position.x = mouse.x * 3; camera.position.y = -mouse.y * 3; camera.lookAt(0, 0, -30);
        const aspect = camera.aspect;
        for (const s of sprites) {
          const u = s.userData;
          s.position.x += u.vx * dt; s.position.y += u.vy * dt;
          const z = Math.abs(s.position.z), hH = Math.tan(fovR / 2) * z, hW = hH * aspect, mx = hW + s.scale.x, my = hH + s.scale.y;
          if (s.position.x > mx) s.position.x = -mx; else if (s.position.x < -mx) s.position.x = mx;
          if (s.position.y > my) s.position.y = -my; else if (s.position.y < -my) s.position.y = my;
          s.material.rotation += u.angVel * dt;
          s.material.opacity = u.baseOp * (0.55 + 0.45 * Math.sin(t * u.twFreq + u.phase));
        }
        for (const g of glows) { const u = g.userData; g.material.opacity = u.baseOp * (0.7 + 0.3 * Math.sin(t * u.twFreq + u.phase)); }
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
      mats.forEach((m) => m.dispose && m.dispose());
      Object.values(glyphCache).forEach((t) => t.dispose && t.dispose());
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
      background: 'radial-gradient(ellipse at 50% 38%, #14132e 0%, #0a0a1e 46%, #05050f 100%)',
    }}>
      {/* WebGL-символы поверх градиента; при сбое — CSS-звёзды */}
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
