/**
 * Ikki omilli regressiya: nuqtalar, regressiya tekisligi va qoldiqlar — interaktiv 3D.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { gsap } from 'gsap';
import { fmt } from '../core/format.js';
import { extent, niceTicks } from './charts.js';

const H = 2.4; // kubning yarim o‘lchami

export function plot3d(container, model) {
  container._dispose3d?.();
  container.innerHTML = '';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    container.innerHTML = '<p class="muted">WebGL qo‘llab-quvvatlanmaydi — 3D ko‘rinish mavjud emas.</p>';
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);
  const labels = new CSS2DRenderer();
  labels.domElement.style.position = 'absolute';
  labels.domElement.style.inset = '0';
  labels.domElement.style.pointerEvents = 'none';
  container.appendChild(labels.domElement);
  const hint = document.createElement('div');
  hint.className = 'viz-hint';
  hint.textContent = 'Aylantirish: sudrang · Masshtab: g‘ildirak';
  container.appendChild(hint);
  const tip = document.createElement('div');
  tip.className = 'chart-tip';
  container.appendChild(tip);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(7.5, 5.2, 7.5);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.autoRotate = !reduce;
  controls.autoRotateSpeed = 0.8;
  controls.minDistance = 4;
  controls.maxDistance = 22;
  controls.addEventListener('start', () => (controls.autoRotate = false));

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const dl = new THREE.DirectionalLight(0xffffff, 1.2);
  dl.position.set(5, 10, 6);
  scene.add(dl);
  const pl = new THREE.PointLight(0xff6ad5, 18, 20);
  pl.position.set(-4, 3, -3);
  scene.add(pl);

  // Masshtablar: x1 → X o‘qi, y → Y (yuqoriga), x2 → Z o‘qi
  const x1 = model.X.map((r) => r[0]);
  const x2 = model.X.map((r) => r[1]);
  // O‘q chegaralari model turining aniqlanish sohasidan chiqmasligi kerak (ln x, 1/x)
  const positiveOnly = ['power', 'logarithmic', 'hyperbolic'].includes(model.type);
  const dom = (vals) => {
    let [lo, hi] = extent(vals, 0.05);
    const mn = Math.min(...vals);
    if (positiveOnly && mn > 0) lo = Math.max(lo, mn * 0.9);
    return [lo, hi];
  };
  const [a0, a1] = dom(x1);
  const [c0, c1] = dom(x2);
  const yMeanAll = model.y.reduce((s, v) => s + v, 0) / model.y.length;
  const surf = (u, v) => {
    try {
      const r = model.predict([u, v]).yhat;
      return Number.isFinite(r) ? r : yMeanAll;
    } catch {
      return yMeanAll;
    }
  };
  const corners = [surf(a0, c0), surf(a0, c1), surf(a1, c0), surf(a1, c1)];
  const [y0, y1] = extent([...model.y, ...corners], 0.05);
  const sx = (v) => ((v - a0) / (a1 - a0)) * 2 * H - H;
  const sz = (v) => ((v - c0) / (c1 - c0)) * 2 * H - H;
  const sy = (v) => ((v - y0) / (y1 - y0)) * 2 * H - H;

  // Kub qirralari va setka
  const box = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(2 * H, 2 * H, 2 * H)),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12 }),
  );
  scene.add(box);
  const floor = new THREE.GridHelper(2 * H, 10, 0x8b7bff, 0x2a2f55);
  floor.position.y = -H;
  floor.material.transparent = true;
  floor.material.opacity = 0.5;
  scene.add(floor);

  const label = (text, x, y, z, cls = 'label3d') => {
    const d = document.createElement('div');
    d.className = cls;
    d.textContent = text;
    const o = new CSS2DObject(d);
    o.position.set(x, y, z);
    scene.add(o);
  };
  label(model.featureNames[0], 0, -H - 0.55, H + 0.5);
  label(model.featureNames[1], H + 0.6, -H - 0.55, 0);
  label(model.targetName, -H - 0.4, H + 0.4, -H - 0.4);
  niceTicks(a0, a1, 4).filter((t) => t >= a0 && t <= a1).forEach((t) => label(fmt(t, 3), sx(t), -H - 0.2, H + 0.15));
  niceTicks(c0, c1, 4).filter((t) => t >= c0 && t <= c1).forEach((t) => label(fmt(t, 3), H + 0.2, -H - 0.2, sz(t)));
  niceTicks(y0, y1, 4).filter((t) => t >= y0 && t <= y1).forEach((t) => label(fmt(t, 3), -H - 0.2, sy(t), -H - 0.2));

  // Regressiya tekisligi (morph: gorizontal → haqiqiy)
  const seg = 24;
  const pGeo = new THREE.PlaneGeometry(2 * H, 2 * H, seg, seg);
  pGeo.rotateX(-Math.PI / 2);
  const posAttr = pGeo.attributes.position;
  const targetY = new Float32Array(posAttr.count);
  const colors = new Float32Array(posAttr.count * 3);
  const cA = new THREE.Color(0x5ee7ff);
  const cB = new THREE.Color(0xff6ad5);
  const yMeanS = sy(model.y.reduce((s, v) => s + v, 0) / model.y.length);
  for (let i = 0; i < posAttr.count; i++) {
    const px = posAttr.getX(i);
    const pz = posAttr.getZ(i);
    const u = a0 + ((px + H) / (2 * H)) * (a1 - a0);
    const v = c0 + ((pz + H) / (2 * H)) * (c1 - c0);
    targetY[i] = sy(surf(u, v));
    posAttr.setY(i, reduce ? targetY[i] : yMeanS);
    const t = Math.min(1, Math.max(0, (targetY[i] + H) / (2 * H)));
    const col = cA.clone().lerp(cB, t);
    colors.set([col.r, col.g, col.b], i * 3);
  }
  pGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const plane = new THREE.Mesh(
    pGeo,
    new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.38, side: THREE.DoubleSide, roughness: 0.4, metalness: 0.1, depthWrite: false }),
  );
  const wire = new THREE.Mesh(pGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.12 }));
  scene.add(plane, wire);

  // Nuqtalar
  const n = model.y.length;
  const sph = new THREE.SphereGeometry(0.075, 16, 16);
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.25, metalness: 0.2, emissiveIntensity: 0.6 });
  const inst = new THREE.InstancedMesh(sph, mat, n);
  const m4 = new THREE.Matrix4();
  const above = new THREE.Color(0x5ee7ff);
  const below = new THREE.Color(0xff6ad5);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const p = new THREE.Vector3(sx(x1[i]), sy(model.y[i]), sz(x2[i]));
    pts.push(p);
    m4.makeTranslation(p.x, p.y, p.z);
    inst.setMatrixAt(i, m4);
    inst.setColorAt(i, model.residuals[i] >= 0 ? above : below);
  }
  scene.add(inst);

  // Qoldiq chiziqlari
  const segs = [];
  for (let i = 0; i < n; i++) segs.push(pts[i].x, pts[i].y, pts[i].z, pts[i].x, sy(model.fitted[i]), pts[i].z);
  const rGeo = new THREE.BufferGeometry();
  rGeo.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3));
  const rMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: reduce ? 0.35 : 0 });
  scene.add(new THREE.LineSegments(rGeo, rMat));

  // Animatsiya
  const morph = { t: reduce ? 1 : 0 };
  const applyMorph = () => {
    for (let i = 0; i < posAttr.count; i++) posAttr.setY(i, yMeanS + (targetY[i] - yMeanS) * morph.t);
    posAttr.needsUpdate = true;
    pGeo.computeVertexNormals();
  };
  if (!reduce) {
    const tl = gsap.timeline({ delay: 0.2 });
    tl.from(camera.position, { x: 12, y: 9, z: 12, duration: 1.8, ease: 'power3.out' })
      .to(morph, { t: 1, duration: 1.6, ease: 'elastic.out(1, 0.6)', onUpdate: applyMorph }, '-=1')
      .to(rMat, { opacity: 0.35, duration: 0.8 }, '-=0.6');
  }

  // Hover tooltip
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const onMove = (e) => {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(inst)[0];
    if (hit) {
      const i = hit.instanceId;
      tip.innerHTML = `№${i + 1} · ${model.featureNames[0]} = ${fmt(x1[i])}, ${model.featureNames[1]} = ${fmt(x2[i])}<br>y = ${fmt(model.y[i])} · ŷ = ${fmt(model.fitted[i])}`;
      tip.style.left = `${e.clientX - r.left}px`;
      tip.style.top = `${e.clientY - r.top}px`;
      tip.classList.add('is-on');
      renderer.domElement.style.cursor = 'pointer';
    } else {
      tip.classList.remove('is-on');
      renderer.domElement.style.cursor = 'grab';
    }
  };
  renderer.domElement.addEventListener('pointermove', onMove);

  const resize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    labels.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  let visible = true;
  const io = new IntersectionObserver(([en]) => (visible = en.isIntersecting));
  io.observe(container);
  let raf;
  const loop = () => {
    raf = requestAnimationFrame(loop);
    if (!visible) return;
    controls.update();
    renderer.render(scene, camera);
    labels.render(scene, camera);
  };
  loop();

  container._dispose3d = () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    controls.dispose();
    scene.traverse((o) => {
      o.geometry?.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
    renderer.dispose();
    container._dispose3d = null;
  };
}
