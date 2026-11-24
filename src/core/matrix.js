/**
 * Chiziqli algebra yordamchilari.
 * Matritsalar — qatorlar massivi (number[][]); hisoblash Householder QR orqali,
 * bu normal tenglamalarni (XᵀX)⁻¹ to‘g‘ridan-to‘g‘ri teskarilashdan ancha barqaror.
 */

export function zeros(r, c) {
  return Array.from({ length: r }, () => new Float64Array(c));
}

export function transpose(A) {
  const r = A.length;
  const c = A[0].length;
  const T = zeros(c, r);
  for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) T[j][i] = A[i][j];
  return T;
}

export function matMul(A, B) {
  const n = A.length;
  const m = B[0].length;
  const k = B.length;
  const C = zeros(n, m);
  for (let i = 0; i < n; i++) {
    const Ai = A[i];
    const Ci = C[i];
    for (let p = 0; p < k; p++) {
      const a = Ai[p];
      if (a === 0) continue;
      const Bp = B[p];
      for (let j = 0; j < m; j++) Ci[j] += a * Bp[j];
    }
  }
  return C;
}

export function matVec(A, v) {
  return Array.from(A, (row) => {
    let s = 0;
    for (let j = 0; j < v.length; j++) s += row[j] * v[j];
    return s;
  });
}

export function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/**
 * Ingichka (thin) Householder QR: A (n×p, n ≥ p) = Q·R.
 * Q — n×p ortonormal ustunlar, R — p×p yuqori uchburchak.
 * Ichki hisoblash ustunlar bo‘yicha (column-major) saqlanadi — bu protsessor keshi uchun qulay
 * va katta n da qatorlar bo‘yicha saqlashga qaraganda bir necha marta tez.
 */
export function qrDecompose(A) {
  const n = A.length;
  const p = A[0].length;
  if (n < p) throw new Error('QR: kuzatuvlar soni parametrlar sonidan kam bo‘lmasligi kerak');
  const cols = Array.from({ length: p }, (_, j) => {
    const c = new Float64Array(n);
    for (let i = 0; i < n; i++) c[i] = A[i][j];
    return c;
  });
  const vs = new Array(p).fill(null);
  for (let k = 0; k < p; k++) {
    const ck = cols[k];
    let norm = 0;
    for (let i = k; i < n; i++) norm = Math.hypot(norm, ck[i]);
    if (norm === 0) continue;
    const alpha = ck[k] > 0 ? -norm : norm;
    const v = new Float64Array(n - k);
    for (let i = k; i < n; i++) v[i - k] = ck[i];
    v[0] -= alpha;
    let vnorm2 = 0;
    for (let i = 0; i < v.length; i++) vnorm2 += v[i] * v[i];
    if (vnorm2 === 0) continue;
    for (let j = k; j < p; j++) {
      const cj = cols[j];
      let s = 0;
      for (let i = k; i < n; i++) s += v[i - k] * cj[i];
      const f = (2 * s) / vnorm2;
      for (let i = k; i < n; i++) cj[i] -= f * v[i - k];
    }
    vs[k] = { v, vnorm2 };
  }
  // Q = H₀H₁…H_{p−1}·I[:, :p] (ustunlar bo‘yicha)
  const qc = Array.from({ length: p }, (_, j) => {
    const c = new Float64Array(n);
    c[j] = 1;
    return c;
  });
  for (let k = p - 1; k >= 0; k--) {
    const h = vs[k];
    if (!h) continue;
    const { v, vnorm2 } = h;
    for (let j = 0; j < p; j++) {
      const cj = qc[j];
      let s = 0;
      for (let i = k; i < n; i++) s += v[i - k] * cj[i];
      if (s === 0) continue;
      const f = (2 * s) / vnorm2;
      for (let i = k; i < n; i++) cj[i] -= f * v[i - k];
    }
  }
  const Q = zeros(n, p);
  for (let j = 0; j < p; j++) for (let i = 0; i < n; i++) Q[i][j] = qc[j][i];
  const R = zeros(p, p);
  for (let i = 0; i < p; i++) for (let j = i; j < p; j++) R[i][j] = cols[j][i];
  return { Q, R };
}

/** R·x = b, R yuqori uchburchak */
export function backSubstitute(R, b) {
  const p = R.length;
  const x = new Float64Array(p);
  for (let i = p - 1; i >= 0; i--) {
    let s = b[i];
    for (let j = i + 1; j < p; j++) s -= R[i][j] * x[j];
    x[i] = s / R[i][i];
  }
  return x;
}

/** Yuqori uchburchak R ning teskarisi */
export function invertUpperTriangular(R) {
  const p = R.length;
  const inv = zeros(p, p);
  for (let j = 0; j < p; j++) {
    inv[j][j] = 1 / R[j][j];
    for (let i = j - 1; i >= 0; i--) {
      let s = 0;
      for (let k = i + 1; k <= j; k++) s += R[i][k] * inv[k][j];
      inv[i][j] = -s / R[i][i];
    }
  }
  return inv;
}

/** Simmetrik matritsaning xos qiymatlari — Jacobi aylanishlari usuli */
export function symmetricEigenvalues(S) {
  const n = S.length;
  const A = S.map((r) => Float64Array.from(r));
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] * A[i][j];
    if (off < 1e-30) break;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-300) continue;
        const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = A[k][p];
          const akq = A[k][q];
          A[k][p] = c * akp - s * akq;
          A[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = A[p][k];
          const aqk = A[q][k];
          A[p][k] = c * apk - s * aqk;
          A[q][k] = s * apk + c * aqk;
        }
      }
    }
  }
  return Array.from({ length: n }, (_, i) => A[i][i]).sort((a, b) => b - a);
}
