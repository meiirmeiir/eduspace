import React, { useEffect, useRef, useState } from 'react';
import { loadThree } from '../lib/loadThree.js';
import { PLANET_VERT, PLANET_FRAG, ATMO_VERT, CLOUD_FRAG, fallbackGradient } from './SkillPlanet3D.jsx';

// Hero-планета «Прибытие» на экране результатов ежедневок — та же сине-океаническая
// «освоенная» планета (uLife=1), что приближалась в углу фона (DailyBackground3D),
// ради сюжетной непрерывности «долетел именно до неё». Здесь она крупно/близко как
// награда. ОДИН WebGL-контекст, contained-канвас (НЕ полноэкранный — ниже длинный
// скролл-контент). Cinematic entry ОДИН раз на mount (вплывает + атмосферный bloom
// разгорается и оседает ~1.6с) → дешёвый idle-спин. Entry НЕ зацикливается при
// скролле; IntersectionObserver лишь ПАУЗИТ рендер вне вьюпорта (перф/батарея).
// Фиксированный px-размер канваса → «дыхание» адресной строки iOS его не ресайзит;
// плюс RO с тем же guard'ом (игнор Δвысоты ≤160), что в DailyBackground3D.

// Мягкая атмосфера (front-side, перо к силуэту) + uBloom для кульминационного
// разгорания прибытия. Та же логика, что SOFT_ATMO фона; ATMO в SkillPlanet3D не трогаем.
const ARRIVAL_ATMO_FRAG = `
  uniform vec3 uSunDir; uniform float uIntensity; uniform float uBloom;
  varying vec3 vNormalW; varying vec3 vViewDir;
  const vec3 ATMO = vec3(0.50, 0.74, 1.0);
  void main(){
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(vViewDir);
    float rim = 1.0 - max(dot(V, N), 0.0);                 // 0 центр → 1 силуэт
    float band = pow(rim, 2.0) * smoothstep(1.0, 0.45, rim);
    float sun  = 0.5 + 0.5 * max(dot(N, normalize(uSunDir)), 0.0);
    gl_FragColor = vec4(ATMO, band * sun * uIntensity * uBloom);
  }`;

const easeOutBack = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);

export default function ArrivalPlanet3D({ size = 190, celebrate = false }) {
  const mountRef = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let renderer, scene, camera, frameId, clock, ro, io, resizeTimer;
    let cancelled = false;
    let visible = true;
    const mount = mountRef.current;
    if (!mount) return;
    const geos = [], mats = [], texs = [];

    loadThree().then((THREE) => {
      if (cancelled || !mount) return;
      let W = mount.clientWidth || size;

      try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' }); }
      catch (e) { if (!cancelled) setFailed(true); return; }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(W, W, false);
      const cv = renderer.domElement;
      cv.style.width = '100%'; cv.style.height = '100%'; cv.style.display = 'block';
      mount.appendChild(cv);

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
      camera.position.set(0, 0, 4.8);

      const sunDir = new THREE.Vector3(0.7, 0.35, 0.6).normalize();
      const uniforms = {
        uLife:    { value: 1.0 },     // «освоенная» — та же планета, что в фоне
        uSunDir:  { value: sunDir },
        uAmbient: { value: 0.18 },
      };
      const atmoUniforms = { uSunDir: { value: sunDir }, uIntensity: { value: 1.15 }, uBloom: { value: 1 } };

      const planetGroup = new THREE.Group();
      scene.add(planetGroup);

      const planetGeo = new THREE.SphereGeometry(1, 48, 48); geos.push(planetGeo);
      const planetMat = new THREE.ShaderMaterial({ uniforms, vertexShader: PLANET_VERT, fragmentShader: PLANET_FRAG }); mats.push(planetMat);
      const planet = new THREE.Mesh(planetGeo, planetMat);
      planetGroup.add(planet);

      const cloudGeo = new THREE.SphereGeometry(1.02, 40, 40); geos.push(cloudGeo);
      const cloudMat = new THREE.ShaderMaterial({ uniforms, vertexShader: PLANET_VERT, fragmentShader: CLOUD_FRAG, transparent: true, depthWrite: false }); mats.push(cloudMat);
      const clouds = new THREE.Mesh(cloudGeo, cloudMat);
      planetGroup.add(clouds);

      const atmoGeo = new THREE.SphereGeometry(1.55, 48, 48); geos.push(atmoGeo);
      const atmoMat = new THREE.ShaderMaterial({ uniforms: atmoUniforms, vertexShader: ATMO_VERT, fragmentShader: ARRIVAL_ATMO_FRAG, transparent: true, side: THREE.FrontSide, blending: THREE.AdditiveBlending, depthWrite: false }); mats.push(atmoMat);
      const atmo = new THREE.Mesh(atmoGeo, atmoMat);
      planetGroup.add(atmo);

      // Пауза рендера вне вьюпорта (перф/батарея). Entry — по времени, не по io,
      // поэтому скролл туда-обратно НЕ перезапускает вход.
      io = new IntersectionObserver((entries) => { visible = entries.some(e => e.isIntersecting); }, { threshold: 0.05 });
      io.observe(mount);

      // RO с guard'ом против «дыхания» адресной строки iOS (как в DailyBackground3D).
      let lastW = W;
      ro = new ResizeObserver(() => {
        if (!renderer || !mount) return;
        const nW = mount.clientWidth || W;
        if (nW === lastW) return;                 // высота фиксирована (квадрат) → ширина = реальный ресайз
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => { lastW = nW; W = nW; renderer.setSize(W, W, false); }, 150);
      });
      ro.observe(mount);

      const ENTRY = 1.6;          // длительность cinematic entry
      const BLOOM0 = celebrate ? 3.4 : 2.2;   // стартовая яркость атмосферы прибытия
      clock = new THREE.Clock();
      const animate = () => {
        frameId = requestAnimationFrame(animate);
        if (!visible) return;                   // пауза вне вьюпорта
        const t = clock.getElapsedTime();

        if (t < ENTRY) {
          const p = t / ENTRY;
          planetGroup.scale.setScalar(0.18 + (1 - 0.18) * easeOutBack(Math.min(1, p)));
          planetGroup.position.z = -2.2 * (1 - easeOutCubic(p));     // вплывает из глубины
          atmoUniforms.uBloom.value = 1 + (BLOOM0 - 1) * (1 - easeOutCubic(p)); // разгорается → оседает
        } else {
          planetGroup.scale.setScalar(1);
          planetGroup.position.z = 0;
          atmoUniforms.uBloom.value = 1;
        }
        planet.rotation.y = t * 0.16;           // дешёвый idle-спин
        clouds.rotation.y = t * 0.20;
        renderer.render(scene, camera);
      };
      animate();
    }).catch((e) => { console.warn('[arrival] three load failed:', e?.message || e); if (!cancelled) setFailed(true); });

    return () => {
      cancelled = true;
      if (frameId) cancelAnimationFrame(frameId);
      if (resizeTimer) clearTimeout(resizeTimer);
      if (ro) ro.disconnect();
      if (io) io.disconnect();
      geos.forEach((g) => g.dispose && g.dispose());
      mats.forEach((m) => m.dispose && m.dispose());
      texs.forEach((tx) => tx.dispose && tx.dispose());
      if (renderer) {
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
        renderer.dispose();
        if (renderer.forceContextLoss) renderer.forceContextLoss();
      }
    };
  }, []);

  if (failed) {
    // Фолбэк без WebGL — статичная CSS-планета (тот же экспорт, что лендинг/карта).
    return (
      <div aria-hidden="true" style={{
        width: size, height: size, borderRadius: '50%', margin: '0 auto',
        background: fallbackGradient(1), boxShadow: '0 0 26px rgba(120,200,255,0.4)',
      }} />
    );
  }

  return <div ref={mountRef} aria-hidden="true" style={{ width: size, height: size, margin: '0 auto' }} />;
}
