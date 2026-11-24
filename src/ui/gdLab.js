/**
 * Gradient tushish vizualizatori: xarajat funksiyasi sirti (kontur xarita),
 * optimallashtirish traektoriyasi, xarajat dinamikasi va moslashuv — jonli animatsiya.
 */
import { gradientDescent, costFunction } from '../core/gradientDescent.js';
import { fmt } from '../core/format.js';
import { niceTicks, extent } from './charts.js';

const C = { c1: '#5ee7ff', c2: '#8b7bff', c3: '#ff6ad5', good: '#4ade80', warn: '#fbbf24', bad: '#fb7185', grid: 'rgba(255,255,255,0.06)', axis: 'rgba(255,255,255,0.2)', text: '#6d7394' };

/** Kanvas + koordinata tizimi yordamchisi */
function canvasPlot(host) {
  host.innerHTML = '';
  const cv = document.createElement('canvas');
  host.appendChild(cv);
  const ctx = cv.getContext('2d');
  const st = { w: 0, h: 0, m: { l: 58, r: 14, t: 12, b: 40 } };
  st.resize = () => {
    const dpr = Math.min(window.devicePixelRatio, 2);
    st.w = host.clientWidth;
    st.h = host.clientHeight;
    cv.width = st.w * dpr;
    cv.height = st.h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  st.setDomain = (xd, yd) => {
    st.xd = xd;
    st.yd = yd;
  };
  st.sx = (v) => st.m.l + ((v - st.xd[0]) / (st.xd[1] - st.xd[0])) * (st.w - st.m.l - st.m.r);
  st.sy = (v) => st.h - st.m.b - ((v - st.yd[0]) / (st.yd[1] - st.yd[0])) * (st.h - st.m.t - st.m.b);
  st.axes = (xl, yl) => {
    const { m, w, h } = st;
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillStyle = C.text;
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    ctx.textAlign = 'center';
    for (const t of niceTicks(...st.xd, Math.max(2, Math.floor((w - m.l) / 80)))) {
      if (t < st.xd[0] || t > st.xd[1]) continue;
      const x = st.sx(t);
      ctx.beginPath();
      ctx.moveTo(x, m.t);
      ctx.lineTo(x, h - m.b);
      ctx.stroke();
      ctx.fillText(fmt(t, 3), x, h - m.b + 16);
    }
    ctx.textAlign = 'right';
    for (const t of niceTicks(...st.yd, Math.max(2, Math.floor((h - m.b) / 45)))) {
      if (t < st.yd[0] || t > st.yd[1]) continue;
      const y = st.sy(t);
      ctx.beginPath();
      ctx.moveTo(m.l, y);
      ctx.lineTo(w - m.r, y);
      ctx.stroke();
      ctx.fillText(fmt(t, 3), m.l - 6, y + 4);
    }
    ctx.fillStyle = '#a9aecb';
    ctx.font = '12px Manrope, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(xl, m.l + (w - m.l - m.r) / 2, h - 6);
    ctx.save();
    ctx.translate(13, m.t + (h - m.t - m.b) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(yl, 0, 0);
    ctx.restore();
  };
  st.clip = (fn) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(st.m.l, st.m.t, st.w - st.m.l - st.m.r, st.h - st.m.t - st.m.b);
    ctx.clip();
    fn();
    ctx.restore();
  };
  st.ctx = ctx;
  st.resize();
  return st;
}

/** Ko‘k → binafsha → pushti → oq rang xaritasi (t ∈ [0,1]) */
function colormap(t) {
  const stops = [
    [0, [8, 10, 30]],
    [0.25, [32, 40, 110]],
    [0.5, [90, 70, 200]],
    [0.75, [200, 80, 200]],
    [1, [255, 170, 230]],
  ];
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, a] = stops[i - 1];
      const [t1, b] = stops[i];
      const u = (t - t0) / (t1 - t0);
      return a.map((v, k) => Math.round(v + (b[k] - v) * u));
    }
  }
  return stops[stops.length - 1][1];
}

export function initGdLab(root, getData) {
  const $ = (id) => root.querySelector(`#${id}`);
  const els = {
    lr: $('lr'), lrVal: $('lr-val'), epochs: $('epochs'), epVal: $('ep-val'), method: $('gd-method'),
    bsField: $('bs-field'), batch: $('batch'), bsVal: $('bs-val'), mom: $('momentum'), momVal: $('mom-val'),
    std: $('standardize'), play: $('gd-play'), reset: $('gd-reset'), readout: $('gd-readout'),
    surface: $('gd-surface'), loss: $('gd-loss'), fit: $('gd-fit'), surfTitle: $('gd-surface-title'), fitTitle: $('gd-fit-title'),
  };
  const lrValue = () => 10 ** Number(els.lr.value);
  const sync = () => {
    els.lrVal.textContent = fmt(lrValue(), 3);
    els.epVal.textContent = els.epochs.value;
    els.bsVal.textContent = els.batch.value;
    els.momVal.textContent = Number(els.mom.value).toFixed(2);
    els.bsField.hidden = els.method.value !== 'minibatch';
  };
  [els.lr, els.epochs, els.batch, els.mom, els.method, els.std].forEach((e) => e.addEventListener('input', () => { sync(); prepare(); }));
  sync();

  let state = null;
  let raf = 0;
  let playing = false;
  let frame = 0;

  function prepare() {
    stop();
    const data = getData();
    if (!data) {
      els.readout.innerHTML = '<p class="muted">Avval laboratoriyada ma’lumot tanlang.</p>';
      return;
    }
    let res;
    try {
      res = gradientDescent(data.X, data.y, {
        learningRate: lrValue(),
        epochs: Number(els.epochs.value),
        method: els.method.value,
        batchSize: Number(els.batch.value),
        momentum: Number(els.mom.value),
        standardize: els.std.checked,
        maxHistory: 600,
      });
    } catch (e) {
      els.readout.innerHTML = `<p class="error">${e.message}</p>`;
      return;
    }
    const k = data.X[0].length;
    const optCost = costFunction(data.X, data.y, data.olsParams);
    state = { data, res, k, optCost, surf: canvasPlot(els.surface), loss: canvasPlot(els.loss), fit: canvasPlot(els.fit) };
    els.surfTitle.textContent = k === 1 ? 'Xarajat funksiyasi sirti J(b₀, b₁)' : 'Parametrlarning EKKU yechimigacha nisbiy masofasi';
    els.fitTitle.textContent = k === 1 ? 'Moslashuv' : 'Haqiqiy va bashorat';
    if (k === 1) buildContour();
    frame = state.res.history.length - 1;
    drawAll();
  }

  function buildContour() {
    const { data, res, surf } = state;
    const xs = data.X.map((r) => r[0]);
    const n = xs.length;
    const S = { y2: 0, y: 0, x: 0, x2: 0, xy: 0 };
    xs.forEach((x, i) => {
      S.y2 += data.y[i] ** 2;
      S.y += data.y[i];
      S.x += x;
      S.x2 += x * x;
      S.xy += x * data.y[i];
    });
    const J = (b0, b1) => (S.y2 - 2 * b0 * S.y - 2 * b1 * S.xy + n * b0 * b0 + 2 * b0 * b1 * S.x + b1 * b1 * S.x2) / (2 * n);
    const finite = res.history.filter((h) => Number.isFinite(h.params[0]) && Number.isFinite(h.params[1]) && Math.abs(h.params[0]) < 1e9 && Math.abs(h.params[1]) < 1e9);
    const [ob0, ob1] = data.olsParams;
    let d0 = extent([ob0, ...finite.map((h) => h.params[0])], 0.15);
    let d1 = extent([ob1, ...finite.map((h) => h.params[1])], 0.15);
    // Sirt o‘lchamini minimum atrofida muvozanatlash
    const span0 = Math.max(d0[1] - ob0, ob0 - d0[0], Math.abs(ob0) * 0.3 + 1e-6);
    const span1 = Math.max(d1[1] - ob1, ob1 - d1[0], Math.abs(ob1) * 0.3 + 1e-6);
    d0 = [ob0 - span0, ob0 + span0];
    d1 = [ob1 - span1, ob1 + span1];
    surf.setDomain(d0, d1);
    const W = Math.max(1, Math.floor(surf.w - surf.m.l - surf.m.r));
    const Hh = Math.max(1, Math.floor(surf.h - surf.m.t - surf.m.b));
    const gw = Math.min(220, W);
    const gh = Math.min(160, Hh);
    const vals = new Float64Array(gw * gh);
    const jMin = J(ob0, ob1);
    let lmin = Infinity;
    let lmax = -Infinity;
    for (let j = 0; j < gh; j++) {
      for (let i = 0; i < gw; i++) {
        const b0 = d0[0] + ((i + 0.5) / gw) * (d0[1] - d0[0]);
        const b1 = d1[1] - ((j + 0.5) / gh) * (d1[1] - d1[0]);
        const v = Math.log(J(b0, b1) - jMin + 1e-9 * (1 + jMin));
        vals[j * gw + i] = v;
        if (v < lmin) lmin = v;
        if (v > lmax) lmax = v;
      }
    }
    const off = document.createElement('canvas');
    off.width = gw;
    off.height = gh;
    const octx = off.getContext('2d');
    const img = octx.createImageData(gw, gh);
    const levels = 16;
    for (let p = 0; p < vals.length; p++) {
      const t = (vals[p] - lmin) / (lmax - lmin || 1);
      const band = Math.floor(t * levels) / levels;
      const i = p % gw;
      const j = Math.floor(p / gw);
      // Kontur chiziqlari: qo‘shni katakda daraja o‘zgarsa
      const right = i + 1 < gw ? Math.floor(((vals[p + 1] - lmin) / (lmax - lmin || 1)) * levels) : null;
      const down = j + 1 < gh ? Math.floor(((vals[p + gw] - lmin) / (lmax - lmin || 1)) * levels) : null;
      const lvl = Math.floor(t * levels);
      const isEdge = (right !== null && right !== lvl) || (down !== null && down !== lvl);
      const [r, g, b] = colormap(0.08 + band * 0.75);
      img.data.set(isEdge ? [Math.min(255, r + 70), Math.min(255, g + 70), Math.min(255, b + 90), 255] : [r, g, b, 255], p * 4);
    }
    octx.putImageData(img, 0, 0);
    state.contour = off;
  }

  function drawSurface(upto) {
    const { surf, res, data, k } = state;
    const ctx = surf.ctx;
    ctx.clearRect(0, 0, surf.w, surf.h);
    const hist = res.history.slice(0, upto + 1);
    if (k === 1) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(state.contour, surf.m.l, surf.m.t, surf.w - surf.m.l - surf.m.r, surf.h - surf.m.t - surf.m.b);
      surf.axes('b₀ (ozod had)', 'b₁ (qiyalik)');
      surf.clip(() => {
        const [ob0, ob1] = data.olsParams;
        // EKKU minimumi
        ctx.strokeStyle = C.good;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(surf.sx(ob0), surf.sy(ob1), 9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(surf.sx(ob0) - 14, surf.sy(ob1));
        ctx.lineTo(surf.sx(ob0) + 14, surf.sy(ob1));
        ctx.moveTo(surf.sx(ob0), surf.sy(ob1) - 14);
        ctx.lineTo(surf.sx(ob0), surf.sy(ob1) + 14);
        ctx.stroke();
        // Traektoriya
        const grad = ctx.createLinearGradient(surf.sx(hist[0].params[0]), 0, surf.sx(hist[hist.length - 1].params[0]), 0);
        grad.addColorStop(0, C.c1);
        grad.addColorStop(1, C.c3);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2.4;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        hist.forEach((h, i) => {
          const x = surf.sx(clampBig(h.params[0]));
          const y = surf.sy(clampBig(h.params[1]));
          if (i) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        });
        ctx.stroke();
        const step = Math.max(1, Math.floor(hist.length / 40));
        ctx.fillStyle = '#fff';
        hist.forEach((h, i) => {
          if (i % step) return;
          ctx.beginPath();
          ctx.arc(surf.sx(clampBig(h.params[0])), surf.sy(clampBig(h.params[1])), 1.8, 0, Math.PI * 2);
          ctx.fill();
        });
        const last = hist[hist.length - 1];
        const hx = surf.sx(clampBig(last.params[0]));
        const hy = surf.sy(clampBig(last.params[1]));
        const glow = ctx.createRadialGradient(hx, hy, 0, hx, hy, 22);
        glow.addColorStop(0, 'rgba(255,106,213,0.9)');
        glow.addColorStop(1, 'rgba(255,106,213,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(hx, hy, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(hx, hy, 4.5, 0, Math.PI * 2);
        ctx.fill();
      });
    } else {
      // Nisbiy masofa ‖b − b*‖ / ‖b*‖ har bir parametr uchun (log masshtab)
      const ols = data.olsParams;
      const series = ols.map((_, j) => hist.map((h) => [h.epoch, Math.log10(Math.abs(h.params[j] - ols[j]) / (Math.abs(ols[j]) + 1e-12) + 1e-16)]));
      const all = res.history.flatMap((h) => ols.map((o, j) => Math.log10(Math.abs(h.params[j] - o) / (Math.abs(o) + 1e-12) + 1e-16)));
      surf.setDomain([0, Math.max(1, res.history[res.history.length - 1].epoch)], extent(all.filter(Number.isFinite), 0.08));
      surf.axes('Epoxa', 'log₁₀ |b − b*| / |b*|');
      const palette = [C.c1, C.c2, C.c3, C.good, C.warn, C.bad];
      surf.clip(() => {
        series.forEach((s, j) => {
          ctx.strokeStyle = palette[j % palette.length];
          ctx.lineWidth = 2;
          ctx.beginPath();
          s.forEach(([x, y], i) => (i ? ctx.lineTo(surf.sx(x), surf.sy(y)) : ctx.moveTo(surf.sx(x), surf.sy(y))));
          ctx.stroke();
        });
      });
      ctx.font = '11px Manrope, sans-serif';
      data.paramNames.forEach((nm, j) => {
        ctx.fillStyle = palette[j % palette.length];
        ctx.fillText(`■ ${nm}`, surf.m.l + 10 + (j % 3) * 120, surf.m.t + 14 + Math.floor(j / 3) * 16);
      });
    }
  }

  function drawLoss(upto) {
    const { loss, res, optCost } = state;
    const ctx = loss.ctx;
    ctx.clearRect(0, 0, loss.w, loss.h);
    const pts = res.history.filter((h) => Number.isFinite(h.cost)).map((h) => [h.epoch, Math.log10(Math.max(h.cost, 1e-300))]);
    const target = Math.log10(Math.max(optCost, 1e-300));
    loss.setDomain([0, Math.max(1, pts[pts.length - 1]?.[0] ?? 1)], extent([...pts.map((p) => p[1]), target], 0.1));
    loss.axes('Epoxa', 'log₁₀ J');
    loss.clip(() => {
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = C.good;
      ctx.beginPath();
      ctx.moveTo(loss.m.l, loss.sy(target));
      ctx.lineTo(loss.w - loss.m.r, loss.sy(target));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = C.c3;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      pts.slice(0, upto + 1).forEach(([x, y], i) => (i ? ctx.lineTo(loss.sx(x), loss.sy(y)) : ctx.moveTo(loss.sx(x), loss.sy(y))));
      ctx.stroke();
    });
  }

  function drawFit(upto) {
    const { fit, res, data, k } = state;
    const ctx = fit.ctx;
    ctx.clearRect(0, 0, fit.w, fit.h);
    const b = res.history[Math.min(upto, res.history.length - 1)].params;
    if (k === 1) {
      const xs = data.X.map((r) => r[0]);
      const xd = extent(xs, 0.06);
      fit.setDomain(xd, extent(data.y, 0.12));
      fit.axes(data.featureNames[0], data.targetName);
      fit.clip(() => {
        ctx.fillStyle = 'rgba(94,231,255,0.85)';
        xs.forEach((x, i) => {
          ctx.beginPath();
          ctx.arc(fit.sx(x), fit.sy(data.y[i]), 3.5, 0, Math.PI * 2);
          ctx.fill();
        });
        const [o0, o1] = data.olsParams;
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = C.good;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(fit.sx(xd[0]), fit.sy(o0 + o1 * xd[0]));
        ctx.lineTo(fit.sx(xd[1]), fit.sy(o0 + o1 * xd[1]));
        ctx.stroke();
        ctx.setLineDash([]);
        if (Number.isFinite(b[0]) && Number.isFinite(b[1])) {
          ctx.strokeStyle = C.c3;
          ctx.lineWidth = 2.6;
          ctx.beginPath();
          ctx.moveTo(fit.sx(xd[0]), fit.sy(b[0] + b[1] * xd[0]));
          ctx.lineTo(fit.sx(xd[1]), fit.sy(b[0] + b[1] * xd[1]));
          ctx.stroke();
        }
      });
    } else {
      const pred = data.X.map((r) => r.reduce((s, v, j) => s + v * b[j + 1], b[0]));
      const d = extent([...data.y, ...pred.filter((v) => Math.abs(v) < 1e12)], 0.08);
      fit.setDomain(d, d);
      fit.axes('ŷ (joriy)', data.targetName);
      fit.clip(() => {
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = C.good;
        ctx.beginPath();
        ctx.moveTo(fit.sx(d[0]), fit.sy(d[0]));
        ctx.lineTo(fit.sx(d[1]), fit.sy(d[1]));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,106,213,0.85)';
        pred.forEach((p, i) => {
          ctx.beginPath();
          ctx.arc(fit.sx(p), fit.sy(data.y[i]), 3.5, 0, Math.PI * 2);
          ctx.fill();
        });
      });
    }
  }

  function readout(upto) {
    const { res, data, optCost } = state;
    const h = res.history[Math.min(upto, res.history.length - 1)];
    const statusText = { converged: '<span class="pill pill--good">yaqinlashdi</span>', diverged: '<span class="pill pill--bad">uzoqlashdi — η ni kamaytiring</span>', max_epochs: '<span class="pill pill--warn">epoxalar tugadi</span>' };
    const done = upto >= res.history.length - 1;
    els.readout.innerHTML = `
      <div class="row"><span>Epoxa</span><b>${h.epoch} / ${res.epochs}</b></div>
      <div class="row"><span>J(b)</span><b>${fmt(h.cost, 6)}</b></div>
      <div class="row"><span>J min (EKKU)</span><b>${fmt(optCost, 6)}</b></div>
      ${h.params.map((v, j) => `<div class="row"><span>${data.paramNames[j]}</span><b>${fmt(v, 6)} <span class="muted">/ ${fmt(data.olsParams[j], 6)}</span></b></div>`).join('')}
      <div class="row"><span>Holat</span><b>${done ? statusText[res.status] : '<span class="pill pill--warn">ishlamoqda…</span>'}</b></div>`;
  }

  function drawAll() {
    if (!state) return;
    drawSurface(frame);
    drawLoss(frame);
    drawFit(frame);
    readout(frame);
  }

  function stop() {
    playing = false;
    cancelAnimationFrame(raf);
    els.play.textContent = '▶ Ishga tushirish';
  }

  function play() {
    if (!state) prepare();
    if (!state) return;
    if (frame >= state.res.history.length - 1) frame = 0;
    playing = true;
    els.play.textContent = '❚❚ Pauza';
    const total = state.res.history.length;
    const duration = Math.min(6000, Math.max(1800, total * 12));
    const t0 = performance.now() - (frame / total) * duration;
    const step = (now) => {
      if (!playing) return;
      frame = Math.max(0, Math.min(total - 1, Math.floor(((now - t0) / duration) * total)));
      drawAll();
      if (frame < total - 1) raf = requestAnimationFrame(step);
      else stop();
    };
    raf = requestAnimationFrame(step);
  }

  els.play.addEventListener('click', () => (playing ? stop() : play()));
  els.reset.addEventListener('click', () => {
    stop();
    frame = 0;
    drawAll();
  });

  let resizeTimer;
  const ro = new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!state) return;
      [state.surf, state.loss, state.fit].forEach((s) => s.resize());
      if (state.k === 1) buildContour();
      drawAll();
    }, 120);
  });
  ro.observe(els.surface);

  return {
    refresh() {
      prepare();
    },
    playIfIdle() {
      if (state && !playing) {
        frame = 0;
        play();
      }
    },
  };
}

function clampBig(v) {
  return Math.max(-1e9, Math.min(1e9, Number.isFinite(v) ? v : 1e9));
}
