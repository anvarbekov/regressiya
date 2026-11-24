/**
 * Chiziqli va chiziqlilashtiriladigan (linearizatsiya qilinadigan) regressiya modellari.
 *
 * Parametrlarga nisbatan nochiziqli, lekin o‘zgaruvchilarni almashtirish orqali chiziqli
 * ko‘rinishga keltiriladigan modellar EKKU bilan baholanadi, so‘ngra natijalar asl
 * o‘lchov birliklariga qaytariladi:
 *
 *   chiziqli      y = a + Σ bⱼxⱼ
 *   parabolik     y = a + Σ (bⱼxⱼ + cⱼxⱼ²)
 *   darajali      y = a · Π xⱼ^bⱼ           →  ln y = ln a + Σ bⱼ ln xⱼ
 *   ko‘rsatkichli y = a · exp(Σ bⱼxⱼ)       →  ln y = ln a + Σ bⱼ xⱼ
 *   logarifmik    y = a + Σ bⱼ ln xⱼ
 *   giperbolik    y = a + Σ bⱼ / xⱼ
 */
import { fitOLS, RegressionError } from './regression.js';
import { fmt, texName, texNum } from './format.js';

const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;

export const MODEL_TYPES = {
  linear: {
    label: 'Chiziqli',
    formula: 'y = a + b·x',
    tex: 'y = a + b\\,x',
    logY: false,
    tx: (v) => [v],
    names: (n) => [n],
  },
  quadratic: {
    label: 'Parabolik (2-darajali)',
    formula: 'y = a + b·x + c·x²',
    tex: 'y = a + b\\,x + c\\,x^2',
    logY: false,
    tx: (v) => [v, v * v],
    names: (n) => [n, `${n}²`],
  },
  power: {
    label: 'Darajali',
    formula: 'y = a·xᵇ',
    tex: 'y = a\\,x^{b}',
    logY: true,
    tx: (v) => [Math.log(v)],
    names: (n) => [`ln(${n})`],
    domainX: (v) => v > 0,
  },
  exponential: {
    label: 'Ko‘rsatkichli',
    formula: 'y = a·eᵇˣ',
    tex: 'y = a\\,e^{b x}',
    logY: true,
    tx: (v) => [v],
    names: (n) => [n],
  },
  logarithmic: {
    label: 'Logarifmik',
    formula: 'y = a + b·ln x',
    tex: 'y = a + b\\ln x',
    logY: false,
    tx: (v) => [Math.log(v)],
    names: (n) => [`ln(${n})`],
    domainX: (v) => v > 0,
  },
  hyperbolic: {
    label: 'Giperbolik',
    formula: 'y = a + b/x',
    tex: 'y = a + \\dfrac{b}{x}',
    logY: false,
    tx: (v) => [1 / v],
    names: (n) => [`1/${n}`],
    domainX: (v) => v !== 0,
  },
};

const DOMAIN_MSG = {
  power: 'Darajali model uchun barcha x va y qiymatlari musbat bo‘lishi kerak (logarifm olinadi)',
  exponential: 'Ko‘rsatkichli model uchun barcha y qiymatlari musbat bo‘lishi kerak (ln y olinadi)',
  logarithmic: 'Logarifmik model uchun barcha x qiymatlari musbat bo‘lishi kerak',
  hyperbolic: 'Giperbolik model uchun x qiymatlari orasida nol bo‘lmasligi kerak',
};

/** Model turi berilgan ma’lumotlarga qo‘llanilishi mumkinmi */
export function isApplicable(type, X, y) {
  const t = MODEL_TYPES[type];
  if (!t) return false;
  if (t.domainX && X.some((r) => r.some((v) => !t.domainX(v)))) return false;
  if (t.logY && y.some((v) => !(v > 0))) return false;
  return true;
}

/**
 * Tanlangan turdagi modelni quradi.
 * @returns asl birliklardagi natijalar + `base` (chiziqlilashtirilgan modelning to‘liq OLS natijalari)
 */
export function fitModel(X, y, opts = {}) {
  const type = opts.type ?? 'linear';
  const T = MODEL_TYPES[type];
  if (!T) throw new RegressionError(`Noma’lum model turi: ${type}`, 'BAD_TYPE');
  const featureNames = opts.featureNames ?? X[0].map((_, j) => `x${j + 1}`);
  const targetName = opts.targetName ?? 'y';
  const intercept = opts.intercept ?? true;
  if (type !== 'linear' && !intercept) {
    throw new RegressionError('Ozod hadsiz variant faqat chiziqli model uchun mavjud', 'NO_INTERCEPT_NONLINEAR');
  }
  if (!isApplicable(type, X, y)) throw new RegressionError(DOMAIN_MSG[type], 'DOMAIN');

  const Xt = X.map((r) => r.flatMap((v) => T.tx(v)));
  const yt = T.logY ? y.map(Math.log) : [...y];
  const tNames = featureNames.flatMap((n) => T.names(n));
  const tTarget = T.logY ? `ln(${targetName})` : targetName;
  const base = fitOLS(Xt, yt, { intercept, alpha: opts.alpha, featureNames: tNames, targetName: tTarget });
  base.labels = opts.labels ?? null;

  const inv = T.logY ? Math.exp : (v) => v;
  const fitted = base.fitted.map(inv);
  const residuals = y.map((v, i) => v - fitted[i]);
  const n = y.length;
  const k = featureNames.length;
  const yMean = mean(y);
  const SSE = residuals.reduce((s, e) => s + e * e, 0);
  const SST = intercept ? y.reduce((s, v) => s + (v - yMean) ** 2, 0) : y.reduce((s, v) => s + v * v, 0);
  // Determinatsiya indeksi (asl birliklarda) — nochiziqli modellarni solishtirish uchun
  const r2 = T.logY ? 1 - SSE / SST : base.metrics.r2;
  const p = base.p;
  const adjR2 = 1 - ((n - (intercept ? 1 : 0)) / (n - p)) * (1 - r2);
  const fIndex = T.logY && p > 1 ? (r2 / (1 - r2)) * ((n - p) / (p - 1)) : base.metrics.fStat;
  const metrics = {
    r2,
    adjR2,
    correlationIndex: Math.sqrt(Math.max(r2, 0)),
    rmse: Math.sqrt(SSE / n),
    mae: residuals.reduce((s, e) => s + Math.abs(e), 0) / n,
    mape: y.every((v) => v !== 0) ? (100 / n) * residuals.reduce((s, e, i) => s + Math.abs(e / y[i]), 0) : null,
    sigma: Math.sqrt(SSE / (n - p)),
    fIndex,
  };

  // Koeffitsiyentlar (asl ko‘rinishda)
  const b = base.coefficients;
  const a = intercept ? (T.logY ? Math.exp(b[0]) : b[0]) : 0;
  const off = intercept ? 1 : 0;
  const perFeature = type === 'quadratic' ? 2 : 1;
  const coefOf = (j, m = 0) => b[off + j * perFeature + m];

  // Elastiklik (o‘rtacha nuqtada)
  const xMeans = featureNames.map((_, j) => mean(X.map((r) => r[j])));
  const elasticity = featureNames.map((_, j) => {
    const xb = xMeans[j];
    switch (type) {
      case 'linear':
        return yMean !== 0 ? (coefOf(j) * xb) / yMean : null;
      case 'quadratic':
        return yMean !== 0 ? ((coefOf(j, 0) + 2 * coefOf(j, 1) * xb) * xb) / yMean : null;
      case 'power':
        return coefOf(j);
      case 'exponential':
        return coefOf(j) * xb;
      case 'logarithmic':
        return yMean !== 0 ? coefOf(j) / yMean : null;
      case 'hyperbolic':
        return yMean !== 0 && xb !== 0 ? -coefOf(j) / (xb * yMean) : null;
      default:
        return null;
    }
  });

  // Parabolada ekstremum nuqtasi x* = −b/(2c)
  const extrema =
    type === 'quadratic'
      ? featureNames.map((_, j) => {
          const c = coefOf(j, 1);
          const xs = -coefOf(j, 0) / (2 * c);
          return { x: xs, kind: c > 0 ? 'minimum' : 'maksimum' };
        })
      : null;

  const ranges = featureNames.map((_, j) => {
    const col = X.map((r) => r[j]);
    return [Math.min(...col), Math.max(...col)];
  });

  const model = {
    type,
    typeLabel: T.label,
    base,
    n,
    k,
    intercept,
    alpha: base.alpha,
    featureNames,
    targetName,
    labels: opts.labels ?? null,
    units: opts.units ?? null,
    X: X.map((r) => [...r]),
    y: [...y],
    fitted,
    residuals,
    metrics,
    a,
    elasticity,
    extrema,
    ranges,
    growthRate: type === 'exponential' && k === 1 ? Math.exp(coefOf(0)) - 1 : null,
  };
  model.predict = (xRow) => predictModel(model, xRow);
  model.equation = (digits = 4) => modelEquation(model, digits);
  return model;
}

/** Asl birliklarda bashorat: ŷ, ishonch va bashorat oraliqlari */
export function predictModel(model, xRow) {
  const T = MODEL_TYPES[model.type];
  if (!Array.isArray(xRow) || xRow.length !== model.k) throw new RegressionError(`Bashorat uchun ${model.k} ta omil qiymati kerak`, 'PREDICT_DIM');
  if (xRow.some((v) => !Number.isFinite(v))) throw new RegressionError('Bashorat qiymatlari son bo‘lishi kerak', 'NOT_FINITE');
  if (T.domainX && xRow.some((v) => !T.domainX(v))) throw new RegressionError(DOMAIN_MSG[model.type], 'DOMAIN');
  const p = model.base.predict(xRow.flatMap((v) => T.tx(v)));
  const inv = T.logY ? Math.exp : (v) => v;
  return {
    ...p,
    yhat: inv(p.yhat),
    confidence: p.confidence.map(inv),
    prediction: p.prediction.map(inv),
    linearized: p,
    extrapolation: xRow.some((v, j) => v < model.ranges[j][0] || v > model.ranges[j][1]),
    logScale: T.logY,
  };
}

/** Tenglamani asl ko‘rinishda yozish (LaTeX va oddiy matn) */
export function modelEquation(model, digits = 4) {
  const T = MODEL_TYPES[model.type];
  const b = model.base.coefficients;
  const off = model.intercept ? 1 : 0;
  const names = model.featureNames;
  const num = (v) => texNum(v, digits);
  const absn = (v) => texNum(Math.abs(v), digits);
  const absTxt = (v) => fmt(Math.abs(v), digits);
  const yhat = `\\widehat{${texName(model.targetName)}}`;
  const signed = (v, first) => (first ? (v < 0 ? '-' : '') : v < 0 ? ' - ' : ' + ');
  const signedTxt = (v, first) => (first ? (v < 0 ? '−' : '') : v < 0 ? ' − ' : ' + ');

  if (model.type === 'power' || model.type === 'exponential') {
    const a = model.a;
    if (model.type === 'power') {
      const parts = names.map((n, j) => `${texName(n)}^{${num(b[off + j])}}`);
      const txt = names.map((n, j) => `${n}^${fmt(b[off + j], digits)}`);
      return { tex: `${yhat} = ${num(a)}\\cdot ${parts.join('\\cdot ')}`, text: `ŷ = ${fmt(a, digits)}·${txt.join('·')}` };
    }
    const exps = names.map((n, j) => `${signed(b[off + j], j === 0)}${absn(b[off + j])}\\,${texName(n)}`).join('');
    const expt = names.map((n, j) => `${signedTxt(b[off + j], j === 0)}${absTxt(b[off + j])}·${n}`).join('');
    return { tex: `${yhat} = ${num(a)}\\cdot e^{${exps}}`, text: `ŷ = ${fmt(a, digits)}·exp(${expt})` };
  }
  const terms = [];
  const texts = [];
  if (model.intercept) {
    terms.push(num(b[0]));
    texts.push(fmt(b[0], digits));
  }
  const term = (coef, tex, txt) => {
    const first = terms.length === 0;
    terms.push(`${signed(coef, first)}${absn(coef)}\\cdot ${tex}`);
    texts.push(`${signedTxt(coef, first)}${absTxt(coef)}·${txt}`);
  };
  names.forEach((n, j) => {
    const tn = texName(n);
    if (model.type === 'linear') term(b[off + j], tn, n);
    else if (model.type === 'quadratic') {
      term(b[off + 2 * j], tn, n);
      term(b[off + 2 * j + 1], `${tn}^2`, `${n}²`);
    } else if (model.type === 'logarithmic') term(b[off + j], `\\ln ${tn}`, `ln(${n})`);
    else if (model.type === 'hyperbolic') term(b[off + j], `\\dfrac{1}{${tn}}`, `(1/${n})`);
  });
  // Ishoralarni tozalash: birinchi had “+” bilan boshlanmasin
  const tex = terms.join('').replace(/^\s*\+\s*/, '');
  const text = texts.join('').replace(/^\s*\+\s*/, '');
  return { tex: `${yhat} = ${tex}`, text: `ŷ = ${text}` };
}

/**
 * Barcha qo‘llanilishi mumkin bo‘lgan model turlarini quradi va solishtiradi.
 * Saralash tuzatilgan determinatsiya indeksi bo‘yicha (asl birliklarda).
 */
export function compareModels(X, y, opts = {}) {
  const rows = [];
  for (const type of Object.keys(MODEL_TYPES)) {
    if (!isApplicable(type, X, y)) {
      rows.push({ type, label: MODEL_TYPES[type].label, applicable: false, reason: DOMAIN_MSG[type] });
      continue;
    }
    try {
      const m = fitModel(X, y, { ...opts, type, intercept: true });
      rows.push({
        type,
        label: m.typeLabel,
        applicable: true,
        r2: m.metrics.r2,
        adjR2: m.metrics.adjR2,
        mape: m.metrics.mape,
        rmse: m.metrics.rmse,
        f: m.base.metrics.fStat,
        fp: m.base.metrics.fPValue,
        params: m.base.p,
        equation: m.equation(4).text,
      });
    } catch (e) {
      rows.push({ type, label: MODEL_TYPES[type].label, applicable: false, reason: e.message });
    }
  }
  const ok = rows.filter((r) => r.applicable && Number.isFinite(r.adjR2));
  const best = ok.length ? ok.reduce((a, b2) => (b2.adjR2 > a.adjR2 ? b2 : a)).type : null;
  return { rows, best };
}
