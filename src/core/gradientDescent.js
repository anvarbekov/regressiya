/**
 * Gradient tushish (Gradient Descent) usulida chiziqli regressiya.
 * Batch, mini-batch va stoxastik (SGD) rejimlari, momentum va xususiyatlarni
 * standartlashtirish qo‘llab-quvvatlanadi. Natija — asl birliklardagi koeffitsiyentlar
 * va har bir qadam tarixi (vizualizatsiya uchun).
 */

/** Takrorlanuvchi tasodifiy sonlar generatori (mulberry32) */
export function createRng(seed = 42) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const popSd = (a) => {
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length);
};

/** Asl birliklardagi xarajat funksiyasi J = 1/(2n) Σ (ŷ − y)² */
export function costFunction(X, y, b) {
  let s = 0;
  for (let i = 0; i < y.length; i++) {
    let yh = b[0];
    for (let j = 0; j < X[i].length; j++) yh += b[j + 1] * X[i][j];
    s += (yh - y[i]) ** 2;
  }
  return s / (2 * y.length);
}

/**
 * @param {number[][]} X n×k
 * @param {number[]} y
 * @param {object} o
 */
export function gradientDescent(X, y, o = {}) {
  const {
    learningRate = 0.1,
    epochs = 500,
    method = 'batch', // 'batch' | 'minibatch' | 'sgd'
    batchSize = 16,
    momentum = 0,
    decay = 0, // o‘rganish tezligining so‘nishi: η_t = η / (1 + decay·epoch)
    tolerance = 1e-10,
    standardize = true,
    seed = 42,
    maxHistory = 1500,
    init = null, // asl birliklardagi boshlang‘ich [b0, b1, …]
  } = o;
  const n = y.length;
  const k = X[0]?.length ?? 0;
  if (n < 2 || k < 1) throw new Error('Gradient tushish uchun kamida 2 kuzatuv va 1 omil kerak');
  if (!(learningRate > 0)) throw new Error('O‘rganish tezligi musbat bo‘lishi kerak');

  const mu = standardize ? Array.from({ length: k }, (_, j) => mean(X.map((r) => r[j]))) : new Array(k).fill(0);
  const sd = standardize
    ? Array.from({ length: k }, (_, j) => popSd(X.map((r) => r[j])) || 1)
    : new Array(k).fill(1);
  const muY = standardize ? mean(y) : 0;
  const sdY = standardize ? popSd(y) || 1 : 1;

  const Z = X.map((r) => r.map((v, j) => (v - mu[j]) / sd[j]));
  const yt = y.map((v) => (v - muY) / sdY);

  const toOriginal = (theta) => {
    const b = new Array(k + 1);
    let b0 = muY + sdY * theta[0];
    for (let j = 0; j < k; j++) {
      b[j + 1] = (sdY * theta[j + 1]) / sd[j];
      b0 -= b[j + 1] * mu[j];
    }
    b[0] = b0;
    return b;
  };
  const toScaled = (b) => {
    const theta = new Array(k + 1);
    let t0 = b[0];
    for (let j = 0; j < k; j++) {
      theta[j + 1] = (b[j + 1] * sd[j]) / sdY;
      t0 += b[j + 1] * mu[j];
    }
    theta[0] = (t0 - muY) / sdY;
    return theta;
  };

  let theta = init ? toScaled(init) : new Array(k + 1).fill(0);
  const velocity = new Array(k + 1).fill(0);
  const rng = createRng(seed);
  const order = Array.from({ length: n }, (_, i) => i);
  const bs = method === 'sgd' ? 1 : method === 'minibatch' ? Math.max(1, Math.min(batchSize, n)) : n;

  const history = [];
  const record = (epoch) => {
    const b = toOriginal(theta);
    history.push({ epoch, params: b, cost: costFunction(X, y, b) });
  };
  record(0);
  const recordEvery = Math.max(1, Math.ceil(epochs / maxHistory));

  let status = 'max_epochs';
  let prevCost = history[0].cost;
  let lastEpoch = 0;

  for (let epoch = 1; epoch <= epochs; epoch++) {
    const lr = learningRate / (1 + decay * (epoch - 1));
    if (bs < n) {
      for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
    }
    for (let start = 0; start < n; start += bs) {
      const end = Math.min(start + bs, n);
      const grad = new Array(k + 1).fill(0);
      for (let t = start; t < end; t++) {
        const i = order[t];
        let err = theta[0] - yt[i];
        for (let j = 0; j < k; j++) err += theta[j + 1] * Z[i][j];
        grad[0] += err;
        for (let j = 0; j < k; j++) grad[j + 1] += err * Z[i][j];
      }
      const m = end - start;
      for (let j = 0; j <= k; j++) {
        velocity[j] = momentum * velocity[j] + lr * (grad[j] / m);
        theta[j] -= velocity[j];
      }
    }
    lastEpoch = epoch;
    const b = toOriginal(theta);
    const cost = costFunction(X, y, b);
    if (!Number.isFinite(cost) || cost > history[0].cost * 1e8 + 1e12) {
      history.push({ epoch, params: b, cost });
      status = 'diverged';
      break;
    }
    if (epoch % recordEvery === 0 || epoch === epochs) history.push({ epoch, params: b, cost });
    if (bs === n && Math.abs(prevCost - cost) <= tolerance * Math.max(1, prevCost)) {
      if (history[history.length - 1].epoch !== epoch) history.push({ epoch, params: b, cost });
      status = 'converged';
      break;
    }
    prevCost = cost;
  }

  const params = toOriginal(theta);
  return {
    params,
    cost: costFunction(X, y, params),
    epochs: lastEpoch,
    status,
    history,
    scaling: { mu, sd, muY, sdY, standardize },
  };
}
