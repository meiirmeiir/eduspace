import React, { useEffect, useRef, useState } from 'react';
import { loadThree } from '../lib/loadThree.js';

// 3D-планета навыка (Three.js r128). Состояние поверхности зависит от `life`:
//   -1  заблокирован → мёртвая кратерная скала, без атмосферы
//    0  доступен      → серый камень + лёгкая дымка
//   0.4 этап 1        → проступает вода + первая зелень
//   0.8 этап 2        → зелень, океаны, облака
//   1.0 освоен        → цветущий мир + атмосферное свечение (rim)
// Процедурная поверхность: simplex-fbm + микс цветов по life. Статична по
// текущему life (анимация перехода — отдельная часть). Фолбэк — CSS-круг.

// ── Ashima 3D simplex noise + fbm (для обоих фрагментных шейдеров) ──
// Экспортируются для переиспользования в DailyBackground3D (тот же «mastered»-вид
// планеты в фоне ежедневок); поведение SkillPlanet3D не меняется.
export const NOISE_GLSL = `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p){ float f=0.0,a=0.5; for(int i=0;i<4;i++){ f+=a*snoise(p); p*=2.02; a*=0.5; } return f*0.5+0.5; }
`;

export const PLANET_VERT = `
varying vec3 vPos; varying vec3 vNormalW; varying vec3 vViewDir;
void main(){
  vPos = position;
  vNormalW = normalize(mat3(modelMatrix)*normal);
  vec4 wp = modelMatrix*vec4(position,1.0);
  vViewDir = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);
}`;

export const PLANET_FRAG = NOISE_GLSL + `
uniform float uLife; uniform vec3 uSunDir; uniform float uAmbient;
varying vec3 vPos; varying vec3 vNormalW; varying vec3 vViewDir;
const vec3 DEAD_ROCK=vec3(0.32,0.27,0.23);
const vec3 STONE    =vec3(0.50,0.50,0.54);
const vec3 LAND_SOIL=vec3(0.55,0.45,0.28);
const vec3 VEG_GREEN=vec3(0.22,0.50,0.22);
const vec3 SHALLOW  =vec3(0.20,0.50,0.75);
const vec3 DEEP     =vec3(0.07,0.20,0.45);
void main(){
  float life=uLife;
  float h=fbm(vPos*1.8);
  float crater=fbm(vPos*6.0);
  vec3 rock=mix(DEAD_ROCK,STONE,step(0.0,life));
  rock *= (life<0.0)? mix(0.5,1.0,crater) : mix(0.8,1.0,crater);
  float vegN=fbm(vPos*3.0+11.0);
  float vegAmt=smoothstep(0.30,1.0,life)*smoothstep(0.45,0.72,vegN);
  vec3 land=mix(LAND_SOIL,VEG_GREEN,vegAmt);
  land=mix(rock,land,smoothstep(0.06,0.40,life));
  float waterAmt=smoothstep(0.0,0.6,life);
  float seaLevel=mix(0.0,0.52,waterAmt);
  float isWater=smoothstep(seaLevel+0.03,seaLevel-0.03,h)*step(0.06,life);
  float depth=smoothstep(seaLevel,seaLevel-0.35,h);
  vec3 water=mix(SHALLOW,DEEP,depth);
  vec3 surface=mix(land,water,isWater);
  float ndl=max(dot(normalize(vNormalW),normalize(uSunDir)),0.0);
  float light=uAmbient+(1.0-uAmbient)*ndl;
  gl_FragColor=vec4(surface*light,1.0);
}`;

export const CLOUD_FRAG = NOISE_GLSL + `
uniform float uLife; uniform vec3 uSunDir; uniform float uAmbient;
varying vec3 vPos; varying vec3 vNormalW; varying vec3 vViewDir;
void main(){
  float appear=smoothstep(0.72,1.0,uLife);
  if(appear<=0.001) discard;
  float c=fbm(vPos*2.2+5.0);
  float cloud=smoothstep(0.54,0.74,c);
  float a=cloud*appear*0.9;
  if(a<0.02) discard;
  float ndl=max(dot(normalize(vNormalW),normalize(uSunDir)),0.0);
  float light=uAmbient+(1.0-uAmbient)*ndl;
  gl_FragColor=vec4(vec3(1.0)*light,a);
}`;

export const ATMO_VERT = `
varying vec3 vNormalW; varying vec3 vViewDir;
void main(){
  vNormalW = normalize(mat3(modelMatrix)*normal);
  vec4 wp = modelMatrix*vec4(position,1.0);
  vViewDir = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);
}`;

export const ATMO_FRAG = `
uniform float uLife; uniform vec3 uSunDir; uniform float uBloom;
varying vec3 vNormalW; varying vec3 vViewDir;
const vec3 ATMO=vec3(0.40,0.70,1.0);
void main(){
  if(uLife<0.0) discard;
  float strength=clamp(0.18+0.82*smoothstep(0.0,1.0,uLife),0.0,1.0);
  float fres=pow(1.0-max(dot(normalize(vViewDir),normalize(vNormalW)),0.0),3.0);
  float sun=max(dot(normalize(vNormalW),normalize(uSunDir)),0.0);
  float a=fres*strength*(0.35+0.65*sun)*uBloom;
  gl_FragColor=vec4(ATMO,a);
}`;

// ── CSS-фолбэк: радиальный круг по life (экспорт — лендинг использует его как
//    статичную «планету» на мобильных, без WebGL) ──
export function fallbackGradient(life) {
  if (life < 0)    return 'radial-gradient(circle at 38% 32%, #6b5c4e, #2c241d 70%)';
  if (life < 0.2)  return 'radial-gradient(circle at 38% 32%, #9aa0a8, #4a4d54 70%)';
  if (life < 0.6)  return 'radial-gradient(circle at 38% 32%, #6fae8f, #2b5a6e 72%)';
  if (life < 0.95) return 'radial-gradient(circle at 38% 32%, #5fbf7a, #1e5a8a 72%)';
  return 'radial-gradient(circle at 38% 32%, #7fe0a0, #2a86d6 72%), radial-gradient(circle, transparent 60%, rgba(120,200,255,0.4))';
}

export default function SkillPlanet3D({ fromLife = 0, toLife = 0, size = 220 }) {
  const mountRef = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let renderer, scene, camera, frameId, clock;
    let cancelled = false;
    const mount = mountRef.current;
    if (!mount) return;
    const geos = [], mats = [], texs = [];

    loadThree().then((THREE) => {
      if (cancelled || !mount) return;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      } catch (e) { if (!cancelled) setFailed(true); return; }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(size, size);
      mount.appendChild(renderer.domElement);

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
      camera.position.set(0, 0, 2.8);

      const sunDir = new THREE.Vector3(0.7, 0.35, 0.6).normalize();
      const uniforms = {
        uLife:    { value: fromLife },
        uSunDir:  { value: sunDir },
        uAmbient: { value: 0.18 },
        uBloom:   { value: 1 },
      };
      const animated = fromLife !== toLife;
      const LERP_DELAY = 0.25, LERP_DUR = 2.5;

      // Планета
      const planetGeo = new THREE.SphereGeometry(1, 64, 64);
      const planetMat = new THREE.ShaderMaterial({ uniforms, vertexShader: PLANET_VERT, fragmentShader: PLANET_FRAG });
      const planet = new THREE.Mesh(planetGeo, planetMat);
      scene.add(planet); geos.push(planetGeo); mats.push(planetMat);

      // Облака (видны при life≥~0.72)
      const cloudGeo = new THREE.SphereGeometry(1.02, 48, 48);
      const cloudMat = new THREE.ShaderMaterial({ uniforms, vertexShader: PLANET_VERT, fragmentShader: CLOUD_FRAG, transparent: true, depthWrite: false });
      const clouds = new THREE.Mesh(cloudGeo, cloudMat);
      scene.add(clouds); geos.push(cloudGeo); mats.push(cloudMat);

      // Атмосфера (rim, сила растёт с life; life<0 — выкл)
      const atmoGeo = new THREE.SphereGeometry(1.18, 48, 48);
      const atmoMat = new THREE.ShaderMaterial({ uniforms, vertexShader: ATMO_VERT, fragmentShader: ATMO_FRAG, transparent: true, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false });
      const atmo = new THREE.Mesh(atmoGeo, atmoMat);
      scene.add(atmo); geos.push(atmoGeo); mats.push(atmoMat);

      // Звёзды
      const N = 120;
      const pos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        const r = 6 + Math.random() * 3;
        const t = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
        pos[i * 3] = r * Math.sin(ph) * Math.cos(t);
        pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(t);
        pos[i * 3 + 2] = r * Math.cos(ph);
      }
      const starGeo = new THREE.BufferGeometry();
      starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.06, sizeAttenuation: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
      const stars = new THREE.Points(starGeo, starMat);
      scene.add(stars); geos.push(starGeo); mats.push(starMat);

      clock = new THREE.Clock();
      let last = 0;
      const animate = () => {
        frameId = requestAnimationFrame(animate);
        const t = clock.getElapsedTime();
        const dt = Math.min(t - last, 0.05); last = t;
        if (animated) {
          // Оживление: плавный lerp life от fromLife к toLife (ease-in-out)
          const p = Math.min(1, Math.max(0, (t - LERP_DELAY) / LERP_DUR));
          const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
          uniforms.uLife.value = fromLife + (toLife - fromLife) * e;
          // лёгкая вспышка атмосферы к завершению («расцвет»)
          uniforms.uBloom.value = 1 + 1.1 * Math.exp(-Math.pow((p - 0.92) / 0.12, 2));
        }
        planet.rotation.y += 0.15 * dt;
        clouds.rotation.y += 0.10 * dt;
        stars.rotation.y += 0.01 * dt;
        renderer.render(scene, camera);
      };
      animate();
    }).catch((e) => { console.warn('[planet] three load failed:', e?.message || e); if (!cancelled) setFailed(true); });

    return () => {
      cancelled = true;
      if (frameId) cancelAnimationFrame(frameId);
      geos.forEach(g => g.dispose && g.dispose());
      mats.forEach(m => m.dispose && m.dispose());
      texs.forEach(t => t.dispose && t.dispose());
      if (renderer) {
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
        renderer.dispose();
        if (renderer.forceContextLoss) renderer.forceContextLoss();
      }
    };
  }, [fromLife, toLife, size]);

  if (failed) {
    return (
      <div aria-hidden="true" style={{
        width: size, height: size, borderRadius: '50%', margin: '0 auto',
        background: fallbackGradient(toLife),
        boxShadow: toLife >= 0 ? '0 0 24px rgba(120,200,255,0.3)' : 'none',
      }} />
    );
  }

  return (
    <div ref={mountRef} style={{
      width: size, height: size, margin: '0 auto', borderRadius: '50%', overflow: 'hidden',
      background: 'radial-gradient(circle at 50% 45%, #0d1430 0%, #05060f 75%)',
    }} />
  );
}
