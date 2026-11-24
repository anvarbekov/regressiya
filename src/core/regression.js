/**
 * Eng kichik kvadratlar usuli (OLS) bo‘yicha chiziqli regressiya.
 * Natijalar statsmodels (Python) bilan mos keladi — tests/ katalogiga qarang.
 */
import { qrDecompose, backSubstitute, invertUpperTriangular, symmetricEigenvalues, transpose, matMul } from './matrix.js';
import { studentTTwoSidedP, studentTInv, fisherFSurvival, fisherFInv, chiSquareSurvival } from './distributions.js';

export class RegressionError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'RegressionError';
    this.code = code;
    this.details = details;
  }
}

const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
function sampleSd(a) {
  const m = mean(a);
  let s = 0;
  for (const v of a) s += (v - m) ** 2;
  return Math.sqrt(s / (a.length - 1));
}

function validate(X, y) {
  if (!Array.isArray(X) || !Array.isArray(y)) throw new RegressionError('Ma’lumotlar massiv ko‘rinishida bo‘lishi kerak', 'INVALID_INPUT');
  if (X.length !== y.length) throw new RegressionError('X va y uzunliklari teng emas', 'LENGTH_MISMATCH');
  if (X.length === 0) throw new RegressionError('Ma’lumotlar bo‘sh', 'EMPTY');
  const k = X[0].length;
  for (let i = 0; i < X.length; i++) {
    if (X[i].length !== k) throw new RegressionError(`${i + 1}-qatordagi omillar soni noto‘g‘ri`, 'RAGGED');
    for (const v of X[i]) if (!Number.isFinite(v)) throw new RegressionError(`${i + 1}-qatorda son bo‘lmagan qiymat bor`, 'NOT_FINITE');
    if (!Number.isFinite(y[i])) throw new RegressionError(`${i + 1}-qatorda y qiymati son emas`, 'NOT_FINITE');
  }
  return k;
}

/**
 * @param {number[][]} X  n×k omillar matritsasi (ozod hadsiz)
 * @param {number[]} y    natijaviy belgi
 * @param {object} [opts]
 * @param {boolean} [opts.intercept=true]
 * @param {number} [opts.alpha=0.05]  ishonchlilik darajasi: 1−α
 * @param {string[]} [opts.featureNames]
 * @param {string} [opts.targetName]
 */
export function fitOLS(X, y, opts = {}) {
  const { intercept = true, alpha = 0.05 } = opts;
  if (!(alpha > 0 && alpha < 1)) throw new RegressionError('α (0;1) oralig‘ida bo‘lishi kerak', 'INVALID_ALPHA');
  const k = validate(X, y);
  const n = y.length;
  const featureNames = opts.featureNames ?? Array.from({ length: k }, (_, j) => `x${j + 1}`);
  const targetName = opts.targetName ?? 'y';
  const p = k + (intercept ? 1 : 0);
  if (p === 0) throw new RegressionError('Kamida bitta parametr bo‘lishi kerak', 'NO_PARAMS');
  if (n <= p) {
    throw new RegressionError(
      `Kuzatuvlar soni (${n}) parametrlar sonidan (${p}) ko‘p bo‘lishi kerak`,
      'TOO_FEW_OBSERVATIONS',
      { n, p },
    );
  }

  const design = X.map((row) => (intercept ? [1, ...row] : [...row]));
  const paramNames = intercept ? ['(ozod had)', ...featureNames] : [...featureNames];

  const { Q, R } = qrDecompose(design);
  // Rangni tekshirish (multikollinearlik)
  const diag = R.map((r, i) => Math.abs(r[i]));
  const maxDiag = Math.max(...diag);
  const tol = maxDiag * Math.max(n, p) * 1e-12;
  const deficient = diag.findIndex((d) => d <= tol);
  if (deficient !== -1) {
    throw new RegressionError(
      `“${paramNames[deficient]}” boshqa omillarning chiziqli kombinatsiyasi (to‘liq multikollinearlik yoki o‘zgarmas ustun). Uni modeldan chiqaring.`,
      'RANK_DEFICIENT',
      { column: paramNames[deficient] },
    );
  }

  const Qty = new Float64Array(p);
  for (let j = 0; j < p; j++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += Q[i][j] * y[i];
    Qty[j] = s;
  }
  const beta = Array.from(backSubstitute(R, Qty));

  const fitted = design.map((row) => row.reduce((s, v, j) => s + v * beta[j], 0));
  const residuals = y.map((v, i) => v - fitted[i]);
  const yMean = mean(y);
  const SSE = residuals.reduce((s, e) => s + e * e, 0);
  const SST = intercept ? y.reduce((s, v) => s + (v - yMean) ** 2, 0) : y.reduce((s, v) => s + v * v, 0);
  if (SST === 0) throw new RegressionError('Natijaviy belgi (y) barcha kuzatuvlarda bir xil — regressiya ma’nosiz', 'CONSTANT_TARGET');
  const SSR = SST - SSE;
  const dfResid = n - p;
  const dfModel = p - (intercept ? 1 : 0);
  const MSE = SSE / dfResid;
  const sigma = Math.sqrt(MSE);
  const r2 = 1 - SSE / SST;
  const adjR2 = 1 - ((n - (intercept ? 1 : 0)) / dfResid) * (1 - r2);

  // Kovariatsiya: σ²(XᵀX)⁻¹ = σ² R⁻¹R⁻ᵀ
  const Rinv = invertUpperTriangular(R);
  const XtXinv = matMul(Rinv, transpose(Rinv));
  const se = beta.map((_, j) => Math.sqrt(MSE * XtXinv[j][j]));
  const tStats = beta.map((b, j) => b / se[j]);
  const pValues = tStats.map((t) => studentTTwoSidedP(t, dfResid));
  const tCrit = studentTInv(1 - alpha / 2, dfResid);
  const ci = beta.map((b, j) => [b - tCrit * se[j], b + tCrit * se[j]]);

  let fStat = null;
  let fPValue = null;
  if (dfModel > 0) {
    fStat = SSR / dfModel / MSE;
    fPValue = fisherFSurvival(fStat, dfModel, dfResid);
  }
  const fCritical = dfModel > 0 ? fisherFInv(1 - alpha, dfModel, dfResid) : null;

  const logLik = (-n / 2) * (Math.log(2 * Math.PI) + Math.log(SSE / n) + 1);
  const aic = -2 * logLik + 2 * p;
  const bic = -2 * logLik + p * Math.log(n);

  // Xatolik metrikalari
  const mae = residuals.reduce((s, e) => s + Math.abs(e), 0) / n;
  const rmse = Math.sqrt(SSE / n);
  const mape = y.every((v) => v !== 0) ? (100 / n) * residuals.reduce((s, e, i) => s + Math.abs(e / y[i]), 0) : null;

  // Diagnostika
  const leverage = Q.map((row) => row.reduce((s, v) => s + v * v, 0));
  const studentized = residuals.map((e, i) => e / (sigma * Math.sqrt(Math.max(1 - leverage[i], 1e-300))));
  const externallyStudentized = studentized.map((r) => {
    const denom = dfResid - r * r;
    return dfResid > 1 && denom > 0 ? r * Math.sqrt((dfResid - 1) / denom) : NaN;
  });
  const cooksD = studentized.map((r, i) => (r * r * leverage[i]) / (p * (1 - leverage[i])));

  let dwNum = 0;
  for (let i = 1; i < n; i++) dwNum += (residuals[i] - residuals[i - 1]) ** 2;
  const durbinWatson = dwNum / SSE;

  const eMean = mean(residuals);
  let m3 = 0;
  let m4 = 0;
  for (const e of residuals) {
    const d = e - eMean;
    m3 += d ** 3;
    m4 += d ** 4;
  }
  m3 /= n;
  m4 /= n;
  const m2c = residuals.reduce((s, e) => s + (e - eMean) ** 2, 0) / n;
  const skew = m3 / m2c ** 1.5;
  const kurtosis = m4 / m2c ** 2;
  const jb = (n / 6) * (skew ** 2 + (kurtosis - 3) ** 2 / 4);
  const jarqueBera = { statistic: jb, pValue: chiSquareSurvival(jb, 2), skew, kurtosis };

  // Breusch–Pagan (Koenker, robust): e² ni X ga regressiya qilib, LM = n·R²
  let breuschPagan = null;
  if (intercept && k > 0) {
    const e2 = residuals.map((e) => e * e);
    try {
      const aux = auxiliaryR2(design, e2, Q);
      const lm = n * aux;
      breuschPagan = { statistic: lm, df: k, pValue: chiSquareSurvival(lm, k) };
    } catch {
      breuschPagan = null;
    }
  }

  // Shartlilik soni (statsmodels uslubida): √(λmax/λmin), XᵀX xos qiymatlari
  const XtX = matMul(transpose(design), design);
  const eig = symmetricEigenvalues(XtX);
  const conditionNumber = Math.sqrt(eig[0] / eig[eig.length - 1]);

  // VIF (k ≥ 2 bo‘lganda): VIFⱼ = [R⁻¹]ⱼⱼ, R — omillarning korrelyatsiya matritsasi.
  // Bu 1/(1 − Rⱼ²) ga aynan teng, lekin k ta yordamchi regressiya o‘rniga bitta k×k teskari matritsa talab qiladi.
  let vif = null;
  if (k >= 2) {
    const cols = featureNames.map((_, j) => X.map((r) => r[j]));
    const C = correlationMatrix(cols);
    const inv = invertSymmetric(C);
    vif = featureNames.map((_, j) => (inv && inv[j][j] > 0 && Number.isFinite(inv[j][j]) ? Math.max(1, inv[j][j]) : Infinity));
  }

  // Standartlashgan (β) koeffitsiyentlar
  const sdY = sampleSd(y);
  const standardized = featureNames.map((_, j) => {
    const b = beta[j + (intercept ? 1 : 0)];
    return (b * sampleSd(X.map((r) => r[j]))) / sdY;
  });

  // Elastiklik koeffitsiyentlari (o‘rtacha nuqtada): E_j = b_j · x̄_j / ȳ
  const elasticity = featureNames.map((_, j) => {
    const b = beta[j + (intercept ? 1 : 0)];
    return yMean !== 0 ? (b * mean(X.map((r) => r[j]))) / yMean : null;
  });

  // Geteroskedastiklikka bardoshli kovariatsiya (MacKinnon–White HC3):
  // V = (XᵀX)⁻¹ · Σ xᵢxᵢᵀ · eᵢ²/(1 − hᵢᵢ)² · (XᵀX)⁻¹
  const meat = Array.from({ length: p }, () => new Float64Array(p));
  for (let i = 0; i < n; i++) {
    const w = residuals[i] ** 2 / Math.max(1 - leverage[i], 1e-12) ** 2;
    const xi = design[i];
    for (let a = 0; a < p; a++) {
      const wa = w * xi[a];
      for (let b = a; b < p; b++) meat[a][b] += wa * xi[b];
    }
  }
  for (let a = 0; a < p; a++) for (let b = 0; b < a; b++) meat[a][b] = meat[b][a];
  const hc3Cov = matMul(matMul(XtXinv, meat), XtXinv);
  const hc3Se = beta.map((_, j) => Math.sqrt(Math.max(hc3Cov[j][j], 0)));
  const robust = {
    type: 'HC3',
    standardErrors: hc3Se,
    tStats: beta.map((b, j) => b / hc3Se[j]),
    pValues: beta.map((b, j) => studentTTwoSidedP(b / hc3Se[j], dfResid)),
    confidenceIntervals: beta.map((b, j) => [b - tCrit * hc3Se[j], b + tCrit * hc3Se[j]]),
  };

  const model = {
    n,
    k,
    p,
    intercept,
    alpha,
    featureNames,
    targetName,
    paramNames,
    coefficients: beta,
    standardErrors: se,
    tStats,
    pValues,
    confidenceIntervals: ci,
    tCritical: tCrit,
    fCritical,
    robust,
    standardized,
    elasticity,
    fitted,
    residuals,
    y: [...y],
    X: X.map((r) => [...r]),
    anova: {
      regression: { ss: SSR, df: dfModel, ms: dfModel > 0 ? SSR / dfModel : null },
      residual: { ss: SSE, df: dfResid, ms: MSE },
      total: { ss: SST, df: n - (intercept ? 1 : 0) },
      f: fStat,
      pValue: fPValue,
    },
    metrics: {
      r2,
      adjR2,
      r: k === 1 && intercept ? Math.sign(beta[1]) * Math.sqrt(Math.max(r2, 0)) : Math.sqrt(Math.max(r2, 0)),
      sigma,
      mse: MSE,
      rmse,
      mae,
      mape,
      logLik,
      aic,
      bic,
      fStat,
      fPValue,
      fCritical,
    },
    diagnostics: {
      leverage,
      studentized,
      externallyStudentized,
      cooksD,
      durbinWatson,
      jarqueBera,
      breuschPagan,
      conditionNumber,
      vif,
    },
    covariance: XtXinv.map((r) => Array.from(r, (v) => v * MSE)),
    XtXinv: XtXinv.map((r) => Array.from(r)),
  };

  model.predict = (xRow) => predictWithIntervals(model, xRow);
  return model;
}

/** Berilgan Q (ortonormal bazis) bo‘yicha y ning proyeksiyasidan R² (markazlashgan) */
function auxiliaryR2(design, y, Q) {
  const n = y.length;
  const p = Q[0].length;
  const proj = new Float64Array(n);
  for (let j = 0; j < p; j++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += Q[i][j] * y[i];
    for (let i = 0; i < n; i++) proj[i] += Q[i][j] * s;
  }
  const m = mean(y);
  let sse = 0;
  let sst = 0;
  for (let i = 0; i < n; i++) {
    sse += (y[i] - proj[i]) ** 2;
    sst += (y[i] - m) ** 2;
  }
  if (sst === 0) return 0;
  return 1 - sse / sst;
}

/**
 * Simmetrik musbat aniqlangan matritsaning teskarisi (Xoletskiy yoyilmasi orqali).
 * Matritsa xos (singular) bo‘lsa null qaytaradi.
 */
export function invertSymmetric(A) {
  const n = A.length;
  const L = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = A[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      if (i === j) {
        if (!(s > 1e-13 * Math.abs(A[i][i]))) return null;
        L[i][i] = Math.sqrt(s);
      } else L[i][j] = s / L[j][j];
    }
  }
  // L⁻¹ ni hisoblab, A⁻¹ = L⁻ᵀL⁻¹
  const Li = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i++) {
    Li[i][i] = 1 / L[i][i];
    for (let j = 0; j < i; j++) {
      let s = 0;
      for (let k = j; k < i; k++) s -= L[i][k] * Li[k][j];
      Li[i][j] = s / L[i][i];
    }
  }
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      let s = 0;
      for (let k = Math.max(i, j); k < n; k++) s += Li[k][i] * Li[k][j];
      return s;
    }),
  );
}

/**
 * Yangi nuqta uchun bashorat: ŷ, o‘rtacha qiymat uchun ishonch oralig‘i (CI)
 * va individual qiymat uchun bashorat oralig‘i (PI).
 */
export function predictWithIntervals(model, xRow, alpha = model.alpha) {
  if (!Array.isArray(xRow) || xRow.length !== model.k) {
    throw new RegressionError(`Bashorat uchun ${model.k} ta omil qiymati kerak`, 'PREDICT_DIM');
  }
  if (xRow.some((v) => !Number.isFinite(v))) throw new RegressionError('Bashorat qiymatlari son bo‘lishi kerak', 'NOT_FINITE');
  const x0 = model.intercept ? [1, ...xRow] : [...xRow];
  const yhat = x0.reduce((s, v, j) => s + v * model.coefficients[j], 0);
  let q = 0;
  for (let i = 0; i < x0.length; i++) for (let j = 0; j < x0.length; j++) q += x0[i] * model.XtXinv[i][j] * x0[j];
  const mse = model.metrics.mse;
  const seMean = Math.sqrt(mse * q);
  const seObs = Math.sqrt(mse * (1 + q));
  const t = alpha === model.alpha ? model.tCritical : studentTInv(1 - alpha / 2, model.anova.residual.df);
  // Ekstrapolyatsiya ogohlantirishi: nuqta o‘rgatish diapazonidan tashqarida
  const outside = xRow.some((v, j) => {
    const col = model.X.map((r) => r[j]);
    return v < Math.min(...col) || v > Math.max(...col);
  });
  return {
    yhat,
    seMean,
    seObs,
    confidence: [yhat - t * seMean, yhat + t * seMean],
    prediction: [yhat - t * seObs, yhat + t * seObs],
    leverage: q,
    extrapolation: outside,
  };
}

/**
 * Juft regressiya uchun qo‘lda hisoblash qadamlari (o‘quv maqsadida).
 */
export function simpleRegressionSteps(x, y) {
  const n = x.length;
  if (n < 3) throw new RegressionError('Kamida 3 ta kuzatuv kerak', 'TOO_FEW_OBSERVATIONS');
  const sx = x.reduce((s, v) => s + v, 0);
  const sy = y.reduce((s, v) => s + v, 0);
  const sxy = x.reduce((s, v, i) => s + v * y[i], 0);
  const sxx = x.reduce((s, v) => s + v * v, 0);
  const syy = y.reduce((s, v) => s + v * v, 0);
  const mx = sx / n;
  const my = sy / n;
  const Sxx = x.reduce((s, v) => s + (v - mx) ** 2, 0);
  const Syy = y.reduce((s, v) => s + (v - my) ** 2, 0);
  const Sxy = x.reduce((s, v, i) => s + (v - mx) * (y[i] - my), 0);
  if (Sxx === 0) throw new RegressionError('x ning barcha qiymatlari bir xil', 'CONSTANT_FEATURE');
  const b1 = Sxy / Sxx;
  const b0 = my - b1 * mx;
  const r = Syy === 0 ? 0 : Sxy / Math.sqrt(Sxx * Syy);
  const rows = x.map((xi, i) => ({
    i: i + 1,
    x: xi,
    y: y[i],
    xy: xi * y[i],
    x2: xi * xi,
    yhat: b0 + b1 * xi,
    e: y[i] - (b0 + b1 * xi),
  }));
  return { n, sx, sy, sxy, sxx, syy, mx, my, Sxx, Syy, Sxy, b1, b0, r, r2: r * r, rows };
}

/** Pearson korrelyatsiya matritsasi */
export function correlationMatrix(columns) {
  const k = columns.length;
  const means = columns.map(mean);
  const M = Array.from({ length: k }, () => new Array(k).fill(0));
  for (let a = 0; a < k; a++) {
    for (let b = a; b < k; b++) {
      let sab = 0;
      let saa = 0;
      let sbb = 0;
      for (let i = 0; i < columns[a].length; i++) {
        const da = columns[a][i] - means[a];
        const db = columns[b][i] - means[b];
        sab += da * db;
        saa += da * da;
        sbb += db * db;
      }
      const r = saa === 0 || sbb === 0 ? NaN : sab / Math.sqrt(saa * sbb);
      M[a][b] = r;
      M[b][a] = r;
    }
  }
  return M;
}

/**
 * Xususiy korrelyatsiya koeffitsiyentlari: r(i,j | qolganlari) = −Pᵢⱼ / √(PᵢᵢPⱼⱼ),
 * bu yerda P — korrelyatsiya matritsasining teskarisi. Matritsa xos bo‘lsa null.
 */
export function partialCorrelations(columns) {
  const C = correlationMatrix(columns);
  const P = invertSymmetric(C);
  if (!P) return null;
  return P.map((row, i) => row.map((v, j) => (i === j ? 1 : -v / Math.sqrt(P[i][i] * P[j][j]))));
}

/** Korrelyatsiya koeffitsiyentining ahamiyatliligi: t = r·√(n − m)/√(1 − r²), m — baholangan parametrlar */
export function correlationTest(r, n, m = 2) {
  const df = n - m;
  if (df <= 0 || !Number.isFinite(r)) return { t: NaN, p: NaN, df };
  if (Math.abs(r) >= 1) return { t: Math.sign(r) * Infinity, p: 0, df };
  const t = (r * Math.sqrt(df)) / Math.sqrt(1 - r * r);
  return { t, p: studentTTwoSidedP(t, df), df };
}

/** Tavsifiy statistika (tanlama dispersiyasi n − 1 ga bo‘linadi) */
export function describe(values) {
  const v = values.filter(Number.isFinite);
  const n = v.length;
  if (n === 0) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = mean(v);
  let m2 = 0;
  let m3 = 0;
  for (const x of v) {
    m2 += (x - m) ** 2;
    m3 += (x - m) ** 3;
  }
  const sd = n > 1 ? Math.sqrt(m2 / (n - 1)) : 0;
  const pm2 = m2 / n;
  const q = (p) => {
    const h = (n - 1) * p;
    const lo = Math.floor(h);
    return s[lo] + (s[Math.min(lo + 1, n - 1)] - s[lo]) * (h - lo);
  };
  return {
    n,
    mean: m,
    sd,
    min: s[0],
    q1: q(0.25),
    median: q(0.5),
    q3: q(0.75),
    max: s[n - 1],
    cv: m !== 0 ? (100 * sd) / Math.abs(m) : null,
    skew: pm2 > 0 ? m3 / n / pm2 ** 1.5 : 0,
  };
}
