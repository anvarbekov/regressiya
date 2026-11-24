/**
 * Yengil SVG grafiklar kutubxonasi (tashqi bog‘liqliklarsiz).
 * Har bir grafik konteyner o‘lchamiga moslashadi (ResizeObserver) va
 * birinchi chizilishda GSAP orqali animatsiya qilinadi.
 */
import { gsap } from 'gsap';
import { fmt } from '../core/format.js';
import { normalInv } from '../core/distributions.js';

const NS = 'http://www.w3.org/2000/svg';
export const COLORS = { c1: '#5ee7ff', c2: '#8b7bff', c3: '#ff6ad5', good: '#4ade80', warn: '#fbbf24', bad: '#fb7185', text: '#a9aecb' };
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

export function niceTicks(min, max, count = 5) {
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const span = max - min;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const norm = step0 / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  const ticks = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) ticks.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return ticks;
}

export function extent(arr, pad = 0.06) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of arr) {
    if (!Number.isFinite(v)) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (lo === Infinity) return [0, 1];
  if (lo === hi) return [lo - 1, hi + 1];
  const p = (hi - lo) * pad;
  return [lo - p, hi + p];
}

/**
 * Konteynerga moslashuvchan grafik o‘rnatadi.
 * draw(ctx) har o‘lcham o‘zgarishida qayta chaqiriladi; ctx.animate — birinchi chizishda true.
 */
export function mountChart(container, draw) {
  if (container._chartObserver) container._chartObserver.disconnect();
  let first = true;
  let lastW = 0;
  let lastH = 0;
  const render = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w < 10 || h < 10 || (w === lastW && h === lastH)) return;
    lastW = w;
    lastH = h;
    container.querySelectorAll('svg.chart, .chart-tip').forEach((n) => n.remove());
    const svg = el('svg', { class: 'chart', viewBox: `0 0 ${w} ${h}`, role: 'img' });
    container.appendChild(svg);
    const tip = document.createElement('div');
    tip.className = 'chart-tip';
    container.appendChild(tip);
    draw({ svg, w, h, tip, animate: first && !reduceMotion(), container });
    first = false;
  };
  const ro = new ResizeObserver(() => render());
  ro.observe(container);
  container._chartObserver = ro;
  render();
  return { redraw: () => { lastW = 0; render(); } };
}

/** O‘qlar, setka va masshtablar bilan bazaviy koordinata tizimi */
export function axes(ctx, { xDomain, yDomain, xLabel = '', yLabel = '', margin = {}, xTicks = 6, yTicks = 5 }) {
  const m = { top: 14, right: 16, bottom: xLabel ? 46 : 30, left: yLabel ? 64 : 48, ...margin };
  const { svg, w, h } = ctx;
  const iw = Math.max(10, w - m.left - m.right);
  const ih = Math.max(10, h - m.top - m.bottom);
  const [x0, x1] = xDomain;
  const [y0, y1] = yDomain;
  const sx = (v) => m.left + ((v - x0) / (x1 - x0)) * iw;
  const sy = (v) => m.top + ih - ((v - y0) / (y1 - y0)) * ih;
  sx.invert = (px) => x0 + ((px - m.left) / iw) * (x1 - x0);
  sy.invert = (py) => y0 + ((m.top + ih - py) / ih) * (y1 - y0);

  const grid = el('g', { class: 'chart-grid' }, svg);
  const ax = el('g', { class: 'chart-axis' }, svg);
  const xt = niceTicks(x0, x1, Math.max(2, Math.min(xTicks, Math.floor(iw / 70))));
  const yt = niceTicks(y0, y1, Math.max(2, Math.min(yTicks, Math.floor(ih / 40))));
  for (const t of xt) {
    if (t < x0 || t > x1) continue;
    el('line', { x1: sx(t), x2: sx(t), y1: m.top, y2: m.top + ih }, grid);
    el('text', { x: sx(t), y: m.top + ih + 18, 'text-anchor': 'middle' }, ax).textContent = fmt(t, 4);
  }
  for (const t of yt) {
    if (t < y0 || t > y1) continue;
    el('line', { x1: m.left, x2: m.left + iw, y1: sy(t), y2: sy(t) }, grid);
    el('text', { x: m.left - 8, y: sy(t) + 4, 'text-anchor': 'end' }, ax).textContent = fmt(t, 4);
  }
  el('line', { x1: m.left, x2: m.left + iw, y1: m.top + ih, y2: m.top + ih }, ax);
  el('line', { x1: m.left, x2: m.left, y1: m.top, y2: m.top + ih }, ax);
  if (xLabel) el('text', { class: 'chart-label', x: m.left + iw / 2, y: h - 6, 'text-anchor': 'middle' }, svg).textContent = xLabel;
  if (yLabel) {
    el('text', { class: 'chart-label', x: -(m.top + ih / 2), y: 14, transform: 'rotate(-90)', 'text-anchor': 'middle' }, svg).textContent = yLabel;
  }
  const clipId = `clip-${Math.random().toString(36).slice(2)}`;
  const defs = el('defs', {}, svg);
  const cp = el('clipPath', { id: clipId }, defs);
  el('rect', { x: m.left, y: m.top, width: iw, height: ih }, cp);
  const plot = el('g', { 'clip-path': `url(#${clipId})` }, svg);
  return { sx, sy, plot, m, iw, ih, defs };
}

export function pathD(points) {
  return points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join('');
}

function drawLine(ctx, parent, pts, attrs, delay = 0) {
  const p = el('path', { d: pathD(pts), fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...attrs }, parent);
  if (ctx.animate) {
    const len = p.getTotalLength?.() || 1000;
    gsap.fromTo(p, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.2, delay, ease: 'power3.out', onComplete: () => p.removeAttribute('stroke-dasharray') });
  }
  return p;
}

function drawBand(ctx, parent, xs, lower, upper, sx, sy, fill, delay = 0) {
  const top = xs.map((x, i) => [sx(x), sy(upper[i])]);
  const bot = xs.map((x, i) => [sx(x), sy(lower[i])]).reverse();
  const p = el('path', { d: `${pathD(top)}L${pathD(bot).slice(1)}Z`, fill, stroke: 'none' }, parent);
  if (ctx.animate) gsap.from(p, { opacity: 0, duration: 1, delay });
  return p;
}

function drawPoints(ctx, parent, pts, { color = COLORS.c1, r = 4.5, tip, colors } = {}) {
  const g = el('g', {}, parent);
  const nodes = pts.map(([x, y], i) =>
    el('circle', { cx: x, cy: y, r, fill: colors ? colors[i] : color, 'fill-opacity': 0.9, stroke: '#05060f', 'stroke-width': 1.2 }, g),
  );
  if (ctx.animate) gsap.from(nodes, { attr: { r: 0 }, duration: 0.6, stagger: Math.min(0.02, 0.8 / nodes.length), ease: 'back.out(2)' });
  if (tip) attachTips(ctx, nodes, tip, r);
  return nodes;
}

function attachTips(ctx, nodes, tipFn, r) {
  nodes.forEach((n, i) => {
    n.style.cursor = 'pointer';
    n.addEventListener('pointerenter', () => {
      n.setAttribute('r', r * 1.7);
      ctx.tip.innerHTML = tipFn(i);
      ctx.tip.style.left = `${n.getAttribute('cx')}px`;
      ctx.tip.style.top = `${n.getAttribute('cy')}px`;
      ctx.tip.classList.add('is-on');
    });
    n.addEventListener('pointerleave', () => {
      n.setAttribute('r', r);
      ctx.tip.classList.remove('is-on');
    });
  });
}

/* ================= Tayyor grafiklar ================= */

/** Kuzatuv nomi: yorliq (mamlakat, yil) yoki tartib raqami */
const lab = (model, i) => (model.labels && model.labels[i] !== undefined ? `${model.labels[i]}` : `№${i + 1}`);

/**
 * Bitta omilli model (har qanday turdagi: chiziqli, parabolik, darajali, …) uchun
 * kuzatuvlar, regressiya egri chizig‘i, ishonch va bashorat oraliqlari.
 */
export function scatterCurve(container, M, { highlight = [] } = {}) {
  const xs = M.X.map((r) => r[0]);
  const ys = M.y;
  let [xa, xb] = extent(xs, 0.06);
  const mn = Math.min(...xs);
  const mx = Math.max(...xs);
  // Aniqlanish sohasidan chiqmaslik (ln x, 1/x)
  if (['power', 'logarithmic'].includes(M.type) || (M.type === 'hyperbolic' && mn > 0)) xa = Math.max(xa, mn * 0.9);
  if (M.type === 'hyperbolic' && mx < 0) xb = Math.min(xb, mx * 0.9);
  const grid = Array.from({ length: 120 }, (_, i) => xa + ((xb - xa) * i) / 119);
  const preds = grid.map((x) => {
    try {
      return M.predict([x]);
    } catch {
      return null;
    }
  });
  const ok = preds.map((p) => p && [p.yhat, ...p.prediction].every(Number.isFinite));
  const G = grid.filter((_, i) => ok[i]);
  const P = preds.filter((_, i) => ok[i]);
  const yd = extent([...ys, ...P.flatMap((p) => p.prediction)], 0.04);
  // Juda keng bashorat oralig‘i (masalan, ekstrapolyatsiyada) o‘qni “cho‘zib” yubormasin
  const [ya, yb] = extent(ys, 0.25);
  const ydom = [Math.max(yd[0], ya - (yb - ya)), Math.min(yd[1], yb + (yb - ya))];
  const unit = (n) => (M.units && M.units[n] ? `${n}, ${M.units[n]}` : n);
  return mountChart(container, (ctx) => {
    const { sx, sy, plot } = axes(ctx, { xDomain: [xa, xb], yDomain: ydom, xLabel: unit(M.featureNames[0]), yLabel: unit(M.targetName) });
    drawBand(ctx, plot, G, P.map((p) => p.prediction[0]), P.map((p) => p.prediction[1]), sx, sy, 'rgba(255,106,213,0.10)');
    drawBand(ctx, plot, G, P.map((p) => p.confidence[0]), P.map((p) => p.confidence[1]), sx, sy, 'rgba(94,231,255,0.18)', 0.2);
    if (xs.length <= 300) {
      const rg = el('g', { stroke: 'rgba(255,255,255,0.18)', 'stroke-width': 1, 'stroke-dasharray': '3 3' }, plot);
      xs.forEach((x, i) => el('line', { x1: sx(x), x2: sx(x), y1: sy(ys[i]), y2: sy(M.fitted[i]) }, rg));
      if (ctx.animate) gsap.from(rg, { opacity: 0, duration: 1, delay: 0.8 });
    }
    const grd = `g${Math.random().toString(36).slice(2)}`;
    const lg = el('linearGradient', { id: grd, x1: 0, x2: 1 }, ctx.svg.querySelector('defs'));
    el('stop', { offset: 0, 'stop-color': COLORS.c1 }, lg);
    el('stop', { offset: 0.5, 'stop-color': COLORS.c2 }, lg);
    el('stop', { offset: 1, 'stop-color': COLORS.c3 }, lg);
    drawLine(ctx, plot, G.map((x, i) => [sx(x), sy(P[i].yhat)]), { stroke: `url(#${grd})`, 'stroke-width': 3 }, 0.3);
    const hs = new Set(highlight);
    const r = xs.length > 300 ? 2.4 : 4.5;
    drawPoints(ctx, ctx.svg, xs.map((x, i) => [sx(x), sy(ys[i])]), {
      r,
      colors: xs.map((_, i) => (hs.has(i) ? COLORS.warn : COLORS.c1)),
      tip: (i) => `<b>${lab(M, i)}</b><br>${M.featureNames[0]} = ${fmt(xs[i])}<br>${M.targetName} = ${fmt(ys[i])} · ŷ = ${fmt(M.fitted[i])}<br>e = ${fmt(M.residuals[i])}`,
    });
  });
}

/** Juft regressiya: nuqtalar, regressiya chizig‘i, CI va PI zonalari */
export function scatterFit(container, model, { highlight = [] } = {}) {
  const xs = model.X.map((r) => r[0]);
  const ys = model.y;
  const [xa, xb] = extent(xs, 0.08);
  const grid = Array.from({ length: 80 }, (_, i) => xa + ((xb - xa) * i) / 79);
  const preds = grid.map((x) => model.predict([x]));
  const yd = extent([...ys, ...preds.flatMap((p) => p.prediction)], 0.04);
  return mountChart(container, (ctx) => {
    const { sx, sy, plot } = axes(ctx, { xDomain: [xa, xb], yDomain: yd, xLabel: model.featureNames[0], yLabel: model.targetName });
    drawBand(ctx, plot, grid, preds.map((p) => p.prediction[0]), preds.map((p) => p.prediction[1]), sx, sy, 'rgba(255,106,213,0.10)');
    drawBand(ctx, plot, grid, preds.map((p) => p.confidence[0]), preds.map((p) => p.confidence[1]), sx, sy, 'rgba(94,231,255,0.18)', 0.2);
    // Qoldiq chiziqlari
    const rg = el('g', { stroke: 'rgba(255,255,255,0.18)', 'stroke-width': 1, 'stroke-dasharray': '3 3' }, plot);
    xs.forEach((x, i) => el('line', { x1: sx(x), x2: sx(x), y1: sy(ys[i]), y2: sy(model.fitted[i]) }, rg));
    if (ctx.animate) gsap.from(rg, { opacity: 0, duration: 1, delay: 0.8 });
    const grd = `g${Math.random().toString(36).slice(2)}`;
    const lg = el('linearGradient', { id: grd, x1: 0, x2: 1 }, ctx.svg.querySelector('defs'));
    el('stop', { offset: 0, 'stop-color': COLORS.c1 }, lg);
    el('stop', { offset: 0.5, 'stop-color': COLORS.c2 }, lg);
    el('stop', { offset: 1, 'stop-color': COLORS.c3 }, lg);
    drawLine(ctx, plot, grid.map((x, i) => [sx(x), sy(preds[i].yhat)]), { stroke: `url(#${grd})`, 'stroke-width': 3 }, 0.3);
    const hs = new Set(highlight);
    drawPoints(ctx, ctx.svg, xs.map((x, i) => [sx(x), sy(ys[i])]), {
      colors: xs.map((_, i) => (hs.has(i) ? COLORS.warn : COLORS.c1)),
      tip: (i) => `№${i + 1} · x = ${fmt(xs[i])}<br>y = ${fmt(ys[i])} · ŷ = ${fmt(model.fitted[i])}<br>e = ${fmt(model.residuals[i])}`,
    });
  });
}

/** Haqiqiy va bashorat qilingan qiymatlar (ko‘p omilli modellar uchun) */
export function actualVsPredicted(container, model) {
  const d = extent([...model.y, ...model.fitted], 0.06);
  return mountChart(container, (ctx) => {
    const { sx, sy, plot } = axes(ctx, { xDomain: d, yDomain: d, xLabel: `Bashorat ŷ`, yLabel: `Haqiqiy ${model.targetName}` });
    drawLine(ctx, plot, [[sx(d[0]), sy(d[0])], [sx(d[1]), sy(d[1])]], { stroke: COLORS.c3, 'stroke-width': 2, 'stroke-dasharray': '6 6' });
    drawPoints(ctx, ctx.svg, model.fitted.map((f, i) => [sx(f), sy(model.y[i])]), {
      r: model.y.length > 300 ? 2.4 : 4.5,
      tip: (i) => `<b>${lab(model, i)}</b><br>y = ${fmt(model.y[i])} · ŷ = ${fmt(model.fitted[i])}`,
    });
  });
}

export function residualsVsFitted(container, model) {
  const r = model.diagnostics.studentized;
  const xd = extent(model.fitted);
  const yd = extent([...r, -3, 3], 0.05);
  return mountChart(container, (ctx) => {
    const { sx, sy, plot } = axes(ctx, { xDomain: xd, yDomain: yd, xLabel: 'ŷ', yLabel: 'Stud. qoldiq' });
    drawLine(ctx, plot, [[sx(xd[0]), sy(0)], [sx(xd[1]), sy(0)]], { stroke: COLORS.c2, 'stroke-width': 1.5 });
    for (const t of [-2, 2]) drawLine(ctx, plot, [[sx(xd[0]), sy(t)], [sx(xd[1]), sy(t)]], { stroke: 'rgba(251,191,36,0.5)', 'stroke-dasharray': '4 4' });
    drawPoints(ctx, ctx.svg, model.fitted.map((f, i) => [sx(f), sy(r[i])]), {
      r: 3.8,
      colors: r.map((v) => (Math.abs(v) > 2 ? COLORS.warn : COLORS.c1)),
      tip: (i) => `<b>${lab(model, i)}</b><br>ŷ = ${fmt(model.fitted[i])} · r = ${fmt(r[i], 3)}`,
    });
  });
}

export function qqPlot(container, model) {
  const r = [...model.diagnostics.studentized].map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const n = r.length;
  const theo = r.map((_, i) => normalInv((i + 1 - 0.375) / (n + 0.25)));
  const d = extent([...theo, ...r.map((v) => v[0])], 0.05);
  return mountChart(container, (ctx) => {
    const { sx, sy, plot } = axes(ctx, { xDomain: d, yDomain: d, xLabel: 'Nazariy kvantillar', yLabel: 'Tanlama kvantillari' });
    drawLine(ctx, plot, [[sx(d[0]), sy(d[0])], [sx(d[1]), sy(d[1])]], { stroke: COLORS.c3, 'stroke-width': 2 });
    drawPoints(ctx, ctx.svg, theo.map((t, i) => [sx(t), sy(r[i][0])]), { r: 3.8, tip: (i) => `<b>${lab(model, r[i][1])}</b><br>nazariy ${fmt(theo[i], 3)} · amaliy ${fmt(r[i][0], 3)}` });
  });
}

export function residualHistogram(container, model) {
  const e = model.residuals;
  const n = e.length;
  const bins = Math.max(5, Math.min(20, Math.ceil(Math.log2(n) + 1)));
  const [lo, hi] = extent(e, 0.02);
  const bw = (hi - lo) / bins;
  const counts = new Array(bins).fill(0);
  e.forEach((v) => (counts[Math.min(bins - 1, Math.floor((v - lo) / bw))] += 1));
  const s = Math.sqrt(e.reduce((a, v) => a + v * v, 0) / n);
  const dens = (x) => (n * bw * Math.exp(-(x * x) / (2 * s * s))) / (s * Math.sqrt(2 * Math.PI));
  const yMax = Math.max(...counts, dens(0)) * 1.12;
  return mountChart(container, (ctx) => {
    const { sx, sy, plot } = axes(ctx, { xDomain: [lo, hi], yDomain: [0, yMax], xLabel: 'Qoldiq e', yLabel: 'Chastota' });
    const bars = counts.map((c, i) =>
      el('rect', { x: sx(lo + i * bw) + 1, width: Math.max(1, sx(lo + bw) - sx(lo) - 2), y: sy(c), height: sy(0) - sy(c), rx: 3, fill: 'rgba(139,123,255,0.55)' }, plot),
    );
    if (ctx.animate) gsap.from(bars, { attr: { y: sy(0), height: 0 }, duration: 0.8, stagger: 0.03, ease: 'power3.out' });
    const xs = Array.from({ length: 80 }, (_, i) => lo + ((hi - lo) * i) / 79);
    drawLine(ctx, plot, xs.map((x) => [sx(x), sy(dens(x))]), { stroke: COLORS.c3, 'stroke-width': 2 }, 0.4);
  });
}

export function cooksPlot(container, model) {
  const d = model.diagnostics.cooksD;
  const n = d.length;
  const thr = 4 / n;
  const yMax = Math.max(...d, thr) * 1.15;
  return mountChart(container, (ctx) => {
    const { sx, sy, plot } = axes(ctx, { xDomain: [0.5, n + 0.5], yDomain: [0, yMax], xLabel: 'Kuzatuv №', yLabel: 'Kuk masofasi D' });
    const bw = Math.max(1, (sx(1.5) - sx(0.5)) * 0.7);
    const bars = d.map((v, i) =>
      el('rect', { x: sx(i + 1) - bw / 2, width: bw, y: sy(v), height: sy(0) - sy(v), rx: Math.min(3, bw / 2), fill: v > thr ? COLORS.warn : 'rgba(94,231,255,0.6)' }, plot),
    );
    if (ctx.animate) gsap.from(bars, { attr: { y: sy(0), height: 0 }, duration: 0.7, stagger: Math.min(0.02, 0.6 / n), ease: 'power3.out' });
    drawLine(ctx, plot, [[sx(0.5), sy(thr)], [sx(n + 0.5), sy(thr)]], { stroke: COLORS.bad, 'stroke-dasharray': '5 5', 'stroke-width': 1.5 });
    bars.forEach((b, i) => {
      b.addEventListener('pointerenter', () => {
        ctx.tip.innerHTML = `<b>${lab(model, i)}</b><br>D = ${fmt(d[i], 4)} · h = ${fmt(model.diagnostics.leverage[i], 3)}`;
        ctx.tip.style.left = `${sx(i + 1)}px`;
        ctx.tip.style.top = `${sy(d[i])}px`;
        ctx.tip.classList.add('is-on');
      });
      b.addEventListener('pointerleave', () => ctx.tip.classList.remove('is-on'));
    });
  });
}

/** Ko‘p seriyali chiziqli grafik: series = [{ points:[[x,y]], color, label, width, dash }] */
export function lineChart(container, series, { xLabel = '', yLabel = '', logY = false, markers = [] } = {}) {
  const tf = (v) => (logY ? Math.log10(Math.max(v, 1e-300)) : v);
  const all = series.flatMap((s) => s.points);
  const xd = extent(all.map((p) => p[0]), 0.02);
  const yd = extent(all.map((p) => tf(p[1])), 0.08);
  return mountChart(container, (ctx) => {
    const { sx, sy, plot } = axes(ctx, { xDomain: xd, yDomain: yd, xLabel, yLabel: logY ? `log₁₀ ${yLabel}` : yLabel });
    series.forEach((s, k) => drawLine(ctx, plot, s.points.map(([x, y]) => [sx(x), sy(tf(y))]), { stroke: s.color, 'stroke-width': s.width ?? 2.2, 'stroke-dasharray': s.dash }, k * 0.1));
    markers.forEach((mk) => el('circle', { cx: sx(mk[0]), cy: sy(tf(mk[1])), r: 5, fill: mk[2] ?? COLORS.c3, stroke: '#05060f', 'stroke-width': 2 }, ctx.svg));
  });
}

/** Masala kartochkasi uchun kichik sparkline */
export function sparkline(svgHost, xs, ys) {
  const w = 300;
  const h = 54;
  const [xa, xb] = extent(xs, 0.05);
  const [ya, yb] = extent(ys, 0.1);
  const svg = el('svg', { viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: 'none', width: '100%', height: '100%' });
  const sx = (v) => ((v - xa) / (xb - xa)) * w;
  const sy = (v) => h - ((v - ya) / (yb - ya)) * h;
  xs.forEach((x, i) => el('circle', { cx: sx(x), cy: sy(ys[i]), r: 2.4, fill: COLORS.c1, 'fill-opacity': 0.75 }, svg));
  // Kichik kvadratlar to‘g‘ri chizig‘i
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let sxy = 0;
  let sxx = 0;
  xs.forEach((x, i) => {
    sxy += (x - mx) * (ys[i] - my);
    sxx += (x - mx) ** 2;
  });
  const b1 = sxx ? sxy / sxx : 0;
  const b0 = my - b1 * mx;
  el('line', { x1: 0, y1: sy(b0 + b1 * xa), x2: w, y2: sy(b0 + b1 * xb), stroke: COLORS.c3, 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' }, svg);
  svgHost.appendChild(svg);
}
