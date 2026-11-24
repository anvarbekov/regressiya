/**
 * Laboratoriya: ma’lumotlar muharriri, model qurish va natijalarni ko‘rsatish.
 */
import { gsap } from 'gsap';
import katex from 'katex';
import { simpleRegressionSteps, correlationMatrix, partialCorrelations, correlationTest, describe, RegressionError } from '../core/regression.js';
import { fitModel, compareModels, isApplicable, MODEL_TYPES } from '../core/models.js';
import { parseTable, parseCells, parseNumber } from '../core/parser.js';
import { interpret, chaddock } from '../core/interpret.js';
import { fmt, fmtP, fmtPct, pText, stars, escapeHtml, texNum } from '../core/format.js';
import { scatterCurve, actualVsPredicted, residualsVsFitted, qqPlot, residualHistogram, cooksPlot, COLORS } from './charts.js';
import { plot3d } from './plot3d.js';
import { download, residualsCSV, modelJSON, htmlReport } from './report.js';
import { GLOSSARY } from '../core/glossary.js';
import { toCSV } from '../core/parser.js';

/** “?” tugmasi — bosilganda atama izohi ko‘rsatiladi (main.js dagi umumiy ishlovchi) */
export const helpBtn = (key) => (GLOSSARY[key] ? `<button type="button" class="help" data-help="${key}" aria-label="${GLOSSARY[key].title} — izoh">?</button>` : '');

const tex = (s, display = true) => katex.renderToString(s, { displayMode: display, throwOnError: false });
const MAX_ROWS = 5000;
const RENDER_ROWS = 400; // jadval muharririda bir vaqtda ko‘rsatiladigan qatorlar
const f6 = (v, d = 6) => texNum(v, d);

export function initLab(root, { onModel, toast }) {
  const $ = (id) => root.querySelector(`#${id}`);
  const els = {
    problem: $('problem-text'), source: $('problem-source'), editor: $('table-editor'), info: $('table-info'),
    addRow: $('add-row'), addCol: $('add-col'), clear: $('clear-table'), more: $('table-more'),
    csv: $('csv-input'), csvApply: $('csv-apply'), csvFile: $('csv-file'), csvReport: $('csv-report'),
    target: $('target-select'), chips: $('feature-chips'), intercept: $('intercept'), alpha: $('alpha-select'), type: $('model-type'), typeHint: $('model-type-hint'),
    fit: $('fit-btn'), error: $('fit-error'), empty: $('results-empty'), body: $('results-body'),
    eq: $('equation'), meta: $('model-meta'), copy: $('copy-eq'), metrics: $('metrics'),
    viz: $('viz-main'), vizTitle: $('viz-title'), legend: $('viz-legend'),
    predictForm: $('predict-form'), predictOut: $('predict-out'), forecast: $('forecast-input'), forecastBtn: $('forecast-btn'), forecastOut: $('forecast-out'),
    insights: $('insights'),
  };
  const panes = Object.fromEntries([...root.querySelectorAll('.result-pane')].map((p) => [p.dataset.pane, p]));

  const state = {
    headers: [], rows: [], labels: null, labelHeader: null, units: {}, target: null, features: [], modelType: 'linear',
    problem: '', title: '', source: null, predictAt: null, model: null, showAll: false,
  };

  /* ================= Jadval muharriri ================= */
  function renderTable() {
    const { headers, rows, labels } = state;
    const lim = state.showAll ? rows.length : Math.min(rows.length, RENDER_ROWS);
    const lh = labels ? `<th class="lbl">${escapeHtml(state.labelHeader || 'yorliq')}</th>` : '';
    const head = `<tr><th class="idx">#</th>${lh}${headers.map((h, j) => `<th><input data-h="${j}" value="${escapeHtml(h)}" aria-label="Ustun nomi ${j + 1}" title="${escapeHtml(state.units[h] || '')}" /></th>`).join('')}<th></th></tr>`;
    let body = '';
    for (let i = 0; i < lim; i++) {
      const r = rows[i];
      const lc = labels ? `<td class="lbl"><input data-l="${i}" value="${escapeHtml(labels[i] ?? '')}" aria-label="${i + 1}-qator yorlig‘i" /></td>` : '';
      body += `<tr><td class="idx">${i + 1}</td>${lc}${r
        .map((v, j) => `<td><input data-r="${i}" data-c="${j}" value="${escapeHtml(v)}" inputmode="decimal" class="${Number.isFinite(parseNumber(v)) ? '' : 'is-invalid'}" aria-label="${i + 1}-qator, ${escapeHtml(headers[j])}" /></td>`)
        .join('')}<td><button class="del" data-del="${i}" aria-label="${i + 1}-qatorni o‘chirish">×</button></td></tr>`;
    }
    els.editor.innerHTML = `<table><thead>${head}</thead><tbody>${body}</tbody></table>`;
    els.info.textContent = `${rows.length} qator · ${headers.length} ustun${labels ? ' + yorliqlar' : ''}`;
    els.more.hidden = lim >= rows.length;
    els.more.textContent = `Barcha ${rows.length} qatorni ko‘rsatish`;
  }
  els.more.addEventListener('click', () => {
    state.showAll = true;
    renderTable();
  });

  els.editor.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.h !== undefined) {
      const j = Number(t.dataset.h);
      const old = state.headers[j];
      const name = t.value.trim() || `ustun${j + 1}`;
      state.headers[j] = name;
      if (state.units[old]) state.units[name] = state.units[old];
      if (state.target === old) state.target = name;
      state.features = state.features.map((f) => (f === old ? name : f));
      renderVars();
      return;
    }
    if (t.dataset.l !== undefined) {
      state.labels[Number(t.dataset.l)] = t.value;
      return;
    }
    if (t.dataset.r !== undefined) {
      state.rows[Number(t.dataset.r)][Number(t.dataset.c)] = t.value;
      t.classList.toggle('is-invalid', !Number.isFinite(parseNumber(t.value)));
    }
  });
  // Excel/Sheets dan bir nechta katakni joylashtirish
  els.editor.addEventListener('paste', (e) => {
    const t = e.target;
    if (t.dataset.r === undefined) return;
    const text = e.clipboardData.getData('text');
    if (!/[\t\n]/.test(text.trim())) return;
    e.preventDefault();
    const r0 = Number(t.dataset.r);
    const c0 = Number(t.dataset.c);
    text.replace(/\r/g, '').split('\n').filter((l) => l.trim() !== '').forEach((line, di) => {
      const cells = line.split('\t');
      const ri = r0 + di;
      while (state.rows.length <= ri) {
        state.rows.push(state.headers.map(() => ''));
        if (state.labels) state.labels.push('');
      }
      cells.forEach((v, dj) => {
        if (c0 + dj < state.headers.length) state.rows[ri][c0 + dj] = v.trim();
      });
    });
    renderTable();
    toast('Ma’lumotlar joylashtirildi');
  });
  els.editor.addEventListener('click', (e) => {
    const d = e.target.closest('[data-del]');
    if (!d) return;
    const i = Number(d.dataset.del);
    state.rows.splice(i, 1);
    if (state.labels) state.labels.splice(i, 1);
    renderTable();
  });
  els.addRow.addEventListener('click', () => {
    if (state.rows.length >= MAX_ROWS) return toast(`Maksimal ${MAX_ROWS} qator`);
    state.rows.push(state.headers.map(() => ''));
    if (state.labels) state.labels.push('');
    state.showAll = true;
    renderTable();
    els.editor.scrollTop = els.editor.scrollHeight;
    els.editor.querySelector(`input[data-r="${state.rows.length - 1}"]`)?.focus();
  });
  els.addCol.addEventListener('click', () => {
    let k = state.headers.length + 1;
    while (state.headers.includes(`x${k}`)) k++;
    state.headers.push(`x${k}`);
    state.rows.forEach((r) => r.push(''));
    renderTable();
    renderVars();
  });
  els.clear.addEventListener('click', () => {
    state.rows = Array.from({ length: 5 }, () => state.headers.map(() => ''));
    state.labels = null;
    state.problem = '';
    state.source = null;
    state.title = 'Foydalanuvchi ma’lumotlari';
    renderProblem();
    renderTable();
  });

  /* ================= CSV / Excel ================= */
  root.querySelectorAll('#data-tabs button').forEach((b) =>
    b.addEventListener('click', () => {
      root.querySelectorAll('#data-tabs button').forEach((x) => x.classList.toggle('is-active', x === b));
      root.querySelectorAll('.data-tab').forEach((p) => (p.hidden = p.dataset.pane !== b.dataset.tab));
      if (b.dataset.tab === 'csv' && !els.csv.value.trim()) {
        const head = [...(state.labels ? [state.labelHeader || 'yorliq'] : []), ...state.headers];
        els.csv.value = [head.join(';'), ...state.rows.map((r, i) => [...(state.labels ? [state.labels[i]] : []), ...r].join(';'))].join('\n');
      }
    }),
  );

  function applyParsed(t, sourceName) {
    if (t.rows.length > MAX_ROWS) throw new Error(`Juda ko‘p qator (${t.rows.length}); maksimal ${MAX_ROWS}`);
    if (t.headers.length < 2) throw new Error('Kamida 2 ta sonli ustun kerak');
    load({
      headers: t.headers,
      rows: t.rows,
      labels: t.labels,
      labelHeader: t.labelHeader,
      target: t.headers[t.headers.length - 1],
      features: t.headers.slice(0, -1).slice(0, 6),
      problem: '',
      title: 'Foydalanuvchi ma’lumotlari',
      source: sourceName ? { name: sourceName } : null,
      modelType: 'linear',
    });
    const notes = [];
    if (t.delimiter) notes.push(`ajratuvchi: “${t.delimiter === '\t' ? 'TAB' : t.delimiter === ' ' ? 'bo‘shliq' : t.delimiter}”`);
    if (t.decimalComma) notes.push('o‘nlik vergul');
    if (t.labels) notes.push(`yorliq ustuni: “${escapeHtml(t.labelHeader)}”`);
    els.csvReport.innerHTML = `✓ ${t.rows.length} qator, ${t.headers.length} ta sonli ustun yuklandi${notes.length ? ` (${notes.join(', ')})` : ''}.${
      t.dropped?.length ? ` Matnli ustunlar e’tiborga olinmadi: ${t.dropped.map(escapeHtml).join(', ')}.` : ''
    }${t.skipped.length ? ` ${t.skipped.length} ta qator o‘tkazib yuborildi: ${t.skipped.slice(0, 3).map((s) => `${s.line}-qator (${escapeHtml(s.reason)})`).join('; ')}${t.skipped.length > 3 ? '…' : ''}` : ''}`;
    root.querySelector('#data-tabs button[data-tab="table"]').click();
    toast('Ma’lumotlar jadvalga yuklandi');
    fit({ scroll: false });
  }
  els.csvApply.addEventListener('click', () => {
    try {
      applyParsed(parseTable(els.csv.value), 'Foydalanuvchi kiritgan matn');
    } catch (e) {
      els.csvReport.innerHTML = `<span style="color:var(--bad)">✕ ${escapeHtml(e.message)}</span>`;
    }
  });
  els.csvFile.addEventListener('change', async () => {
    const f = els.csvFile.files[0];
    if (!f) return;
    els.csvFile.value = '';
    if (f.size > 10 * 1024 * 1024) {
      els.csvReport.textContent = 'Fayl hajmi 10 MB dan oshmasligi kerak';
      return;
    }
    try {
      if (/\.xlsx$/i.test(f.name)) {
        els.csvReport.textContent = 'Excel fayli o‘qilmoqda…';
        const { default: readXlsxFile } = await import('read-excel-file');
        let cells;
        try {
          cells = await readXlsxFile(f);
        } catch (err) {
          throw new Error(`Excel faylini o‘qib bo‘lmadi (${err.message}). Faylni Excel’da qayta saqlang yoki “CSV (UTF-8)” formatida eksport qiling.`);
        }
        applyParsed(parseCells(cells), f.name);
      } else if (/\.xls$/i.test(f.name)) {
        throw new Error('Eski .xls formati qo‘llab-quvvatlanmaydi — faylni Excel’da .xlsx yoki .csv sifatida saqlang');
      } else {
        const text = await f.text();
        els.csv.value = text.length > 200000 ? `${text.slice(0, 200000)}\n# … (qisqartirildi)` : text;
        applyParsed(parseTable(text), f.name);
      }
    } catch (e) {
      els.csvReport.innerHTML = `<span style="color:var(--bad)">✕ ${escapeHtml(e.message || String(e))}</span>`;
    }
  });

  /* ================= O‘zgaruvchilar va model turi ================= */
  function renderVars() {
    const { headers } = state;
    if (!headers.includes(state.target)) state.target = headers[headers.length - 1];
    els.target.innerHTML = headers.map((h) => `<option ${h === state.target ? 'selected' : ''}>${escapeHtml(h)}</option>`).join('');
    state.features = state.features.filter((f) => headers.includes(f) && f !== state.target);
    els.chips.innerHTML = headers
      .filter((h) => h !== state.target)
      .map((h) => `<label class="chip"><input type="checkbox" value="${escapeHtml(h)}" ${state.features.includes(h) ? 'checked' : ''}/>${escapeHtml(h)}</label>`)
      .join('');
    renderTypeSelect();
  }
  function renderTypeSelect() {
    els.type.innerHTML = Object.entries(MODEL_TYPES)
      .map(([id, t]) => `<option value="${id}" ${id === state.modelType ? 'selected' : ''}>${t.label}: ${t.formula}</option>`)
      .join('');
    const t = MODEL_TYPES[state.modelType];
    els.typeHint.innerHTML = state.modelType === 'linear' ? '' : `Chiziqlilashtirish: ${t.logY ? 'ln y' : 'y'} ↔ ${t.names('x').join(', ')} ${helpBtn('linearize')}`;
    els.intercept.disabled = state.modelType !== 'linear';
    if (state.modelType !== 'linear') els.intercept.checked = true;
  }
  els.target.addEventListener('change', () => {
    state.target = els.target.value;
    renderVars();
  });
  els.chips.addEventListener('change', () => {
    state.features = [...els.chips.querySelectorAll('input:checked')].map((i) => i.value);
  });
  els.type.addEventListener('change', () => {
    state.modelType = els.type.value;
    renderTypeSelect();
    if (state.model) fit({ scroll: false });
  });

  /* ================= Masala sharti va manba ================= */
  function renderProblem() {
    els.problem.textContent = state.problem;
    if (state.source?.name) {
      els.source.hidden = false;
      els.source.innerHTML = `<b>Manba:</b> ${escapeHtml(state.source.name)}${state.source.via ? `<br><span class="muted">${escapeHtml(state.source.via)}</span>` : ''}${
        state.source.url ? `<br><a href="${escapeHtml(state.source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(state.source.url.replace(/^https?:\/\//, '').slice(0, 60))} ↗</a>` : ''
      }`;
    } else els.source.hidden = true;
  }

  /* ================= Yuklash ================= */
  function load(ds) {
    state.headers = [...ds.headers];
    state.rows = ds.rows.map((r) => r.map((v) => String(v)));
    state.labels = ds.labels ? [...ds.labels] : null;
    state.labelHeader = ds.labelHeader ?? (ds.labels ? 'yorliq' : null);
    state.units = { ...(ds.units || {}) };
    state.target = ds.target;
    state.features = [...ds.features];
    state.modelType = ds.modelType && MODEL_TYPES[ds.modelType] ? ds.modelType : 'linear';
    state.problem = ds.problem ?? '';
    state.title = ds.title ?? '';
    state.source = ds.source ?? null;
    state.predictAt = ds.predictAt ?? null;
    state.showAll = false;
    renderProblem();
    renderTable();
    renderVars();
  }

  /* ================= Model qurish ================= */
  function collect() {
    const ti = state.headers.indexOf(state.target);
    const fi = state.features.map((f) => state.headers.indexOf(f));
    if (ti < 0) throw new RegressionError('Natijaviy belgini tanlang', 'NO_TARGET');
    if (fi.length === 0) throw new RegressionError('Kamida bitta omil (x) tanlang', 'NO_FEATURES');
    const X = [];
    const y = [];
    const labels = [];
    let skipped = 0;
    state.rows.forEach((r, i) => {
      if (r.every((v) => String(v).trim() === '')) return;
      const yy = parseNumber(r[ti]);
      const xx = fi.map((j) => parseNumber(r[j]));
      if (!Number.isFinite(yy) || xx.some((v) => !Number.isFinite(v))) {
        skipped++;
        return;
      }
      X.push(xx);
      y.push(yy);
      labels.push(state.labels ? state.labels[i] || `№${i + 1}` : null);
    });
    return { X, y, labels: state.labels ? labels : null, skipped };
  }

  function fit({ scroll = true } = {}) {
    els.error.hidden = true;
    let M;
    let info;
    try {
      info = collect();
      M = fitModel(info.X, info.y, {
        type: state.modelType,
        intercept: els.intercept.checked,
        alpha: Number(els.alpha.value),
        featureNames: [...state.features],
        targetName: state.target,
        labels: info.labels,
        units: state.units,
      });
    } catch (e) {
      els.error.textContent = e instanceof RegressionError ? e.message : `Kutilmagan xato: ${e.message}`;
      els.error.hidden = false;
      gsap.fromTo(els.error, { x: -8 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' });
      if (!(e instanceof RegressionError)) console.error(e);
      return null;
    }
    M.compare = compareModels(info.X, info.y, { alpha: Number(els.alpha.value), featureNames: [...state.features], targetName: state.target });
    state.model = M;
    if (info.skipped) toast(`${info.skipped} ta to‘liq bo‘lmagan qator hisobga olinmadi`);
    renderResults(M);
    onModel?.(M);
    if (scroll) els.body.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return M;
  }
  els.fit.addEventListener('click', () => fit());

  /* ================= Natijalar ================= */
  function renderResults(M) {
    els.empty.hidden = true;
    els.body.hidden = false;
    const eq = M.equation(4);
    els.eq.innerHTML = tex(eq.tex) + (M.type !== 'linear' ? `<div class="eq-lin">${tex(`\\text{Chiziqlilashtirilgan: } ${linearizedTex(M)}`, false)}</div>` : '');
    els.meta.textContent = `${M.typeLabel} model · n = ${M.n} · omillar: ${M.k} · ishonchlilik ${Math.round((1 - M.alpha) * 100)}%${M.intercept ? '' : ' · ozod hadsiz'}`;
    els.copy.onclick = async () => {
      try {
        await navigator.clipboard.writeText(eq.text);
        toast('Tenglama nusxalandi');
      } catch {
        toast(eq.text);
      }
    };
    renderMetrics(M);
    renderViz(M);
    renderCoef(M);
    renderAnova(M);
    renderDiag(M);
    renderResid(M);
    renderSteps(M);
    renderCorr(M);
    renderDesc(M);
    renderModels(M);
    renderPredict(M);
    renderInsights(M);
    gsap.from(els.body.children, { y: 40, opacity: 0, duration: 0.8, stagger: 0.08, ease: 'power3.out', clearProps: 'all' });
  }

  function linearizedTex(M) {
    const B = M.base;
    const nm = (s) => `\\text{${String(s).replace(/[\\{}$&#^_%~]/g, (c) => `\\${c}`)}}`;
    const terms = B.coefficients.map((b, j) => {
      const isI = M.intercept && j === 0;
      const v = texNum(Math.abs(b), 4);
      const sg = j === 0 ? (b < 0 ? '-' : '') : b < 0 ? ' - ' : ' + ';
      return `${sg}${v}${isI ? '' : `\\,${nm(B.featureNames[j - (M.intercept ? 1 : 0)])}`}`;
    });
    return `\\widehat{${nm(B.targetName)}} = ${terms.join('')}`;
  }

  function renderMetrics(M) {
    const B = M.base;
    const m = M.metrics;
    const dw = B.diagnostics.durbinWatson;
    const nl = M.type !== 'linear';
    const tiles = [
      { label: nl ? 'R² indeks' : 'R²', help: nl ? 'index' : 'r2', value: m.r2, digits: 4, hint: `bog‘lanish ${chaddock(Math.sqrt(Math.max(m.r2, 0)))}`, level: m.r2 >= 0.7 ? 'good' : m.r2 >= 0.4 ? '' : 'warn', bar: m.r2 },
      { label: 'R² tuzat.', help: 'adjR2', value: m.adjR2, digits: 4, hint: `${fmtPct(Math.max(0, m.adjR2))} izohlangan`, bar: Math.max(0, m.adjR2) },
      { label: 'F-statistika', help: 'f', value: B.metrics.fStat, digits: 4, hint: B.metrics.fPValue === null ? '—' : `F_jad = ${fmt(B.fCritical, 3)} · ${pText(B.metrics.fPValue)}`, level: B.metrics.fPValue !== null && B.metrics.fPValue < M.alpha ? 'good' : 'bad' },
      { label: 'Std. xato σ', help: 'sigma', value: m.sigma, digits: 4, hint: `RMSE = ${fmt(m.rmse, 4)}` },
      { label: 'MAPE', help: 'mape', value: m.mape, digits: 3, suffix: '%', hint: m.mape === null ? 'y da nol bor' : m.mape <= 10 ? 'yuqori aniqlik' : m.mape <= 20 ? 'qoniqarli' : 'past aniqlik', level: m.mape === null ? '' : m.mape <= 10 ? 'good' : m.mape <= 20 ? 'warn' : 'bad' },
      { label: 'DW', help: 'dw', value: dw, digits: 3, hint: dw > 1.5 && dw < 2.5 ? 'avtokorrelyatsiya yo‘q' : 'tekshiring', level: dw > 1.5 && dw < 2.5 ? 'good' : 'warn' },
    ];
    els.metrics.innerHTML = tiles
      .map(
        (t, i) => `<div class="metric" data-level="${t.level ?? ''}">
          <div class="metric__label">${t.label}${t.help ? helpBtn(t.help) : ''}</div>
          <div class="metric__value" data-i="${i}">${t.value === null ? '—' : fmt(t.value, t.digits) + (t.suffix ?? '')}</div>
          <div class="metric__hint">${t.hint}</div>
          ${t.bar !== undefined ? `<div class="metric__bar" style="width:${Math.max(0, Math.min(1, t.bar)) * 100}%"></div>` : ''}
        </div>`,
      )
      .join('');
    tiles.forEach((t, i) => {
      if (t.value === null || !Number.isFinite(t.value)) return;
      const node = els.metrics.querySelector(`[data-i="${i}"]`);
      const o = { v: 0 };
      gsap.to(o, { v: t.value, duration: 1.4, ease: 'power3.out', delay: 0.2 + i * 0.05, onUpdate: () => (node.textContent = fmt(o.v, t.digits) + (t.suffix ?? '')), onComplete: () => (node.textContent = fmt(t.value, t.digits) + (t.suffix ?? '')) });
    });
    gsap.from(els.metrics.querySelectorAll('.metric__bar'), { scaleX: 0, duration: 1.4, ease: 'power3.out', delay: 0.3 });
  }

  function renderViz(M) {
    els.viz._dispose3d?.();
    els.viz.innerHTML = '';
    const D = M.base.diagnostics;
    const highlight = D.cooksD.map((d, i) => [d, i]).filter(([d]) => d > 4 / M.n).map(([, i]) => i);
    const conf = Math.round((1 - M.alpha) * 100);
    if (M.k === 1) {
      els.vizTitle.textContent = `${M.targetName} = f(${M.featureNames[0]}) · ${M.typeLabel.toLowerCase()} model`;
      els.legend.innerHTML = `<span><i style="background:${COLORS.c1}" class="dot"></i>kuzatuvlar</span><span><i style="background:${COLORS.warn}" class="dot"></i>ta’sirchan</span><span><i style="background:linear-gradient(90deg,${COLORS.c1},${COLORS.c3})"></i>regressiya ${M.type === 'linear' ? 'chizig‘i' : 'egri chizig‘i'}</span><span><i style="background:rgba(94,231,255,0.45)"></i>${conf}% ishonch oralig‘i</span><span><i style="background:rgba(255,106,213,0.35)"></i>bashorat oralig‘i</span>`;
      scatterCurve(els.viz, M, { highlight });
    } else if (M.k === 2) {
      els.vizTitle.textContent = `Regressiya ${M.type === 'linear' ? 'tekisligi' : 'sirti'} (3D)`;
      els.legend.innerHTML = `<span><i style="background:${COLORS.c1}" class="dot"></i>sirtdan yuqori</span><span><i style="background:${COLORS.c3}" class="dot"></i>sirtdan past</span><span><i style="background:#fff;opacity:.5"></i>qoldiqlar</span>`;
      plot3d(els.viz, M);
    } else {
      els.vizTitle.textContent = 'Haqiqiy va bashorat qilingan qiymatlar';
      els.legend.innerHTML = `<span><i style="background:${COLORS.c1}" class="dot"></i>kuzatuvlar</span><span><i style="background:${COLORS.c3}"></i>ideal moslik y = ŷ</span>`;
      actualVsPredicted(els.viz, M);
    }
  }

  function renderCoef(M) {
    const B = M.base;
    const off = M.intercept ? 1 : 0;
    const conf = Math.round((1 - M.alpha) * 100);
    const lin = M.type === 'linear';
    const hetero = B.diagnostics.breuschPagan && B.diagnostics.breuschPagan.pValue < M.alpha;
    const rows = B.paramNames
      .map((nm, j) => {
        const p = B.pValues[j];
        const f = j - off;
        return `<tr>
          <td>${escapeHtml(nm)}</td>
          <td>${fmt(B.coefficients[j], 6)}</td>
          <td>${fmt(B.standardErrors[j], 5)}</td>
          <td>${fmt(B.tStats[j], 4)}</td>
          <td>${fmtP(p)} <span class="sig">${stars(p)}</span></td>
          <td>${fmt(B.confidenceIntervals[j][0], 5)} … ${fmt(B.confidenceIntervals[j][1], 5)}</td>
          <td class="${hetero ? 'hl' : ''}">${fmt(B.robust.standardErrors[j], 5)}</td>
          <td class="${hetero ? 'hl' : ''}">${fmtP(B.robust.pValues[j])} <span class="sig">${stars(B.robust.pValues[j])}</span></td>
          ${lin ? `<td>${f >= 0 ? fmt(B.standardized[f], 4) : ''}</td>` : ''}
          ${B.diagnostics.vif ? `<td>${f >= 0 ? fmt(B.diagnostics.vif[f], 4) : ''}</td>` : ''}
        </tr>`;
      })
      .join('');
    const el = M.featureNames
      .map((n, j) => (M.elasticity[j] === null ? '' : `<span class="pill pill--info">${escapeHtml(n)}: E = ${fmt(M.elasticity[j], 4)}</span>`))
      .join(' ');
    const stdEq =
      lin && M.k >= 1 && M.intercept
        ? `<p class="note">Standartlashgan shakldagi tenglama: ${tex(`t_{\\hat y} = ${B.standardized.map((b, j) => `${j && b >= 0 ? '+' : ''}${f6(b, 4)}\\,t_{${j + 1}}`).join(' ')}`, false)} (tⱼ — standartlashtirilgan omillar)</p>`
        : '';
    const ext = M.extrema ? `<p class="note">${M.extrema.map((e, j) => `Parabola ${e.kind} nuqtasi: ${escapeHtml(M.featureNames[j])}* = ${fmt(e.x, 5)}`).join('; ')}</p>` : '';
    const gr = M.growthRate !== null ? `<p class="note">O‘rtacha o‘sish sur’ati (bir birlikka): <b>${fmt(M.growthRate * 100, 5)}%</b>; asl ko‘rinishdagi parametr a = ${fmt(M.a, 6)} ${helpBtn('growth')}</p>` : '';
    const aNote = ['power', 'exponential'].includes(M.type) ? `<p class="note">Asl tenglamadagi a = e^(${fmt(B.coefficients[0], 6)}) = ${fmt(M.a, 6)}.</p>` : '';
    panes.coef.innerHTML = `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Parametr</th><th>Baho b${helpBtn('coef')}</th><th>Std. xato${helpBtn('se')}</th><th>t${helpBtn('t')}</th><th>p-qiymat${helpBtn('p')}</th><th>${conf}% ishonch oralig‘i${helpBtn('ci')}</th><th>SE (HC3)${helpBtn('hc3')}</th><th>p (HC3)</th>${lin ? `<th>β (std.)${helpBtn('beta')}</th>` : ''}${B.diagnostics.vif ? `<th>VIF${helpBtn('vif')}</th>` : ''}</tr></thead>
      <tbody>${rows}</tbody></table></div>
      <p class="note">t<sub>jadval</sub>(${1 - M.alpha / 2}; ${B.anova.residual.df}) = ${fmt(B.tCritical, 5)} ${helpBtn('fcrit')} · Ahamiyatlilik: *** p &lt; 0.001, ** p &lt; 0.01, * p &lt; 0.05, · p &lt; 0.1${hetero ? ' · <b style="color:var(--warn)">Geteroskedastiklik aniqlangan — HC3 ustunlariga tayaning</b>' : ''}</p>
      <p class="note">Elastiklik koeffitsiyentlari (o‘rtacha nuqtada) ${helpBtn('elast')}: ${el || '—'}</p>${stdEq}${ext}${gr}${aNote}`;
  }

  function renderAnova(M) {
    const B = M.base;
    const A = B.anova;
    const nl = M.type !== 'linear';
    panes.anova.innerHTML = `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Variatsiya manbai</th><th>Kvadratlar yig‘indisi (SS)</th><th>Erkinlik darajasi (df)</th><th>O‘rtacha kvadrat (MS)</th><th>F_haq</th><th>F_jadval (α = ${M.alpha})</th><th>p-qiymat</th></tr></thead>
      <tbody>
        <tr><td>Regressiya (izohlangan)</td><td>${fmt(A.regression.ss, 6)}</td><td>${A.regression.df}</td><td>${fmt(A.regression.ms, 6)}</td><td>${fmt(A.f, 5)}</td><td>${fmt(B.fCritical, 5)}</td><td>${fmtP(A.pValue)} <span class="sig">${A.pValue !== null ? stars(A.pValue) : ''}</span></td></tr>
        <tr><td>Qoldiq (izohlanmagan)</td><td>${fmt(A.residual.ss, 6)}</td><td>${A.residual.df}</td><td>${fmt(A.residual.ms, 6)}</td><td></td><td></td><td></td></tr>
      </tbody>
      <tfoot><tr><td>Jami</td><td>${fmt(A.total.ss, 6)}</td><td>${A.total.df}</td><td></td><td></td><td></td><td></td></tr></tfoot>
    </table></div>
    <p class="note">${A.f !== null ? (A.f > B.fCritical ? `F_haq = ${fmt(A.f, 4)} > F_jadval = ${fmt(B.fCritical, 4)} ⇒ H₀ rad etiladi, regressiya tenglamasi statistik ahamiyatli.` : `F_haq = ${fmt(A.f, 4)} ≤ F_jadval = ${fmt(B.fCritical, 4)} ⇒ H₀ rad etilmaydi.`) : ''}${nl ? ` Dispersiya tahlili chiziqlilashtirilgan model (${escapeHtml(B.targetName)}) bo‘yicha.` : ''}</p>
    <div class="metrics" style="margin-top:16px">
      <div class="metric"><div class="metric__label">Log-likelihood</div><div class="metric__value">${fmt(B.metrics.logLik, 5)}</div></div>
      <div class="metric"><div class="metric__label">AIC</div><div class="metric__value">${fmt(B.metrics.aic, 5)}</div></div>
      <div class="metric"><div class="metric__label">BIC</div><div class="metric__value">${fmt(B.metrics.bic, 5)}</div></div>
      <div class="metric"><div class="metric__label">MAE (asl)</div><div class="metric__value">${fmt(M.metrics.mae, 5)}</div></div>
    </div>
    <p class="note">${M.intercept ? 'SST markazlashgan: Σ(yᵢ − ȳ)².' : 'Ozod hadsiz model: SST markazlashmagan — Σyᵢ².'}${nl ? ' AIC/BIC chiziqlilashtirilgan model bo‘yicha — natijaviy belgi turlicha almashtirilgan modellarni ular bilan solishtirib bo‘lmaydi (buning uchun «Modellar» tabidagi determinatsiya indeksidan foydalaning).' : ''}</p>`;
  }

  function renderDiag(M) {
    const D = M.base.diagnostics;
    const a = M.alpha;
    const pill = (ok, good, bad, mid) => `<span class="pill pill--${ok === true ? 'good' : ok === false ? 'bad' : 'warn'}">${ok === true ? good : ok === false ? bad : mid}</span>`;
    const dwOk = D.durbinWatson > 1.5 && D.durbinWatson < 2.5 ? true : D.durbinWatson < 1 || D.durbinWatson > 3 ? false : null;
    const lab = (i) => (M.labels ? M.labels[i] : `№${i + 1}`);
    const cards = [
      { name: 'Darbin–Uotson', help: 'dw', val: fmt(D.durbinWatson, 4), status: pill(dwOk, 'avtokorr. yo‘q', 'avtokorrelyatsiya', 'noaniq zona'), text: 'Qoldiqlarning ketma-ket korrelyatsiyasi. Ideal ≈ 2. Faqat vaqt qatorlari uchun talqin qilinadi.' },
      { name: 'Jark–Bera', help: 'jb', val: `${fmt(D.jarqueBera.statistic, 4)}`, status: pill(D.jarqueBera.pValue >= a, 'normal', 'normal emas'), text: `${pText(D.jarqueBera.pValue)} · S = ${fmt(D.jarqueBera.skew, 3)} · K = ${fmt(D.jarqueBera.kurtosis, 3)}` },
    ];
    if (D.breuschPagan) cards.push({ name: 'Breush–Pagan', help: 'bp', val: fmt(D.breuschPagan.statistic, 4), status: pill(D.breuschPagan.pValue >= a, 'gomoskedastik', 'geteroskedastik'), text: `${pText(D.breuschPagan.pValue)} · df = ${D.breuschPagan.df} (Koenker)` });
    cards.push({ name: 'Shartlilik soni', help: 'cond', val: fmt(D.conditionNumber, 4), status: pill(D.conditionNumber < 1000 ? true : D.conditionNumber > 1e6 ? false : null, 'yaxshi', 'juda yuqori', 'yuqori'), text: '√(λmax/λmin) — XᵀX xos qiymatlari. Masshtab farqiga ham sezgir.' });
    if (D.vif) {
      const mx = Math.max(...D.vif);
      cards.push({ name: 'Maks. VIF', help: 'vif', val: fmt(mx, 4), status: pill(mx < 5 ? true : mx >= 10 ? false : null, 'me’yorda', 'multikollinearlik', 'e’tibor bering'), text: M.base.featureNames.map((f, j) => `${escapeHtml(f)}: ${fmt(D.vif[j], 3)}`).join(' · ') });
    }
    const inflIdx = D.cooksD.map((d, i) => [d, i]).filter(([d]) => d > 4 / M.n).sort((x, y) => y[0] - x[0]);
    cards.push({
      name: 'Ta’sirchan nuqtalar',
      help: 'cook',
      val: String(inflIdx.length),
      status: pill(inflIdx.length === 0 ? true : D.cooksD.some((d) => d > 1) ? false : null, 'yo‘q', 'D > 1 bor', 'tekshiring'),
      text: `D > 4/n = ${fmt(4 / M.n, 3)}${inflIdx.length ? `: ${inflIdx.slice(0, 6).map(([d, i]) => `${escapeHtml(lab(i))} (${fmt(d, 3)})`).join(', ')}${inflIdx.length > 6 ? '…' : ''}` : ''}. Maks. leverage = ${fmt(Math.max(...D.leverage), 3)}`,
    });
    panes.diag.innerHTML = `<div class="diag-grid">${cards.map((c) => `<div class="diag"><h4><span>${c.name}${helpBtn(c.help)}</span> ${c.status}</h4><div class="val">${c.val}</div><p>${c.text}</p></div>`).join('')}</div>${
      M.type !== 'linear' ? '<p class="note">Diagnostika testlari chiziqlilashtirilgan model qoldiqlari bo‘yicha o‘tkaziladi — EKKU shartlari aynan shu model uchun talab qilinadi.</p>' : ''
    }`;
  }

  function renderResid(M) {
    panes.resid.innerHTML = `<div class="resid-grid">
      <div><h4>Studentlashgan qoldiqlar va ŷ</h4><div class="viz" data-c="rf"></div></div>
      <div><h4>Normal Q–Q grafigi</h4><div class="viz" data-c="qq"></div></div>
      <div><h4>Qoldiqlar gistogrammasi</h4><div class="viz" data-c="hist"></div></div>
      <div><h4>Kuk masofasi</h4><div class="viz" data-c="cook"></div></div>
    </div>`;
    const q = (s) => panes.resid.querySelector(`[data-c="${s}"]`);
    residualsVsFitted(q('rf'), M.base);
    qqPlot(q('qq'), M.base);
    residualHistogram(q('hist'), M.base);
    cooksPlot(q('cook'), M.base);
  }

  /* ---------- Qadamma-qadam yechim ---------- */
  function stepsTable(xs, ys, xh, yh, fit) {
    const n = xs.length;
    const shown = Math.min(n, 12);
    let body = '';
    let sx = 0;
    let sy = 0;
    let sxy = 0;
    let sxx = 0;
    for (let i = 0; i < n; i++) {
      sx += xs[i];
      sy += ys[i];
      sxy += xs[i] * ys[i];
      sxx += xs[i] * xs[i];
      if (i < shown) body += `<tr><td>${i + 1}</td><td>${fmt(xs[i])}</td><td>${fmt(ys[i])}</td><td>${fmt(xs[i] * ys[i])}</td><td>${fmt(xs[i] ** 2)}</td><td>${fmt(fit[i])}</td><td>${fmt(ys[i] - fit[i])}</td></tr>`;
    }
    if (n > shown) body += `<tr><td>…</td><td colspan="6" style="text-align:left">yana ${n - shown} qator</td></tr>`;
    return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>i</th><th>${xh}</th><th>${yh}</th><th>${xh}·${yh}</th><th>${xh}²</th><th>ŷ</th><th>e</th></tr></thead><tbody>${body}</tbody>
      <tfoot><tr><td>Σ</td><td>${fmt(sx, 6)}</td><td>${fmt(sy, 6)}</td><td>${fmt(sxy, 6)}</td><td>${fmt(sxx, 6)}</td><td>${fmt(sy, 6)}</td><td>≈ 0</td></tr></tfoot></table></div>`;
  }

  function simpleSteps(B, xs, ys, X, Y, startN = 1) {
    const s = simpleRegressionSteps(xs, ys);
    const step = (n, html) => `<div class="step"><div class="step__n">${n}</div><div class="step__body">${html}</div></div>`;
    return [
      step(startN, `<p>Yordamchi jadval (n = ${s.n}):</p>${stepsTable(xs, ys, X, Y, B.fitted)}`),
      step(startN + 1, `<p>O‘rtacha qiymatlar:</p>${tex(`\\bar ${X} = \\frac{\\sum ${X}_i}{n} = \\frac{${f6(s.sx)}}{${s.n}} = ${f6(s.mx)}, \\qquad \\bar ${Y} = \\frac{${f6(s.sy)}}{${s.n}} = ${f6(s.my)}`)}`),
      step(startN + 2, `<p>Chetlanishlar ko‘paytmalari va kvadratlari yig‘indisi:</p>${tex(`S_{${X}${Y}} = \\sum ${X}_i ${Y}_i - n\\bar ${X}\\bar ${Y} = ${f6(s.Sxy)}, \\qquad S_{${X}${X}} = \\sum ${X}_i^2 - n\\bar ${X}^2 = ${f6(s.Sxx)}`)}`),
      step(startN + 3, `<p>Regressiya koeffitsiyentlari:</p>${tex(`b_1 = \\frac{S_{${X}${Y}}}{S_{${X}${X}}} = \\frac{${f6(s.Sxy)}}{${f6(s.Sxx)}} = ${f6(s.b1)}, \\qquad b_0 = \\bar ${Y} - b_1\\bar ${X} = ${f6(s.b0)}`)}`),
      step(startN + 4, `<p>Korrelyatsiya koeffitsiyenti:</p>${tex(`r = \\frac{S_{${X}${Y}}}{\\sqrt{S_{${X}${X}}S_{${Y}${Y}}}} = ${f6(s.r)}, \\qquad r^2 = ${f6(s.r2)}`)}<p>Bog‘lanish ${chaddock(s.r)} va ${s.r >= 0 ? 'to‘g‘ri' : 'teskari'} (Chaddok shkalasi).</p>`),
      step(
        startN + 5,
        `<p>Ahamiyatlilikni tekshirish:</p>${tex(`F = \\frac{r^2}{1-r^2}(n-2) = ${f6(B.metrics.fStat)}, \\qquad t_{b_1} = \\frac{b_1}{SE(b_1)} = \\frac{${f6(s.b1)}}{${f6(B.standardErrors[1])}} = ${f6(B.tStats[1])}`)}<p>F<sub>jadval</sub> = ${fmt(B.fCritical, 5)}, t<sub>jadval</sub> = ${fmt(B.tCritical, 5)}; |t| ${Math.abs(B.tStats[1]) > B.tCritical ? '>' : '≤'} t<sub>jadval</sub> ⇒ koeffitsiyent ${Math.abs(B.tStats[1]) > B.tCritical ? 'ahamiyatli' : 'ahamiyatsiz'} (${pText(B.pValues[1])}).</p>`,
      ),
    ].join('');
  }

  function renderSteps(M) {
    const B = M.base;
    const step = (n, html) => `<div class="step"><div class="step__n">${n}</div><div class="step__body">${html}</div></div>`;
    const finalEq = (n) => step(n, `<p>Natijaviy tenglama:</p>${tex(M.equation(6).tex)}`);
    if (M.k === 1 && M.intercept && M.type === 'linear') {
      panes.steps.innerHTML = `<div class="steps">${simpleSteps(B, B.X.map((r) => r[0]), B.y, 'x', 'y')}${finalEq(7)}</div>`;
      return;
    }
    if (M.k === 1 && ['power', 'exponential', 'logarithmic', 'hyperbolic'].includes(M.type)) {
      const T = MODEL_TYPES[M.type];
      const X = T.names('x')[0] === 'x' ? 'x' : 'X';
      const Y = T.logY ? 'Y' : 'y';
      const subst = {
        power: 'Y = \\ln y,\\; X = \\ln x \\;\\Rightarrow\\; Y = \\ln a + b\\,X',
        exponential: 'Y = \\ln y \\;\\Rightarrow\\; Y = \\ln a + b\\,x',
        logarithmic: 'X = \\ln x \\;\\Rightarrow\\; y = a + b\\,X',
        hyperbolic: 'X = 1/x \\;\\Rightarrow\\; y = a + b\\,X',
      }[M.type];
      const back = T.logY ? step(7, `<p>Asl ko‘rinishga qaytish:</p>${tex(`a = e^{b_0} = e^{${f6(B.coefficients[0])}} = ${f6(M.a)}`)}`) : '';
      panes.steps.innerHTML = `<div class="steps">${step(0, `<p>${M.typeLabel} model ${tex(T.tex, false)} o‘zgaruvchilarni almashtirish orqali chiziqli ko‘rinishga keltiriladi:</p>${tex(subst)}<p>Keyingi hisoblashlar yangi o‘zgaruvchilar uchun oddiy juft regressiya kabi bajariladi.</p>`)}${simpleSteps(B, B.X.map((r) => r[0]), B.y, X, Y)}${back}${finalEq(T.logY ? 8 : 7)}</div>`;
      return;
    }
    if (M.k === 1 && M.type === 'quadratic') {
      const x = M.X.map((r) => r[0]);
      const y = M.y;
      const S = (fn) => x.reduce((s, v, i) => s + fn(v, y[i]), 0);
      const s = { n: x.length, x: S((v) => v), x2: S((v) => v ** 2), x3: S((v) => v ** 3), x4: S((v) => v ** 4), y: S((_, w) => w), xy: S((v, w) => v * w), x2y: S((v, w) => v * v * w) };
      const [a, b, c] = B.coefficients;
      panes.steps.innerHTML = `<div class="steps">
        ${step(1, `<p>Parabola ${tex('y = a + bx + cx^2', false)} parametrlari uchun EKKU normal tenglamalar sistemasi:</p>${tex('\\begin{cases} n\\,a + b\\sum x + c\\sum x^2 = \\sum y \\\\ a\\sum x + b\\sum x^2 + c\\sum x^3 = \\sum xy \\\\ a\\sum x^2 + b\\sum x^3 + c\\sum x^4 = \\sum x^2y \\end{cases}')}`)}
        ${step(2, `<p>Yig‘indilarni hisoblaymiz (n = ${s.n}):</p>${tex(`\\textstyle\\sum x = ${f6(s.x)},\\; \\sum x^2 = ${f6(s.x2)},\\; \\sum x^3 = ${f6(s.x3)},\\; \\sum x^4 = ${f6(s.x4)}`)}${tex(`\\textstyle\\sum y = ${f6(s.y)},\\; \\sum xy = ${f6(s.xy)},\\; \\sum x^2y = ${f6(s.x2y)}`)}`)}
        ${step(3, `<p>Sistema son qiymatlari bilan:</p>${tex(`\\begin{cases} ${s.n}a + ${f6(s.x)}b + ${f6(s.x2)}c = ${f6(s.y)} \\\\ ${f6(s.x)}a + ${f6(s.x2)}b + ${f6(s.x3)}c = ${f6(s.xy)} \\\\ ${f6(s.x2)}a + ${f6(s.x3)}b + ${f6(s.x4)}c = ${f6(s.x2y)} \\end{cases}`)}<p class="note">Dastur sistemani sonli barqaror QR-yoyilma bilan yechadi (normal tenglamalarning shartlilik soni katta bo‘lishi mumkin).</p>`)}
        ${step(4, `<p>Yechim:</p>${tex(`a = ${f6(a)},\\quad b = ${f6(b)},\\quad c = ${f6(c)}`)}`)}
        ${step(5, `<p>Ekstremum nuqtasi:</p>${tex(`x^* = -\\frac{b}{2c} = ${f6(M.extrema[0].x)} \\;(${M.extrema[0].kind})`)}`)}
        ${finalEq(6)}</div>`;
      return;
    }
    panes.steps.innerHTML = `<div class="steps">${step(
      'i',
      `<p>Ko‘p omilli modelda parametrlar matritsa usulida topiladi${M.type !== 'linear' ? ' (chiziqlilashtirilgan o‘zgaruvchilar uchun)' : ''}:</p>${tex('\\mathbf b = (X^{\\mathsf T}X)^{-1}X^{\\mathsf T}\\mathbf y \\;\\;\\Leftrightarrow\\;\\; X = QR,\\;\\; R\\,\\mathbf b = Q^{\\mathsf T}\\mathbf y')}
      <p>(XᵀX)⁻¹ matritsasi:</p>${tex(`\\left(X^{\\mathsf T}X\\right)^{-1} = \\begin{pmatrix}${B.XtXinv.map((r) => r.map((v) => texNum(v, 4)).join(' & ')).join(' \\\\ ')}\\end{pmatrix}`)}
      <p>Natija:</p>${tex(`\\mathbf b = \\begin{pmatrix}${B.coefficients.map((v) => f6(v)).join(' \\\\ ')}\\end{pmatrix}`)}`,
    )}${finalEq(2)}</div>`;
  }

  /* ---------- Korrelyatsiya ---------- */
  function renderCorr(M) {
    const names = [...M.featureNames, M.targetName];
    const cols = [...M.featureNames.map((_, j) => M.X.map((r) => r[j])), M.y];
    const R = correlationMatrix(cols);
    const k = names.length;
    const color = (r) => {
      if (!Number.isFinite(r)) return 'rgba(255,255,255,0.04)';
      const a = Math.abs(r);
      return r >= 0 ? `rgba(94,231,255,${0.08 + a * 0.6})` : `rgba(255,106,213,${0.08 + a * 0.6})`;
    };
    const heat = (Mx, title) => {
      let html = `<h4 class="sub">${title}</h4><div class="heat" style="grid-template-columns: minmax(80px,auto) repeat(${k}, minmax(64px,1fr))"><div class="h"></div>${names.map((n) => `<div class="h" title="${escapeHtml(n)}">${escapeHtml(n)}</div>`).join('')}`;
      for (let a = 0; a < k; a++) {
        html += `<div class="h" style="text-align:left" title="${escapeHtml(names[a])}">${escapeHtml(names[a])}</div>`;
        for (let b = 0; b < k; b++) html += `<div style="background:${color(Mx[a][b])}">${fmt(Mx[a][b], 3)}</div>`;
      }
      return `${html}</div>`;
    };
    const tests = M.featureNames
      .map((f, j) => {
        const r = R[j][k - 1];
        const t = correlationTest(r, M.n);
        return `<tr><td>${escapeHtml(f)}</td><td>${fmt(r, 4)}</td><td>${chaddock(r)}</td><td>${fmt(t.t, 4)}</td><td>${fmtP(t.p)} <span class="sig">${stars(t.p)}</span></td></tr>`;
      })
      .join('');
    let html = heat(R, 'Juft korrelyatsiya koeffitsiyentlari (Pirson)');
    html += `<div class="tbl-wrap" style="margin-top:14px"><table class="tbl"><thead><tr><th>Omil</th><th>r(y, x)</th><th>Zichlik (Chaddok)</th><th>t = r√(n−2)/√(1−r²)</th><th>p-qiymat</th></tr></thead><tbody>${tests}</tbody></table></div>`;
    if (M.k >= 2) {
      const P = partialCorrelations(cols);
      if (P) {
        html += heat(P, `Xususiy korrelyatsiya koeffitsiyentlari (qolgan o‘zgaruvchilar ta’siri chiqarilgan) ${helpBtn('partial')}`);
        const pt = M.featureNames
          .map((f, j) => {
            const r = P[j][k - 1];
            const t = correlationTest(r, M.n, M.k + 1);
            return `<tr><td>${escapeHtml(f)}</td><td>${fmt(R[j][k - 1], 4)}</td><td>${fmt(r, 4)}</td><td>${fmt(t.t, 4)}</td><td>${fmtP(t.p)} <span class="sig">${stars(t.p)}</span></td></tr>`;
          })
          .join('');
        html += `<div class="tbl-wrap" style="margin-top:14px"><table class="tbl"><thead><tr><th>Omil</th><th>Juft r</th><th>Xususiy r</th><th>t</th><th>p-qiymat</th></tr></thead><tbody>${pt}</tbody></table></div>`;
      }
    }
    html += `<p class="note">Korrelyatsiyalar asl o‘zgaruvchilar bo‘yicha. Ko‘p omilli modelda R = ${fmt(Math.sqrt(Math.max(M.metrics.r2, 0)), 4)}. |r| > 0.7 bo‘lgan omillar juftligi multikollinearlik belgisi bo‘lishi mumkin.</p>`;
    panes.corr.innerHTML = html;
    gsap.from(panes.corr.querySelectorAll('.heat > div:not(.h)'), { scale: 0.6, opacity: 0, duration: 0.5, stagger: 0.01, ease: 'back.out(2)' });
  }

  /* ---------- Tavsifiy statistika ---------- */
  function renderDesc(M) {
    const vars = [...M.featureNames.map((f, j) => [f, M.X.map((r) => r[j])]), [M.targetName, M.y]];
    const rows = vars
      .map(([name, v]) => {
        const s = describe(v);
        const u = state.units[name] ? ` <span class="muted">(${escapeHtml(state.units[name])})</span>` : '';
        return `<tr><td>${escapeHtml(name)}${u}</td><td>${s.n}</td><td>${fmt(s.mean, 5)}</td><td>${fmt(s.sd, 5)}</td><td>${fmt(s.min, 5)}</td><td>${fmt(s.q1, 5)}</td><td>${fmt(s.median, 5)}</td><td>${fmt(s.q3, 5)}</td><td>${fmt(s.max, 5)}</td><td>${s.cv === null ? '—' : `${fmt(s.cv, 3)}%`}</td><td>${fmt(s.skew, 3)}</td></tr>`;
      })
      .join('');
    panes.desc.innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>O‘zgaruvchi</th><th>n</th><th>O‘rtacha</th><th>Std. chetl.</th><th>Min</th><th>Q1</th><th>Mediana</th><th>Q3</th><th>Maks</th><th>Variatsiya koef.</th><th>Asimmetriya</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="note">Standart chetlanish tanlama formulasi bo‘yicha (n − 1). Variatsiya koeffitsiyenti V = s/x̄·100%: V &lt; 33% bo‘lsa, to‘plam bir jinsli hisoblanadi.</p>`;
  }

  /* ---------- Modellarni solishtirish ---------- */
  function renderModels(M) {
    const C = M.compare;
    const rows = C.rows
      .map((r) =>
        r.applicable
          ? `<tr class="${r.type === M.type ? 'cur' : ''}"><td>${escapeHtml(r.label)}${r.type === C.best ? ' <span class="pill pill--good">eng yaxshi</span>' : ''}</td><td class="eqc">${escapeHtml(r.equation)}</td><td>${fmt(r.r2, 4)}</td><td>${fmt(r.adjR2, 4)}</td><td>${r.mape === null ? '—' : `${fmt(r.mape, 3)}%`}</td><td>${fmt(r.rmse, 4)}</td><td>${fmt(r.f, 4)} <span class="sig">${stars(r.fp)}</span></td><td><button class="btn btn--tiny btn--ghost" data-use="${r.type}" ${r.type === M.type ? 'disabled' : ''}>Tanlash</button></td></tr>`
          : `<tr class="na"><td>${escapeHtml(r.label)}</td><td colspan="7" class="muted">${escapeHtml(r.reason)}</td></tr>`,
      )
      .join('');
    panes.models.innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Model turi</th><th>Tenglama</th><th>R² (indeks)${helpBtn('index')}</th><th>R̄²</th><th>Ā (MAPE)</th><th>RMSE</th><th>F</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="note">Barcha ko‘rsatkichlar asl birliklarda hisoblangan, shuning uchun model turlarini to‘g‘ridan-to‘g‘ri solishtirish mumkin. “Eng yaxshi” — tuzatilgan determinatsiya indeksi eng katta model. Yakuniy tanlovda iqtisodiy/fizik mazmun va qoldiqlar grafigini ham hisobga oling. ${helpBtn('linearize')}</p>`;
    panes.models.querySelectorAll('[data-use]').forEach((b) =>
      b.addEventListener('click', () => {
        state.modelType = b.dataset.use;
        renderTypeSelect();
        fit({ scroll: false });
        root.querySelector('#result-tabs [data-tab="models"]').click();
        toast(`${MODEL_TYPES[state.modelType].label} model tanlandi`);
      }),
    );
  }

  /* ---------- Bashorat ---------- */
  function renderPredict(M) {
    const sameVars = state.predictAt && state.predictAt[0]?.length === M.k && state.features.every((f, j) => f === M.featureNames[j]);
    const defaults = sameVars
      ? state.predictAt[0]
      : M.featureNames.map((_, j) => {
          const col = M.X.map((r) => r[j]);
          return Number((col.reduce((s, v) => s + v, 0) / col.length).toPrecision(5));
        });
    els.predictForm.innerHTML =
      M.featureNames.map((f, j) => `<label class="field"><span>${escapeHtml(f)}${state.units[f] ? ` <span class="muted">(${escapeHtml(state.units[f])})</span>` : ''}</span><input type="number" step="any" required name="x${j}" value="${defaults[j]}" /></label>`).join('') +
      '<button class="btn btn--small btn--glow" type="submit">Hisoblash</button>';
    els.predictForm.onsubmit = (e) => {
      e.preventDefault();
      doPredict(M);
    };
    doPredict(M);
    // Ko‘p nuqtali prognoz
    els.forecast.placeholder = M.k === 1 ? 'masalan: 2025; 2030 yoki 40, 50, 60' : M.featureNames.map((f) => f).join('; ') + ' — har qatorga bitta nuqta';
    els.forecast.value = sameVars && state.predictAt.length > 1 ? state.predictAt.map((r) => r.join('; ')).join('\n') : M.k === 1 && state.predictAt ? state.predictAt.map((r) => r[0]).join('; ') : '';
    els.forecastOut.innerHTML = '';
    els.forecastBtn.onclick = () => doForecast(M);
    if (els.forecast.value) doForecast(M);
  }

  function doPredict(M) {
    const vals = M.featureNames.map((_, j) => parseNumber(els.predictForm.elements[`x${j}`].value));
    if (vals.some((v) => !Number.isFinite(v))) {
      els.predictOut.innerHTML = '<p class="error">Barcha qiymatlarni son ko‘rinishida kiriting</p>';
      return;
    }
    let p;
    try {
      p = M.predict(vals);
    } catch (e) {
      els.predictOut.innerHTML = `<p class="error">${escapeHtml(e.message)}</p>`;
      return;
    }
    const conf = Math.round((1 - M.alpha) * 100);
    const lo = p.prediction[0];
    const hi = p.prediction[1];
    const pad = (hi - lo) * 0.15;
    const pos = (v) => ((v - (lo - pad)) / (hi - lo + 2 * pad)) * 100;
    const u = state.units[M.targetName] ? ` ${escapeHtml(state.units[M.targetName])}` : '';
    els.predictOut.innerHTML = `
      <div class="muted small">Bashorat qilingan ${escapeHtml(M.targetName)}${u ? ` (${u.trim()})` : ''}</div>
      <div class="big gradient-text">${fmt(p.yhat, 6)}</div>
      <div class="range-bar" aria-hidden="true">
        <span class="pi" style="left:${pos(lo)}%;width:${pos(hi) - pos(lo)}%"></span>
        <span class="ci" style="left:${pos(p.confidence[0])}%;width:${pos(p.confidence[1]) - pos(p.confidence[0])}%"></span>
        <span class="pt" style="left:${pos(p.yhat)}%"></span>
      </div>
      <div class="ranges">
        <div><b style="color:var(--c1)">■</b> O‘rtacha qiymat uchun ${conf}% ishonch oralig‘i: <b>[${fmt(p.confidence[0], 5)}; ${fmt(p.confidence[1], 5)}]</b></div>
        <div><b style="color:var(--c3)">■</b> Individual qiymat uchun ${conf}% bashorat oralig‘i: <b>[${fmt(p.prediction[0], 5)}; ${fmt(p.prediction[1], 5)}]</b></div>
        <div class="muted">${p.logScale ? 'Logarifmik modelda ŷ = exp(ln ŷ) — natijaning medianasi bahosi; oraliqlar ln-shkaladan qaytarilgan (asimmetrik).' : `SE(ŷ) = ${fmt(p.seMean, 4)} · SE(y₀) = ${fmt(p.seObs, 4)}`}</div>
        ${p.extrapolation ? '<div style="color:var(--warn)">⚠ Nuqta kuzatilgan qiymatlar diapazonidan tashqarida (ekstrapolyatsiya) — bashorat ishonchliligi past.</div>' : ''}
      </div>`;
    gsap.from(els.predictOut.querySelectorAll('.range-bar span'), { scaleX: 0, transformOrigin: '50% 50%', duration: 0.9, ease: 'power3.out', stagger: 0.1 });
  }

  function doForecast(M) {
    const text = els.forecast.value.trim();
    if (!text) {
      els.forecastOut.innerHTML = '';
      return;
    }
    const points = M.k === 1 ? text.split(/[;\s\n]+/).filter(Boolean).map((v) => [parseNumber(v.replace(/,$/, ''), /\d,\d/.test(v))]) : text.split('\n').filter((l) => l.trim()).map((l) => l.split(/[;\t]+/).map((v) => parseNumber(v.trim(), /\d,\d/.test(v))));
    const rows = [];
    for (const pt of points.slice(0, 200)) {
      if (pt.length !== M.k || pt.some((v) => !Number.isFinite(v))) {
        rows.push(`<tr><td colspan="6" class="muted">Noto‘g‘ri nuqta: ${escapeHtml(pt.join('; '))}</td></tr>`);
        continue;
      }
      try {
        const p = M.predict(pt);
        rows.push(`<tr><td>${pt.map((v) => fmt(v, 6)).join('; ')}</td><td>${fmt(p.yhat, 6)}</td><td>${fmt(p.confidence[0], 5)} … ${fmt(p.confidence[1], 5)}</td><td>${fmt(p.prediction[0], 5)} … ${fmt(p.prediction[1], 5)}</td><td>${p.extrapolation ? '<span class="pill pill--warn">ekstrapolyatsiya</span>' : ''}</td></tr>`);
        rows.raw = rows.raw || [];
        rows.raw.push([...pt, p.yhat, ...p.confidence, ...p.prediction]);
      } catch (e) {
        rows.push(`<tr><td colspan="6" class="muted">${escapeHtml(e.message)}</td></tr>`);
      }
    }
    const conf = Math.round((1 - M.alpha) * 100);
    els.forecastOut.innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>${escapeHtml(M.featureNames.join('; '))}</th><th>ŷ</th><th>${conf}% ishonch oralig‘i</th><th>${conf}% bashorat oralig‘i</th><th></th></tr></thead><tbody>${rows.join('')}</tbody></table></div>
      ${rows.raw ? '<button class="btn btn--tiny btn--ghost" id="forecast-csv" type="button">Prognozni CSV ga yuklash</button>' : ''}`;
    els.forecastOut.querySelector('#forecast-csv')?.addEventListener('click', () => {
      const head = [...M.featureNames, 'y_hat', 'ci_quyi', 'ci_yuqori', 'pi_quyi', 'pi_yuqori'];
      download(`prognoz_${M.targetName}.csv`, `﻿${toCSV(head, rows.raw)}`, 'text/csv');
    });
  }

  function renderInsights(M) {
    els.insights.innerHTML = interpret(M)
      .map((x) => `<li class="insight" data-level="${x.level}"><b>${escapeHtml(x.title)}</b><p>${escapeHtml(x.text)}</p></li>`)
      .join('');
  }

  /* ================= Tablar va eksport ================= */
  root.querySelectorAll('#result-tabs button').forEach((b) =>
    b.addEventListener('click', () => {
      root.querySelectorAll('#result-tabs button').forEach((x) => x.classList.toggle('is-active', x === b));
      Object.entries(panes).forEach(([k, p]) => (p.hidden = k !== b.dataset.tab));
      gsap.from(panes[b.dataset.tab], { opacity: 0, y: 12, duration: 0.4, ease: 'power2.out', clearProps: 'all' });
    }),
  );
  root.querySelectorAll('[data-export]').forEach((b) =>
    b.addEventListener('click', () => {
      const m = state.model;
      if (!m) return;
      const base = `regressiya_${m.targetName}`.replace(/[^\wЀ-ӿ-]+/g, '_');
      if (b.dataset.export === 'csv') download(`${base}_qoldiqlar.csv`, `﻿${residualsCSV(m)}`, 'text/csv');
      if (b.dataset.export === 'json') download(`${base}_model.json`, modelJSON(m), 'application/json');
      if (b.dataset.export === 'report') download(`${base}_hisobot.html`, htmlReport(m, { title: state.title || 'Regressiya tahlili', problem: state.problem, source: state.source }), 'text/html');
      toast('Fayl yuklab olindi');
    }),
  );

  return {
    load,
    fit,
    getModel: () => state.model,
    isApplicable,
  };
}
