import React, { useEffect, useMemo, useRef, useState } from 'react';
import { loadThree } from '../lib/loadThree.js';
import { ensureCreatorStyles } from './creatorFx.js';

// Эксклюзивный WebGL-фон Создателя — «Полёт к звёздам» (под девиз «Через
// тернии к звёздам»). Звёздное поле с глубиной (warp), золото-пурпур туманность
// (fbm-шейдер), parallax за мышью, изредка комета. При сбое Three.js → фолбэк
// на CSS звёздный фон. Полный cleanup. Только для isCreator (рендерит
// PublicProfileScreen/ProfileSection).

function makeStarTexture(THREE) {
  const S = 32, c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.7)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(c);
}

function makeCometTexture(THREE) {
  const W = 256, H = 48, c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');        // конец хвоста — прозрачный
  g.addColorStop(0.75, 'rgba(251,191,36,0.5)');
  g.addColorStop(0.93, 'rgba(255,240,200,1)');     // голова — яркая
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, H * 0.33, W, H * 0.34);
  // мягкая голова-блоб
  const hg = ctx.createRadialGradient(W * 0.92, H / 2, 0, W * 0.92, H / 2, H * 0.55);
  hg.addColorStop(0, 'rgba(255,255,255,1)'); hg.addColorStop(1, 'rgba(255,210,140,0)');
  ctx.fillStyle = hg; ctx.fillRect(W * 0.78, 0, W * 0.22, H);
  return new THREE.CanvasTexture(c);
}

const NEBULA_VERT = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const NEBULA_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    float a = hash(i), b = hash(i+vec2(1.0,0.0)), c = hash(i+vec2(0.0,1.0)), d = hash(i+vec2(1.0,1.0));
    return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
  }
  float fbm(vec2 p){
    float v = 0.0, amp = 0.5;
    for (int i = 0; i < 4; i++){ v += amp * noise(p); p *= 2.0; amp *= 0.5; }
    return v;
  }
  void main(){
    vec2 uv = (vUv - 0.5) * 3.0;
    vec2 warp = vec2(fbm(uv + uTime*0.03), fbm(uv + 5.2 - uTime*0.025));
    float n = fbm(uv*1.5 + warp*1.6 + uTime*0.02);
    n = pow(n, 1.6);
    vec3 gold = vec3(0.98, 0.75, 0.14);
    vec3 purp = vec3(0.66, 0.33, 0.97);
    vec3 col = mix(purp, gold, smoothstep(0.3, 0.7, fbm(uv*0.8 + uTime*0.012)));
    float rad = 1.0 - smoothstep(0.45, 1.5, length(vUv - 0.5) * 2.0);
    float alpha = smoothstep(0.28, 0.95, n) * 0.5 * rad;
    gl_FragColor = vec4(col * n, alpha);
  }
`;

export default function CreatorBackground() {
  ensureCreatorStyles();
  const mountRef = useRef(null);
  const [failed, setFailed] = useState(false);

  // данные для CSS-фолбэка (на случай сбоя Three)
  const css = useMemo(() => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1440;
    const h = typeof window !== 'undefined' ? window.innerHeight : 900;
    const shadows = (n) => Array.from({ length: n }, () => `${Math.round(Math.random() * w)}px ${Math.round(Math.random() * h)}px #fff`).join(', ');
    return {
      s1: shadows(90), s2: shadows(40),
      floats: Array.from({ length: 8 }, (_, i) => ({ left: Math.random() * 100, delay: Math.random() * 8, dur: 9 + Math.random() * 8, gold: i % 2 === 0 })),
    };
  }, []);

  useEffect(() => {
    let renderer, scene, camera, frameId, clock;
    let starGeo, starMat, starTex, points, starBase, starSpd, starPhase;
    let nebGeo, nebMat;
    let cometTex, cometMat, comet;
    let cancelled = false;
    const mount = mountRef.current;
    if (!mount) return;

    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMove = (e) => { mouse.tx = (e.clientX / window.innerWidth) * 2 - 1; mouse.ty = (e.clientY / window.innerHeight) * 2 - 1; };
    let onResize = null;

    loadThree().then((THREE) => {
      if (cancelled || !mount) return;
      let W = window.innerWidth, H = window.innerHeight;

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(W, H);
      renderer.setClearColor(0x05030f, 1);          // глубокий космос
      mount.appendChild(renderer.domElement);

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(70, W / H, 0.1, 2000);
      camera.position.set(0, 0, 0);

      // ── Туманность (fbm-шейдер) — большая плоскость позади звёзд ──
      const NEB_Z = 500;
      const fitNebula = () => {
        const vH = 2 * Math.tan((70 * Math.PI) / 360) * NEB_Z;
        nebMesh.scale.set(vH * (W / H) * 1.3, vH * 1.3, 1);
      };
      nebGeo = new THREE.PlaneGeometry(1, 1);
      nebMat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: NEBULA_VERT, fragmentShader: NEBULA_FRAG,
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
      });
      const nebMesh = new THREE.Mesh(nebGeo, nebMat);
      nebMesh.position.set(0, 0, -NEB_Z);
      nebMesh.renderOrder = -1;
      fitNebula();
      scene.add(nebMesh);

      // ── Звёздное поле ──
      const COUNT = 2500, SPREAD = 600, DEPTH = 900;
      starTex = makeStarTexture(THREE);
      starGeo = new THREE.BufferGeometry();
      const pos = new Float32Array(COUNT * 3), col = new Float32Array(COUNT * 3);
      starBase = new Float32Array(COUNT * 3); starSpd = new Float32Array(COUNT); starPhase = new Float32Array(COUNT);
      const cW = new THREE.Color(0xcfe0ff), cG = new THREE.Color(0xfde68a), cP = new THREE.Color(0xc4b5fd);
      for (let i = 0; i < COUNT; i++) {
        pos[i * 3] = (Math.random() * 2 - 1) * SPREAD;
        pos[i * 3 + 1] = (Math.random() * 2 - 1) * SPREAD;
        pos[i * 3 + 2] = -Math.random() * DEPTH;
        starSpd[i] = 60 + Math.random() * 90;
        starPhase[i] = Math.random() * Math.PI * 2;
        const r = Math.random();
        const c = r < 0.7 ? cW : (r < 0.85 ? cG : cP);
        const b = 0.55 + Math.random() * 0.45;
        starBase[i * 3] = c.r * b; starBase[i * 3 + 1] = c.g * b; starBase[i * 3 + 2] = c.b * b;
        col[i * 3] = starBase[i * 3]; col[i * 3 + 1] = starBase[i * 3 + 1]; col[i * 3 + 2] = starBase[i * 3 + 2];
      }
      starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      starGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      starMat = new THREE.PointsMaterial({ size: 7, map: starTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
      points = new THREE.Points(starGeo, starMat);
      scene.add(points);

      // ── Комета (один Sprite-штрих, изредка) ──
      cometTex = makeCometTexture(THREE);
      cometMat = new THREE.SpriteMaterial({ map: cometTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
      comet = new THREE.Sprite(cometMat);
      comet.visible = false;
      scene.add(comet);
      let cometActive = false, cometElapsed = 0, cometDur = 2.6, cometTimer = 5 + Math.random() * 5;
      let cFrom = { x: 0, y: 0 }, cVel = { x: 0, y: 0 };
      const COMET_Z = -320;
      const launchComet = () => {
        const vH = 2 * Math.tan((70 * Math.PI) / 360) * Math.abs(COMET_Z);
        const vW = vH * (W / H);
        const dir = Math.random() < 0.5 ? 1 : -1;          // влево/вправо
        cFrom = { x: -dir * (vW / 2 + 60), y: vH * (0.18 + Math.random() * 0.22) };
        cVel = { x: dir * (vW + 120) / cometDur, y: -(vH * 0.25) / cometDur };
        comet.material.rotation = Math.atan2(cVel.y, cVel.x);
        comet.scale.set(70, 7, 1);
        comet.position.set(cFrom.x, cFrom.y, COMET_Z);
        comet.visible = true; cometActive = true; cometElapsed = 0;
      };

      clock = new THREE.Clock(); let last = 0;
      const animate = () => {
        frameId = requestAnimationFrame(animate);
        const t = clock.getElapsedTime(); const dt = Math.min(t - last, 0.05); last = t;
        nebMat.uniforms.uTime.value = t;

        // полёт звёзд + мерцание
        const p = starGeo.attributes.position.array, c = starGeo.attributes.color.array;
        for (let i = 0; i < COUNT; i++) {
          let z = p[i * 3 + 2] + starSpd[i] * dt;
          if (z > 6) { z = -DEPTH; p[i * 3] = (Math.random() * 2 - 1) * SPREAD; p[i * 3 + 1] = (Math.random() * 2 - 1) * SPREAD; }
          p[i * 3 + 2] = z;
          const tw = 0.75 + 0.25 * Math.sin(t * 2.0 + starPhase[i]);
          c[i * 3] = starBase[i * 3] * tw; c[i * 3 + 1] = starBase[i * 3 + 1] * tw; c[i * 3 + 2] = starBase[i * 3 + 2] * tw;
        }
        starGeo.attributes.position.needsUpdate = true;
        starGeo.attributes.color.needsUpdate = true;

        // parallax за мышью (lerp)
        mouse.x += (mouse.tx - mouse.x) * 0.05; mouse.y += (mouse.ty - mouse.y) * 0.05;
        camera.position.x = mouse.x * 35; camera.position.y = -mouse.y * 35;
        camera.lookAt(0, 0, -NEB_Z);

        // комета
        if (cometActive) {
          cometElapsed += dt;
          comet.position.x = cFrom.x + cVel.x * cometElapsed;
          comet.position.y = cFrom.y + cVel.y * cometElapsed;
          if (cometElapsed >= cometDur) { cometActive = false; comet.visible = false; cometTimer = 10 + Math.random() * 6; }
        } else {
          cometTimer -= dt;
          if (cometTimer <= 0) launchComet();
        }

        renderer.render(scene, camera);
      };
      animate();

      onResize = () => {
        if (!renderer || !camera) return;
        W = window.innerWidth; H = window.innerHeight;
        renderer.setSize(W, H);
        camera.aspect = W / H; camera.updateProjectionMatrix();
        fitNebula();
      };
      window.addEventListener('resize', onResize);
      window.addEventListener('mousemove', onMove);
    }).catch((e) => { console.warn('[creatorbg] three load failed:', e?.message || e); if (!cancelled) setFailed(true); });

    return () => {
      cancelled = true;
      if (frameId) cancelAnimationFrame(frameId);
      if (onResize) window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMove);
      if (starGeo) starGeo.dispose();
      if (starMat) starMat.dispose();
      if (starTex) starTex.dispose();
      if (nebGeo) nebGeo.dispose();
      if (nebMat) nebMat.dispose();
      if (cometMat) cometMat.dispose();
      if (cometTex) cometTex.dispose();
      if (renderer) {
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
        renderer.dispose();
        if (renderer.forceContextLoss) renderer.forceContextLoss();
      }
    };
  }, []);

  // ── Фолбэк: CSS звёздный фон (если Three.js не загрузился) ──
  if (failed) {
    return (
      <div aria-hidden="true" style={{
        position: 'fixed', inset: 0, zIndex: -1, overflow: 'hidden',
        background: 'linear-gradient(135deg,#0a0918,#1e1b4b,#312e81,#0a0918)',
        backgroundSize: '400% 400%', animation: 'crBgShift 20s ease infinite',
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: 1, height: 1, borderRadius: '50%', boxShadow: css.s1, animation: 'crStarTwinkle 4s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', top: 0, left: 0, width: 2, height: 2, borderRadius: '50%', boxShadow: css.s2, animation: 'crStarTwinkle 6s ease-in-out infinite' }} />
        {css.floats.map((f, i) => (
          <div key={i} style={{ position: 'absolute', bottom: -12, left: `${f.left}%`, width: 6, height: 6, borderRadius: '50%', background: f.gold ? '#fde68a' : '#c084fc', boxShadow: `0 0 8px ${f.gold ? '#fbbf24' : '#a855f7'}`, animation: `crFloat ${f.dur}s linear ${f.delay}s infinite` }} />
        ))}
      </div>
    );
  }

  // WebGL canvas (zIndex -2) + затемняющая виньетка для читаемости контента (zIndex -1).
  return (
    <>
      <div ref={mountRef} aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: -2, overflow: 'hidden' }} />
      <div aria-hidden="true" style={{
        position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 60% 70% at 50% 45%, rgba(2,2,12,0.55), rgba(2,2,12,0.12) 70%)',
      }} />
    </>
  );
}
