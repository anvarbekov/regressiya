/** Sonlarni o‘qilishi qulay ko‘rinishda formatlash */

export function fmt(v, digits = 4) {
  if (v === null || v === undefined) return '—';
  if (Number.isNaN(v)) return '—';
  if (!Number.isFinite(v)) return v > 0 ? '∞' : '−∞';
  if (v === 0) return '0';
  const a = Math.abs(v);
  let s;
  if (a >= 1e6 || a < 1e-4) s = v.toExponential(Math.max(digits - 2, 2));
  else {
    const decimals = Math.max(0, digits - Math.floor(Math.log10(a)) - 1);
    s = v.toFixed(Math.min(decimals, 8));
    if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  }
  return s.replace(/-/g, '−');
}

/** KaTeX uchun son: “1.2e−6” → “1.2\\cdot 10^{-6}”, unikod minus → oddiy minus */
export function texNum(v, digits = 4) {
  const s = fmt(v, digits).replace(/−/g, '-');
  const m = s.match(/^(-?[\d.]+)e([+-]?)(\d+)$/);
  if (!m) return s;
  return `${m[1]}\\cdot 10^{${m[2] === '-' ? '-' : ''}${m[3]}}`;
}

export function fmtP(p) {
  if (p === null || p === undefined || Number.isNaN(p)) return '—';
  if (p < 0.0001) return '< 0.0001';
  return p.toFixed(4);
}

/** “p = 0.0123” yoki “p < 0.0001” */
export function pText(p) {
  const s = fmtP(p);
  return s.startsWith('<') ? `p ${s}` : `p = ${s}`;
}

export function fmtPct(v, d = 1) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${(v * 100).toFixed(d)}%`;
}

/** Ahamiyatlilik yulduzchalari */
export function stars(p) {
  if (p < 0.001) return '***';
  if (p < 0.01) return '**';
  if (p < 0.05) return '*';
  if (p < 0.1) return '·';
  return '';
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** KaTeX uchun xavfsiz o‘zgaruvchi nomi */
export function texName(s) {
  return `\\text{${String(s).replace(/[\\{}$&#^_%~]/g, (c) => `\\${c}`)}}`;
}

/** Regressiya tenglamasi: LaTeX va oddiy matn */
export function equation(model, digits = 4) {
  const terms = [];
  const plain = [];
  model.coefficients.forEach((b, j) => {
    const isIntercept = model.intercept && j === 0;
    const name = isIntercept ? '' : model.featureNames[j - (model.intercept ? 1 : 0)];
    const val = texNum(Math.abs(b), digits);
    const valTxt = fmt(Math.abs(b), digits);
    const sign = b < 0 ? '-' : '+';
    const first = terms.length === 0;
    const signTex = first ? (b < 0 ? '-' : '') : ` ${sign} `;
    terms.push(`${signTex}${val}${isIntercept ? '' : `\\cdot ${texName(name)}`}`);
    plain.push(`${first ? (b < 0 ? '−' : '') : ` ${b < 0 ? '−' : '+'} `}${valTxt}${isIntercept ? '' : `·${name}`}`);
  });
  return {
    tex: `\\widehat{${texName(model.targetName)}} = ${terms.join('')}`,
    text: `ŷ = ${plain.join('')}`,
  };
}
