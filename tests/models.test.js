import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fitOLS, partialCorrelations, describe as describeStats, correlationTest, RegressionError } from '../src/core/regression.js';
import { fisherFInv } from '../src/core/distributions.js';
import { fitModel, compareModels, isApplicable } from '../src/core/models.js';
import { parseCells, parseTable } from '../src/core/parser.js';
import { REAL_DATASETS, datasetMatrix } from '../src/core/datasets.js';

const ref = JSON.parse(readFileSync(new URL('./fixtures/reference_models.json', import.meta.url)));
const close = (a, e, rel = 1e-8, abs = 1e-10) => {
  const d = Math.abs(a - e);
  expect(d <= abs || d <= rel * Math.abs(e), `${a} ≈ ${e}`).toBe(true);
};
const closeArr = (a, e, rel, abs) => {
  expect(a.length).toBe(e.length);
  a.forEach((v, i) => close(v, e[i], rel, abs));
};
const ds = (id) => REAL_DATASETS.find((d) => d.id === id);

describe('NIST StRD — Longley sertifikatlangan qiymatlari', () => {
  const d = ds('longley');
  const { X, y } = datasetMatrix(d, d.features, d.target);
  const m = fitOLS(X, y);
  const c = ref.nist_longley;
  it('koeffitsiyentlar (≥ 10 to‘g‘ri raqam)', () => closeArr(m.coefficients, c.params, 1e-10));
  it('standart xatolar', () => closeArr(m.standardErrors, c.bse, 1e-10));
  it('R², F, σ, SSE', () => {
    close(m.metrics.r2, c.rsquared, 1e-12);
    close(m.metrics.fStat, c.fvalue, 1e-10);
    close(m.metrics.sigma, c.sigma, 1e-10);
    close(m.anova.residual.ss, c.ssr, 1e-10);
  });
  it('kuchli multikollinearlik aniqlanadi (VIF > 10)', () => expect(Math.max(...m.diagnostics.vif)).toBeGreaterThan(10));
});

describe.each(Object.entries(ref).filter(([k]) => /_(power|exponential|quadratic|logarithmic|hyperbolic)$/.test(k)))('Model %s (statsmodels bilan)', (_, c) => {
  const d = ds(c.id);
  const { X, y } = datasetMatrix(d, c.features, c.target);
  const m = fitModel(X, y, { type: c.type, featureNames: c.features, targetName: c.target });
  it('chiziqlilashtirilgan koeffitsiyentlar va SE', () => {
    closeArr(m.base.coefficients, c.params, 1e-9);
    closeArr(m.base.standardErrors, c.bse, 1e-9);
    close(m.base.metrics.r2, c.r2_lin, 1e-10);
  });
  it('asl birliklardagi determinatsiya indeksi va MAPE', () => {
    close(m.metrics.r2, c.r2_index, 1e-10);
    close(m.metrics.mape, c.mape, 1e-9);
  });
  it('asl birliklardagi bashorat va oraliqlar', () => {
    const p = m.predict(c.x0);
    close(p.yhat, c.yhat, 1e-9);
    closeArr(p.confidence, c.ci, 1e-9);
    closeArr(p.prediction, c.pi, 1e-9);
  });
});

describe('Modellar bo‘yicha qo‘shimcha tekshiruvlar', () => {
  it('daraxtlar: darajali model geometriyaga mos (b ≈ 2, c ≈ 1)', () => {
    const d = ds('daraxtlar');
    const { X, y } = datasetMatrix(d, d.features, d.target);
    const m = fitModel(X, y, { type: 'power', featureNames: d.features, targetName: d.target });
    expect(m.base.coefficients[1]).toBeGreaterThan(1.8);
    expect(m.base.coefficients[1]).toBeLessThan(2.2);
    expect(m.base.confidenceIntervals[2][0]).toBeLessThan(1);
    expect(m.base.confidenceIntervals[2][1]).toBeGreaterThan(1);
    expect(m.elasticity[0]).toBeCloseTo(m.base.coefficients[1], 12);
  });
  it('aholi: ko‘rsatkichli modelda yillik o‘sish sur’ati = e^b − 1', () => {
    const d = ds('uz_aholi');
    const { X, y } = datasetMatrix(d, d.features, d.target);
    const m = fitModel(X, y, { type: 'exponential' });
    close(m.growthRate, Math.exp(m.base.coefficients[1]) - 1, 1e-14);
    expect(m.growthRate).toBeGreaterThan(0.01);
    expect(m.growthRate).toBeLessThan(0.04);
  });
  it('tormoz: parabola ekstremumi −b/(2c)', () => {
    const d = ds('tormoz');
    const { X, y } = datasetMatrix(d, d.features, d.target);
    const m = fitModel(X, y, { type: 'quadratic' });
    const [, b, c] = m.base.coefficients;
    close(m.extrema[0].x, -b / (2 * c), 1e-14);
  });
  it('chiziqli tur fitOLS bilan aynan bir xil', () => {
    const d = ds('galton');
    const { X, y } = datasetMatrix(d, d.features, d.target);
    const a = fitModel(X, y, { type: 'linear' });
    const b = fitOLS(X, y);
    closeArr(a.base.coefficients, b.coefficients, 1e-15, 1e-15);
    close(a.metrics.r2, b.metrics.r2, 1e-15);
    expect(b.coefficients[1]).toBeLessThan(1); // “o‘rtachaga qaytish”
  });
  it('aniqlanish sohasi tekshiriladi', () => {
    expect(isApplicable('power', [[1], [-2], [3]], [1, 2, 3])).toBe(false);
    expect(() => fitModel([[1], [0], [3], [4]], [1, 2, 3, 5], { type: 'hyperbolic' })).toThrow(RegressionError);
    expect(() => fitModel([[1], [2], [3], [4]], [1, -2, 3, 5], { type: 'exponential' })).toThrow(/musbat/);
  });
  it('modellarni solishtirish eng yaxshisini topadi', () => {
    const d = ds('tormoz');
    const { X, y } = datasetMatrix(d, d.features, d.target);
    const c = compareModels(X, y);
    expect(c.rows.length).toBe(6);
    expect(['quadratic', 'power']).toContain(c.best);
  });
});

describe('HC3 bardoshli standart xatolar (statsmodels bilan)', () => {
  it('Engel ma’lumotlari', () => {
    const d = ds('engel');
    const { X, y } = datasetMatrix(d, d.features, d.target);
    const m = fitOLS(X, y);
    closeArr(m.robust.standardErrors, ref.engel_hc3.bse_hc3, 1e-9);
    expect(m.diagnostics.breuschPagan.pValue).toBeLessThan(0.05);
  });
  it('Jamg‘arma (4 omil)', () => {
    const d = ds('jamgarma');
    const { X, y } = datasetMatrix(d, d.features, d.target);
    closeArr(fitOLS(X, y).robust.standardErrors, ref.jamgarma_hc3.bse_hc3, 1e-9);
  });
});

describe('Korrelyatsiya tahlili', () => {
  const d = ds('jamgarma');
  const { X, y } = datasetMatrix(d, d.features, d.target);
  const cols = [...d.features.map((_, j) => X.map((r) => r[j])), y];
  it('xususiy korrelyatsiya (qoldiqlar usuli bilan mustaqil hisoblangan)', () => {
    const P = partialCorrelations(cols);
    P.forEach((row, i) => closeArr(row, ref.partial_jamgarma[i], 1e-9, 1e-12));
  });
  it('xususiy korrelyatsiya t-testi koeffitsiyent t-statistikasiga teng', () => {
    const P = partialCorrelations(cols);
    const k = d.features.length;
    d.features.forEach((_, j) => close(correlationTest(P[j][k], y.length, k + 1).t, ref.jamgarma_t[j + 1], 1e-9));
  });
});

describe('Taqsimotlar va tavsifiy statistika', () => {
  it('F kritik qiymatlar (scipy)', () => ref.fcrit.forEach(([a, d1, d2, q]) => close(fisherFInv(1 - a, d1, d2), q, 1e-10)));
  it('model F kritik qiymatni qaytaradi', () => {
    const m = fitOLS([[1], [2], [3], [4], [5], [6]], [2, 4.1, 5.9, 8.2, 9.9, 12.1]);
    close(m.fCritical, fisherFInv(0.95, 1, 4), 1e-12);
  });
  it('tavsifiy statistika (numpy)', () => {
    const d = ds('uz_aholi');
    const s = describeStats(d.rows.map((r) => r[1]));
    const c = ref.describe_aholi;
    close(s.mean, c.mean, 1e-12);
    close(s.sd, c.sd, 1e-12);
    close(s.median, c.median, 1e-12);
    close(s.q1, c.q1, 1e-12);
    close(s.q3, c.q3, 1e-12);
    close(s.skew, c.skew, 1e-10);
  });
});

describe('Real ma’lumotlar to‘plamlari', () => {
  it.each(REAL_DATASETS.map((d) => [d.id, d]))('%s — manba ko‘rsatilgan va model quriladi', (_, d) => {
    expect(d.source?.name).toBeTruthy();
    expect(d.rows.length).toBeGreaterThan(10);
    const { X, y } = datasetMatrix(d, d.features, d.target);
    const m = fitModel(X, y, { type: d.modelType, featureNames: d.features, targetName: d.target });
    expect(m.base.metrics.fPValue).toBeLessThan(0.05);
    if (d.labels) expect(d.labels.length).toBe(d.rows.length);
  });
});

describe('Matnli ustunlar (yorliqlar) bilan jadval', () => {
  it('birinchi matnli ustun yorliq sifatida olinadi', () => {
    const t = parseTable('davlat;yaim;umr\nO‘zbekiston;1427,3;71,9\nQozog‘iston;9070;72\nTojikiston;820;70,5\n');
    expect(t.labelHeader).toBe('davlat');
    expect(t.labels).toEqual(['O‘zbekiston', 'Qozog‘iston', 'Tojikiston']);
    expect(t.headers).toEqual(['yaim', 'umr']);
    expect(t.rows[0]).toEqual([1427.3, 71.9]);
  });
  it('Excel katakchalari (2D massiv) tahlil qilinadi', () => {
    const t = parseCells([['x', 'y'], [1, 2], [2, '4,5'], [3, null], [4, 8]]);
    expect(t.rows).toEqual([[1, 2], [2, 4.5], [4, 8]]);
    expect(t.skipped.length).toBe(1);
  });
});

describe('Tenglamani formatlash', () => {
  it('kichik koeffitsiyentlarda daraja belgisi saqlanadi', () => {
    const X = [[1000], [2000], [3000], [4000], [5000], [6000]];
    const y = X.map(([x]) => 50 + 0.008 * x - 1.2e-6 * x * x + (x % 3000 === 0 ? 0.01 : -0.01));
    const m = fitModel(X, y, { type: 'quadratic', featureNames: ['x'], targetName: 'y' });
    const eq = m.equation(4);
    expect(eq.text).toMatch(/− 1\.2\d*e−6·x²/);
    expect(eq.tex).toMatch(/10\^\{-6\}/);
    expect(eq.tex).not.toMatch(/e6|e−6/);
  });
});
