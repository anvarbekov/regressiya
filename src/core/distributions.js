/**
 * Statistik taqsimotlar: Student t, Fisher F, χ², normal.
 * Barcha funksiyalar sof (pure) va yuqori aniqlikda (≈1e-12) hisoblaydi.
 */

const EPS = 1e-15;
const FPMIN = 1e-300;
const MAX_ITER = 500;

/** ln Γ(x) — Lanczos yaqinlashuvi (g = 7, n = 9), x > 0 */
const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
  1.5056327351493116e-7,
];

export function logGamma(x) {
  if (!(x > 0)) throw new RangeError('logGamma: x musbat bo‘lishi kerak');
  if (x < 0.5) {
    // Ko‘zgu formulasi: Γ(x)Γ(1−x) = π / sin(πx)
    return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - logGamma(1 - x);
  }
  const z = x - 1;
  let a = LANCZOS[0];
  const t = z + 7.5;
  for (let i = 1; i < 9; i++) a += LANCZOS[i] / (z + i);
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Lentz usulidagi uzluksiz kasr — to‘liqmas beta funksiya uchun */
function betaContinuedFraction(x, a, b) {
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAX_ITER; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) return h;
  }
  return h; // yaqinlashuv amalda har doim yetarli
}

/** Regulyarlashgan to‘liqmas beta funksiya I_x(a, b) */
export function incompleteBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lbt = logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log1p(-x);
  const bt = Math.exp(lbt);
  if (x < (a + 1) / (a + b + 2)) return (bt * betaContinuedFraction(x, a, b)) / a;
  return 1 - (bt * betaContinuedFraction(1 - x, b, a)) / b;
}

/** Regulyarlashgan quyi to‘liqmas gamma funksiya P(a, x) */
export function incompleteGammaP(a, x) {
  if (x <= 0) return 0;
  const gln = logGamma(a);
  if (x < a + 1) {
    let ap = a;
    let sum = 1 / a;
    let del = sum;
    for (let n = 0; n < MAX_ITER; n++) {
      ap += 1;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * EPS) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - gln);
  }
  // Q(a, x) uzluksiz kasr orqali
  let b = x + 1 - a;
  let c = 1 / FPMIN;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= MAX_ITER; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return 1 - Math.exp(-x + a * Math.log(x) - gln) * h;
}

/* ---------------- Student t ---------------- */

/** P(T ≤ t), T ~ t(df) */
export function studentTCdf(t, df) {
  if (!Number.isFinite(t)) return t > 0 ? 1 : 0;
  const x = df / (df + t * t);
  const tail = 0.5 * incompleteBeta(x, df / 2, 0.5);
  return t > 0 ? 1 - tail : tail;
}

/** Ikki tomonlama p-qiymat: P(|T| ≥ |t|) */
export function studentTTwoSidedP(t, df) {
  if (!Number.isFinite(t)) return 0;
  return incompleteBeta(df / (df + t * t), df / 2, 0.5);
}

/** t-taqsimot kvantili: P(T ≤ q) = p */
export function studentTInv(p, df) {
  if (!(p > 0 && p < 1)) throw new RangeError('studentTInv: p (0;1) oralig‘ida bo‘lishi kerak');
  if (p === 0.5) return 0;
  // Normal yaqinlashuvdan boshlab, Nyuton + bisektsiya bilan aniqlashtirish
  let lo = -1;
  let hi = 1;
  while (studentTCdf(lo, df) > p) lo *= 2;
  while (studentTCdf(hi, df) < p) hi *= 2;
  let x = normalInv(p);
  if (!(x > lo && x < hi)) x = (lo + hi) / 2;
  const logC = logGamma((df + 1) / 2) - logGamma(df / 2) - 0.5 * Math.log(df * Math.PI);
  for (let i = 0; i < 200; i++) {
    const f = studentTCdf(x, df) - p;
    if (Math.abs(f) < 1e-15) break;
    if (f > 0) hi = x;
    else lo = x;
    const pdf = Math.exp(logC - ((df + 1) / 2) * Math.log1p((x * x) / df));
    let next = x - f / pdf;
    if (!(next > lo && next < hi)) next = (lo + hi) / 2;
    if (Math.abs(next - x) < 1e-14 * Math.max(1, Math.abs(x))) {
      x = next;
      break;
    }
    x = next;
  }
  return x;
}

/* ---------------- Fisher F ---------------- */

/** P(F ≤ f), F ~ F(d1, d2) */
export function fisherFCdf(f, d1, d2) {
  if (f <= 0) return 0;
  if (!Number.isFinite(f)) return 1;
  return incompleteBeta((d1 * f) / (d1 * f + d2), d1 / 2, d2 / 2);
}

/** Yuqori dum: P(F ≥ f) — kichik p-qiymatlar uchun aniq */
export function fisherFSurvival(f, d1, d2) {
  if (f <= 0) return 1;
  if (!Number.isFinite(f)) return 0;
  return incompleteBeta(d2 / (d2 + d1 * f), d2 / 2, d1 / 2);
}

/* ---------------- χ² ---------------- */

export function chiSquareCdf(x, k) {
  return incompleteGammaP(k / 2, x / 2);
}

export function chiSquareSurvival(x, k) {
  if (x <= 0) return 1;
  return 1 - incompleteGammaP(k / 2, x / 2);
}

/* ---------------- Normal ---------------- */

/** Standart normal taqsimot funksiyasi Φ(z), erfc orqali (W. J. Cody darajasidagi aniqlik) */
export function normalCdf(z) {
  // Φ(z) = P(1/2, z²/2) simmetriyasi orqali
  if (z === 0) return 0.5;
  const p = 0.5 * incompleteGammaP(0.5, (z * z) / 2);
  return z > 0 ? 0.5 + p : 0.5 - p;
}

/** Standart normal kvantil — Acklam algoritmi + Halley tuzatishi */
export function normalInv(p) {
  if (!(p > 0 && p < 1)) throw new RangeError('normalInv: p (0;1) oralig‘ida bo‘lishi kerak');
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const plow = 0.02425;
  let x;
  if (p < plow) {
    const q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= 1 - plow) {
    const q = p - 0.5;
    const r = q * q;
    x = ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  // Halley qadami
  const e = normalCdf(x) - p;
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
  return x - u / (1 + (x * u) / 2);
}

/** Fisher taqsimoti kvantili: P(F ≤ q) = p (jadval/kritik qiymat) */
export function fisherFInv(p, d1, d2) {
  if (!(p > 0 && p < 1)) throw new RangeError('fisherFInv: p (0;1) oralig‘ida bo‘lishi kerak');
  let lo = 0;
  let hi = 1;
  while (fisherFCdf(hi, d1, d2) < p) {
    lo = hi;
    hi *= 2;
    if (hi > 1e12) return Infinity;
  }
  for (let i = 0; i < 300; i++) {
    const mid = (lo + hi) / 2;
    if (fisherFCdf(mid, d1, d2) < p) lo = mid;
    else hi = mid;
    if (hi - lo <= 1e-14 * Math.max(1, hi)) break;
  }
  return (lo + hi) / 2;
}
