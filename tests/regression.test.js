import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fitOLS, simpleRegressionSteps, RegressionError, correlationMatrix } from '../src/core/regression.js';
import { studentTCdf, studentTInv, fisherFSurvival, chiSquareSurvival, normalCdf, normalInv } from '../src/core/distributions.js';
import { gradientDescent } from '../src/core/gradientDescent.js';
import { parseTable, parseNumber } from '../src/core/parser.js';
import { DATASETS } from '../src/core/datasets.js';

const ref = JSON.parse(readFileSync(new URL('./fixtures/reference.json', import.meta.url)));

/** Nisbiy xatolik bilan taqqoslash */
function close(actual, expected, rel = 1e-8, abs = 1e-10) {
  const diff = Math.abs(actual - expected);
  expect(diff <= abs || diff <= rel * Math.abs(expected), `${actual} ≈ ${expected}`).toBe(true);
}
const closeArr = (a, e, rel, abs) => {
  expect(a.length).toBe(e.length);
  a.forEach((v, i) => close(v, e[i], rel, abs));
};

describe('Taqsimotlar (scipy bilan)', () => {
  it('Student t CDF', () => ref.dist.tcdf.forEach(([t, d, p]) => close(studentTCdf(t, d), p, 1e-10, 1e-14)));
  it('Student t kvantil', () => ref.dist.tinv.forEach(([p, d, q]) => close(studentTInv(p, d), q, 1e-9)));
  it('F yuqori dum', () => ref.dist.fsf.forEach(([f, a, b, p]) => close(fisherFSurvival(f, a, b), p, 1e-9, 1e-15)));
  it('χ² yuqori dum', () => ref.dist.chi2sf.forEach(([x, k, p]) => close(chiSquareSurvival(x, k), p, 1e-9, 1e-15)));
  it('Normal CDF', () => ref.dist.ncdf.forEach(([z, p]) => close(normalCdf(z), p, 1e-10, 1e-15)));
  it('Normal kvantil', () => ref.dist.ninv.forEach(([p, z]) => close(normalInv(p), z, 1e-9, 1e-12)));
});

describe.each(['simple', 'multi', 'collinear'])('OLS — %s (statsmodels bilan)', (name) => {
  const c = ref[name];
  const m = fitOLS(c.X, c.y);
  it('koeffitsiyentlar va standart xatolar', () => {
    closeArr(m.coefficients, c.params, 1e-9);
    closeArr(m.standardErrors, c.bse, 1e-9);
    closeArr(m.tStats, c.tvalues, 1e-9);
    closeArr(m.pValues, c.pvalues, 1e-7, 1e-15);
    m.confidenceIntervals.forEach((ci, j) => closeArr(ci, c.ci[j], 1e-9));
  });
  it('model sifati', () => {
    close(m.metrics.r2, c.r2, 1e-10);
    close(m.metrics.adjR2, c.adjr2, 1e-10);
    close(m.metrics.fStat, c.f, 1e-9);
    close(m.metrics.fPValue, c.fp, 1e-7, 1e-15);
    close(m.metrics.logLik, c.llf, 1e-10);
    close(m.metrics.aic, c.aic, 1e-10);
    close(m.metrics.bic, c.bic, 1e-10);
    close(m.metrics.mse, c.mse_resid, 1e-10);
  });
  it('diagnostika', () => {
    close(m.diagnostics.durbinWatson, c.dw, 1e-10);
    close(m.diagnostics.jarqueBera.statistic, c.jb, 1e-8);
    close(m.diagnostics.jarqueBera.pValue, c.jbp, 1e-8);
    close(m.diagnostics.jarqueBera.skew, c.skew, 1e-8);
    close(m.diagnostics.jarqueBera.kurtosis, c.kurt, 1e-8);
    close(m.diagnostics.breuschPagan.statistic, c.bp, 1e-8);
    close(m.diagnostics.breuschPagan.pValue, c.bpp, 1e-7);
    close(m.diagnostics.conditionNumber, c.cond, 1e-6);
    closeArr(m.diagnostics.leverage, c.leverage, 1e-9);
    closeArr(m.diagnostics.cooksD, c.cooks, 1e-8, 1e-14);
    closeArr(m.diagnostics.studentized, c.student, 1e-9);
    closeArr(m.diagnostics.externallyStudentized, c.student_ext, 1e-9);
    if (c.vif) closeArr(m.diagnostics.vif, c.vif, 1e-8);
  });
  it('bashorat oraliqlari', () => {
    const p = m.predict(c.pred_x);
    close(p.yhat, c.pred.mean, 1e-10);
    closeArr(p.confidence, c.pred.ci, 1e-9);
    closeArr(p.prediction, c.pred.pi, 1e-9);
  });
});

describe('Ozod hadsiz model', () => {
  it('statsmodels bilan mos (markazlashmagan R²)', () => {
    const c = ref.nointercept;
    const m = fitOLS(c.X, c.y, { intercept: false });
    closeArr(m.coefficients, c.params, 1e-9);
    closeArr(m.standardErrors, c.bse, 1e-9);
    closeArr(m.pValues, c.pvalues, 1e-7, 1e-15);
    close(m.metrics.r2, c.r2, 1e-10);
    close(m.metrics.adjR2, c.adjr2, 1e-10);
    close(m.metrics.fStat, c.f, 1e-9);
  });
});

describe('Xatoliklarni qayta ishlash', () => {
  it('to‘liq multikollinearlik', () => {
    const X = [[1, 2], [2, 4], [3, 6], [4, 8], [5, 10]];
    expect(() => fitOLS(X, [1, 2, 3, 5, 4])).toThrow(RegressionError);
    try {
      fitOLS(X, [1, 2, 3, 5, 4]);
    } catch (e) {
      expect(e.code).toBe('RANK_DEFICIENT');
    }
  });
  it('kuzatuvlar yetarli emas', () => {
    expect(() => fitOLS([[1], [2]], [1, 2])).toThrow(/ko‘p bo‘lishi kerak/);
  });
  it('o‘zgarmas y', () => {
    expect(() => fitOLS([[1], [2], [3], [4]], [5, 5, 5, 5])).toThrow(/bir xil/);
  });
  it('son bo‘lmagan qiymat', () => {
    expect(() => fitOLS([[1], [NaN], [3]], [1, 2, 3])).toThrow(RegressionError);
  });
  it('mukammal moslik (SSE = 0) — R² = 1', () => {
    const m = fitOLS([[1], [2], [3], [4]], [3, 5, 7, 9]);
    close(m.coefficients[0], 1);
    close(m.coefficients[1], 2);
    close(m.metrics.r2, 1);
  });
});

describe('Qo‘lda hisoblash qadamlari', () => {
  it('OLS bilan bir xil', () => {
    const c = ref.simple;
    const s = simpleRegressionSteps(c.X.map((r) => r[0]), c.y);
    close(s.b0, c.params[0], 1e-10);
    close(s.b1, c.params[1], 1e-10);
    close(s.r2, c.r2, 1e-10);
  });
});

describe('Gradient tushish', () => {
  const c = ref.multi;
  it('batch GD OLS yechimiga yaqinlashadi', () => {
    const r = gradientDescent(c.X, c.y, { learningRate: 0.3, epochs: 5000, tolerance: 1e-15 });
    closeArr(r.params, c.params, 1e-5, 1e-6);
  });
  it('mini-batch + momentum yaqinlashadi', () => {
    const r = gradientDescent(c.X, c.y, { learningRate: 0.02, epochs: 800, method: 'minibatch', batchSize: 10, momentum: 0.9, decay: 0.05 });
    closeArr(r.params, c.params, 0.02, 0.02);
  });
  it('juda katta qadamda uzoqlashishni aniqlaydi', () => {
    const r = gradientDescent(c.X, c.y, { learningRate: 5, epochs: 300 });
    expect(r.status).toBe('diverged');
  });
  it('xarajat monoton kamayadi (batch, kichik qadam)', () => {
    const r = gradientDescent(c.X, c.y, { learningRate: 0.1, epochs: 200 });
    for (let i = 1; i < r.history.length; i++) expect(r.history[i].cost).toBeLessThanOrEqual(r.history[i - 1].cost + 1e-12);
  });
});

describe('CSV tahlilchi', () => {
  it('sarlavha, vergul ajratuvchi', () => {
    const t = parseTable('x,y\n1,2\n3,4\n');
    expect(t.headers).toEqual(['x', 'y']);
    expect(t.rows).toEqual([[1, 2], [3, 4]]);
  });
  it('nuqtali vergul + o‘nlik vergul', () => {
    const t = parseTable('maydon;narx\n45,5;60,2\n70;88,1\n');
    expect(t.rows).toEqual([[45.5, 60.2], [70, 88.1]]);
  });
  it('tab, sarlavhasiz, xato qatorlar', () => {
    const t = parseTable('1\t2\n3\tabc\n5\t6\n7\n');
    expect(t.headers).toEqual(['x', 'y']);
    expect(t.rows).toEqual([[1, 2], [5, 6]]);
    expect(t.skipped.length).toBe(2);
  });
  it('qo‘shtirnoqli maydonlar', () => {
    const t = parseTable('"a, b",c\n"1",2\n');
    expect(t.headers).toEqual(['a, b', 'c']);
  });
  it('sonlarni tahlil', () => {
    expect(parseNumber('1e3')).toBe(1000);
    expect(parseNumber(' -2.5 ')).toBe(-2.5);
    expect(Number.isNaN(parseNumber('12abc'))).toBe(true);
  });
});

describe('Namunaviy masalalar', () => {
  it('korrelyatsiya matritsasi diagonali 1', () => {
    const M = correlationMatrix([[1, 2, 3, 4], [2, 1, 4, 3]]);
    close(M[0][0], 1);
    close(M[0][1], 0.6);
  });
  it('to‘plamlar soni', () => expect(DATASETS.length).toBeGreaterThanOrEqual(10));
});
