/**
 * Natijalarni eksport qilish: mustaqil HTML hisobot, CSV va JSON.
 * Kirish — fitModel() natijasi (asl birliklardagi model + `base` OLS).
 */
import { fmt, fmtP, pText, stars, escapeHtml } from '../core/format.js';
import { interpret } from '../core/interpret.js';
import { toCSV } from '../core/parser.js';
import { describe } from '../core/regression.js';

export function download(filename, content, mime) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function residualsCSV(M) {
  const D = M.base.diagnostics;
  const headers = ['№', ...(M.labels ? ['yorliq'] : []), ...M.featureNames, M.targetName, 'y_hat', 'qoldiq', 'stud_qoldiq', 'leverage', 'cook_D'];
  const rows = M.y.map((y, i) => [i + 1, ...(M.labels ? [M.labels[i]] : []), ...M.X[i], y, M.fitted[i], M.residuals[i], D.studentized[i], D.leverage[i], D.cooksD[i]]);
  return toCSV(headers, rows);
}

export function modelJSON(M) {
  const B = M.base;
  return JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      modelType: M.type,
      modelLabel: M.typeLabel,
      equation: M.equation(8).text,
      n: M.n,
      featureNames: M.featureNames,
      targetName: M.targetName,
      alpha: M.alpha,
      metricsOriginalScale: M.metrics,
      elasticity: M.elasticity,
      extrema: M.extrema,
      growthRate: M.growthRate,
      linearized: {
        targetName: B.targetName,
        paramNames: B.paramNames,
        coefficients: B.coefficients,
        standardErrors: B.standardErrors,
        tStats: B.tStats,
        pValues: B.pValues,
        confidenceIntervals: B.confidenceIntervals,
        robustHC3: B.robust,
        tCritical: B.tCritical,
        fCritical: B.fCritical,
        anova: B.anova,
        metrics: B.metrics,
        covariance: B.covariance,
        diagnostics: {
          durbinWatson: B.diagnostics.durbinWatson,
          jarqueBera: B.diagnostics.jarqueBera,
          breuschPagan: B.diagnostics.breuschPagan,
          conditionNumber: B.diagnostics.conditionNumber,
          vif: B.diagnostics.vif,
        },
      },
    },
    null,
    2,
  );
}

export function htmlReport(M, { title = 'Regressiya tahlili', problem = '', source = null } = {}) {
  const B = M.base;
  const conf = Math.round((1 - M.alpha) * 100);
  const A = B.anova;
  const m = M.metrics;
  const rows = B.paramNames
    .map(
      (nm, j) =>
        `<tr><td>${escapeHtml(nm)}</td><td>${fmt(B.coefficients[j], 6)}</td><td>${fmt(B.standardErrors[j], 5)}</td><td>${fmt(B.tStats[j], 4)}</td><td>${fmtP(B.pValues[j])} ${stars(B.pValues[j])}</td><td>${fmt(B.confidenceIntervals[j][0], 5)}</td><td>${fmt(B.confidenceIntervals[j][1], 5)}</td><td>${fmt(B.robust.standardErrors[j], 5)}</td><td>${fmtP(B.robust.pValues[j])}</td></tr>`,
    )
    .join('');
  const desc = [...M.featureNames.map((f, j) => [f, M.X.map((r) => r[j])]), [M.targetName, M.y]]
    .map(([n, v]) => {
      const s = describe(v);
      return `<tr><td>${escapeHtml(n)}</td><td>${s.n}</td><td>${fmt(s.mean, 5)}</td><td>${fmt(s.sd, 5)}</td><td>${fmt(s.min, 5)}</td><td>${fmt(s.median, 5)}</td><td>${fmt(s.max, 5)}</td></tr>`;
    })
    .join('');
  const comp = M.compare
    ? `<h2>Model turlarini solishtirish</h2><table><thead><tr><th>Model</th><th>Tenglama</th><th>R² (indeks)</th><th>R̄²</th><th>MAPE</th></tr></thead><tbody>${M.compare.rows
        .filter((r) => r.applicable)
        .map((r) => `<tr><td>${escapeHtml(r.label)}${r.type === M.compare.best ? ' ★' : ''}</td><td style="text-align:left">${escapeHtml(r.equation)}</td><td>${fmt(r.r2, 4)}</td><td>${fmt(r.adjR2, 4)}</td><td>${r.mape === null ? '—' : `${fmt(r.mape, 3)}%`}</td></tr>`)
        .join('')}</tbody></table>`
    : '';
  const ins = interpret(M)
    .map((x) => `<li class="${x.level}"><b>${escapeHtml(x.title)}</b><br>${escapeHtml(x.text)}</li>`)
    .join('');
  const src = source?.name ? `<p class="muted"><b>Ma’lumotlar manbai:</b> ${escapeHtml(source.name)}${source.via ? `; ${escapeHtml(source.via)}` : ''}${source.url ? ` — ${escapeHtml(source.url)}` : ''}</p>` : '';
  return `<!doctype html><html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
body{font:15px/1.55 system-ui,-apple-system,Segoe UI,sans-serif;color:#111;max-width:980px;margin:40px auto;padding:0 20px}
h1{font-size:26px;margin:0 0 4px}h2{font-size:18px;margin:32px 0 10px;border-bottom:2px solid #8b7bff;padding-bottom:4px}
.eq{font:600 17px/1.5 ui-monospace,monospace;background:#f4f3ff;padding:14px 18px;border-radius:10px;overflow-x:auto}
table{border-collapse:collapse;width:100%;font-size:13px;margin:8px 0}th,td{border:1px solid #ddd;padding:6px 8px;text-align:right}
th{background:#f6f6fb}td:first-child,th:first-child{text-align:left}.muted{color:#666;font-size:13px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.grid div{border:1px solid #e3e3ef;border-radius:10px;padding:10px}
.grid b{display:block;font-size:20px}ul{padding-left:18px}li{margin:8px 0}li.good b{color:#15803d}li.warn b{color:#b45309}li.bad b{color:#b91c1c}
@media print{body{margin:0}.noprint{display:none}}
</style></head><body>
<h1>${escapeHtml(title)}</h1>
<p class="muted">Regressiya.Lab · ${new Date().toLocaleString('uz-UZ')} · ${escapeHtml(M.typeLabel)} model · n = ${M.n}, parametrlar = ${B.p}, ishonchlilik ${conf}%</p>
${problem ? `<h2>Masala sharti</h2><p>${escapeHtml(problem)}</p>` : ''}${src}
<h2>Tavsifiy statistika</h2>
<table><thead><tr><th>O‘zgaruvchi</th><th>n</th><th>O‘rtacha</th><th>Std. chetl.</th><th>Min</th><th>Mediana</th><th>Maks</th></tr></thead><tbody>${desc}</tbody></table>
<h2>Regressiya tenglamasi</h2><div class="eq">${escapeHtml(M.equation(6).text)}</div>
${M.type !== 'linear' ? `<p class="muted">Chiziqlilashtirilgan model: ${escapeHtml(B.targetName)} = f(${escapeHtml(B.featureNames.join(', '))})</p>` : ''}
<h2>Model sifati</h2>
<div class="grid">
<div>${M.type === 'linear' ? 'R²' : 'R² (indeks)'}<b>${fmt(m.r2, 5)}</b></div><div>Tuzatilgan R²<b>${fmt(m.adjR2, 5)}</b></div>
<div>F_haq / F_jadval<b>${fmt(B.metrics.fStat, 5)} / ${fmt(B.fCritical, 4)}</b><span class="muted">${pText(B.metrics.fPValue)}</span></div>
<div>Standart xato σ<b>${fmt(m.sigma, 5)}</b></div><div>RMSE<b>${fmt(m.rmse, 5)}</b></div>
<div>MAPE<b>${m.mape === null ? '—' : `${fmt(m.mape, 4)}%`}</b></div><div>AIC<b>${fmt(B.metrics.aic, 5)}</b></div><div>BIC<b>${fmt(B.metrics.bic, 5)}</b></div>
</div>
<h2>Koeffitsiyentlar</h2>
<table><thead><tr><th>Parametr</th><th>b</th><th>SE</th><th>t</th><th>p</th><th>${conf}% quyi</th><th>${conf}% yuqori</th><th>SE (HC3)</th><th>p (HC3)</th></tr></thead><tbody>${rows}</tbody></table>
<p class="muted">*** p&lt;0.001 · ** p&lt;0.01 · * p&lt;0.05 · · p&lt;0.1 &nbsp; t<sub>jadval</sub> = ${fmt(B.tCritical, 5)}. Elastiklik: ${M.featureNames.map((f, j) => `${escapeHtml(f)} — ${fmt(M.elasticity[j], 4)}`).join('; ')}</p>
<h2>Dispersiya tahlili (ANOVA)</h2>
<table><thead><tr><th>Manba</th><th>SS</th><th>df</th><th>MS</th><th>F</th><th>F_jadval</th><th>p</th></tr></thead><tbody>
<tr><td>Regressiya</td><td>${fmt(A.regression.ss, 6)}</td><td>${A.regression.df}</td><td>${fmt(A.regression.ms, 6)}</td><td>${fmt(A.f, 5)}</td><td>${fmt(B.fCritical, 5)}</td><td>${fmtP(A.pValue)}</td></tr>
<tr><td>Qoldiq</td><td>${fmt(A.residual.ss, 6)}</td><td>${A.residual.df}</td><td>${fmt(A.residual.ms, 6)}</td><td></td><td></td><td></td></tr>
<tr><td>Jami</td><td>${fmt(A.total.ss, 6)}</td><td>${A.total.df}</td><td></td><td></td><td></td><td></td></tr></tbody></table>
<h2>Diagnostika</h2>
<table><tbody>
<tr><td>Darbin–Uotson</td><td>${fmt(B.diagnostics.durbinWatson, 5)}</td></tr>
<tr><td>Jark–Bera (p)</td><td>${fmt(B.diagnostics.jarqueBera.statistic, 5)} (${fmtP(B.diagnostics.jarqueBera.pValue)})</td></tr>
${B.diagnostics.breuschPagan ? `<tr><td>Breush–Pagan (p)</td><td>${fmt(B.diagnostics.breuschPagan.statistic, 5)} (${fmtP(B.diagnostics.breuschPagan.pValue)})</td></tr>` : ''}
<tr><td>Shartlilik soni</td><td>${fmt(B.diagnostics.conditionNumber, 5)}</td></tr>
${B.diagnostics.vif ? B.featureNames.map((f, j) => `<tr><td>VIF (${escapeHtml(f)})</td><td>${fmt(B.diagnostics.vif[j], 5)}</td></tr>`).join('') : ''}
</tbody></table>
${comp}
<h2>Xulosalar</h2><ul>${ins}</ul>
<p class="noprint" style="margin-top:32px"><button onclick="window.print()" style="padding:10px 18px;border-radius:999px;border:0;background:#8b7bff;color:#fff;font-weight:600;cursor:pointer">PDF sifatida saqlash / chop etish</button></p>
</body></html>`;
}
