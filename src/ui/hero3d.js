/**
 * Hero bo‘limidagi 3D sahna: tasodifiy “ma’lumot buluti” regressiya tekisligi
 * atrofida yig‘iladi, tekislik paydo bo‘ladi, qoldiq chiziqlari chiziladi.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createRng } from '../core/gradientDescent.js';

const pointVert = /* glsl */ `
  attribute vec3 aStart;
  attribute float aSize;
  attribute float aResid;
  uniform float uProgress;
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vResid;
  varying float vAlpha;
  void main() {
    float p = smoothstep(0.0, 1.0, clamp(uProgress * 1.4 - aSize * 0.08, 0.0, 1.0));
    vec3 pos = mix(aStart, position, p);
    pos.y += sin(uTime * 1.3 + position.x * 2.0 + position.z) * 0.035;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixelRatio * (34.0 / -mv.z);
    vResid = aResid;
    vAlpha = 0.35 + 0.65 * p;
  }
`;
const pointFrag = /* glsl */ `
  varying float vResid;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float core = smoothstep(0.5, 0.0, d);
    vec3 cyan = vec3(0.37, 0.91, 1.0);
    vec3 pink = vec3(1.0, 0.42, 0.84);
    vec3 violet = vec3(0.55, 0.48, 1.0);
    vec3 col = vResid > 0.0 ? mix(violet, cyan, clamp(vResid, 0.0, 1.0)) : mix(violet, pink, clamp(-vResid, 0.0, 1.0));
    gl_FragColor = vec4(col * (0.6 + core), core * vAlpha);
  }
`;
const planeVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const planeFrag = /* glsl */ `
  varying vec2 vUv;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uReveal;
  void main() {
    vec2 g = abs(fract(vUv * 14.0 - 0.5) - 0.5) / fwidth(vUv * 14.0);
    float line = 1.0 - min(min(g.x, g.y), 1.0);
    float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x) * smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.82, vUv.y);
    float r = length(vUv - 0.5) * 1.414;
    float reveal = smoothstep(uReveal, uReveal - 0.15, r);
    vec3 a = vec3(0.37, 0.91, 1.0);
    vec3 b = vec3(1.0, 0.42, 0.84);
    vec3 col = mix(a, b, vUv.x + 0.15 * sin(uTime * 0.6 + vUv.y * 3.0));
    float scan = smoothstep(0.02, 0.0, abs(fract(vUv.y - uTime * 0.08) - 0.5) - 0.48);
    float alpha = (0.06 + line * 0.5 + scan * 0.25) * edge * reveal * uOpacity;
    gl_FragColor = vec4(col, alpha);
  }
`;

export function initHero(canvas) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    canvas.style.display = 'none';
    return { play: () => {} };
  }
  const isSmall = window.innerWidth < 860;
  const dpr = Math.min(window.devicePixelRatio, isSmall ? 1.5 : 2);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05060f, 0.045);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  camera.position.set(0, 2.2, 11);

  const root = new THREE.Group();
  scene.add(root);
  const world = new THREE.Group();
  world.rotation.set(0.12, -0.6, 0);
  root.add(world);

  // ----- Ma’lumot nuqtalari -----
  const rng = createRng(11);
  const gauss = () => Math.sqrt(-2 * Math.log(rng() || 1e-9)) * Math.cos(2 * Math.PI * rng());
  const N = isSmall ? 260 : 460;
  const a = 0.42;
  const c = 0.22;
  const pos = new Float32Array(N * 3);
  const start = new Float32Array(N * 3);
  const size = new Float32Array(N);
  const resid = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const x = (rng() - 0.5) * 7;
    const z = (rng() - 0.5) * 7;
    const e = gauss() * 0.45;
    pos.set([x, a * x + c * z + e, z], i * 3);
    const r = 9 + rng() * 10;
    const th = rng() * Math.PI * 2;
    const ph = Math.acos(2 * rng() - 1);
    start.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th)], i * 3);
    size[i] = 2.2 + rng() * 3.2;
    resid[i] = Math.max(-1, Math.min(1, e / 0.9));
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pGeo.setAttribute('aStart', new THREE.BufferAttribute(start, 3));
  pGeo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  pGeo.setAttribute('aResid', new THREE.BufferAttribute(resid, 1));
  const pMat = new THREE.ShaderMaterial({
    vertexShader: pointVert,
    fragmentShader: pointFrag,
    uniforms: { uProgress: { value: reduce ? 1 : 0 }, uTime: { value: 0 }, uPixelRatio: { value: dpr } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  world.add(new THREE.Points(pGeo, pMat));

  // ----- Regressiya tekisligi -----
  const planeGeo = new THREE.PlaneGeometry(8, 8, 1, 1);
  const planeMat = new THREE.ShaderMaterial({
    vertexShader: planeVert,
    fragmentShader: planeFrag,
    uniforms: { uOpacity: { value: reduce ? 1 : 0 }, uTime: { value: 0 }, uReveal: { value: reduce ? 1.6 : 0 } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    extensions: { derivatives: true },
  });
  const plane = new THREE.Mesh(planeGeo, planeMat);
  const normal = new THREE.Vector3(-a, 1, -c).normalize();
  plane.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  world.add(plane);

  // ----- Qoldiq chiziqlari -----
  const segs = [];
  for (let i = 0; i < N; i += 3) {
    const x = pos[i * 3];
    const y = pos[i * 3 + 1];
    const z = pos[i * 3 + 2];
    segs.push(x, y, z, x, a * x + c * z, z);
  }
  const lGeo = new THREE.BufferGeometry();
  lGeo.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3));
  const lMat = new THREE.LineBasicMaterial({ color: 0x8b7bff, transparent: true, opacity: reduce ? 0.35 : 0, blending: THREE.AdditiveBlending, depthWrite: false });
  world.add(new THREE.LineSegments(lGeo, lMat));

  // ----- Fon yulduzlari -----
  const S = isSmall ? 700 : 1500;
  const sPos = new Float32Array(S * 3);
  for (let i = 0; i < S; i++) {
    const r = 25 + rng() * 60;
    const th = rng() * Math.PI * 2;
    const ph = Math.acos(2 * rng() - 1);
    sPos.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th)], i * 3);
  }
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  const stars = new THREE.Points(sGeo, new THREE.PointsMaterial({ color: 0x9aa3ff, size: 0.12, transparent: true, opacity: 0.55, depthWrite: false }));
  scene.add(stars);

  // ----- Halqa (orbit) -----
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(6.2, 0.008, 8, 220),
    new THREE.MeshBasicMaterial({ color: 0x5ee7ff, transparent: true, opacity: 0.25 }),
  );
  ring.rotation.x = Math.PI / 2.2;
  world.add(ring);

  // ----- Post-processing -----
  let composer = null;
  if (!isSmall) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.85, 0.6, 0.05));
    composer.addPass(new OutputPass());
  }

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    composer?.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    root.position.x = w > 860 ? 3.2 : 0;
    root.position.y = w > 860 ? 0 : -1.2;
  }
  resize();
  window.addEventListener('resize', resize);

  // ----- Sichqoncha paralaksi -----
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('pointermove', (e) => {
    mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  // ----- Ko‘rinmaganda to‘xtatish -----
  let visible = true;
  new IntersectionObserver(([en]) => (visible = en.isIntersecting), { threshold: 0 }).observe(canvas);

  const clock = new THREE.Clock();
  const scroll = { rot: 0, zoom: 0 };
  function tick() {
    requestAnimationFrame(tick);
    if (!visible || document.hidden) return;
    const t = clock.getElapsedTime();
    pMat.uniforms.uTime.value = t;
    planeMat.uniforms.uTime.value = t;
    mouse.x += (mouse.tx - mouse.x) * 0.04;
    mouse.y += (mouse.ty - mouse.y) * 0.04;
    world.rotation.y = -0.6 + (reduce ? 0 : t * 0.06) + mouse.x * 0.25 + scroll.rot;
    world.rotation.x = 0.12 + mouse.y * 0.12;
    stars.rotation.y = t * 0.01;
    camera.position.z = 11 + scroll.zoom;
    camera.lookAt(root.position.x * 0.35, 0, 0);
    if (composer) composer.render();
    else renderer.render(scene, camera);
  }
  tick();

  gsap.registerPlugin(ScrollTrigger);
  gsap.to(scroll, {
    rot: 1.4,
    zoom: 5,
    ease: 'none',
    scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: 1 },
  });

  return {
    /** Kirish animatsiyasi: nuqtalar yig‘iladi → tekislik → qoldiqlar */
    play() {
      if (reduce) return;
      const tl = gsap.timeline();
      tl.to(pMat.uniforms.uProgress, { value: 1, duration: 3.2, ease: 'power3.inOut' })
        .to(planeMat.uniforms.uOpacity, { value: 1, duration: 1.2, ease: 'power2.out' }, '-=1.4')
        .to(planeMat.uniforms.uReveal, { value: 1.6, duration: 2, ease: 'power2.out' }, '<')
        .to(lMat, { opacity: 0.35, duration: 1.4 }, '-=1.2');
      return tl;
    },
  };
}
