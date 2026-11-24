"""Real ma'lumotlar, chiziqlilashtiriladigan modellar, HC3 va xususiy korrelyatsiya uchun etalonlar."""
import json, numpy as np, statsmodels.api as sm
from scipy import stats
D = {d['id']: d for d in json.load(open('src/data/datasets.json'))}
def cols(d, names): i = [d['headers'].index(n) for n in names]; return np.array([[r[j] for j in i] for r in d['rows']], float)
out = {}
# 1) NIST Longley sertifikatlangan qiymatlari (statsmodels test to'plamidan, manba: NIST StRD)
out['nist_longley'] = dict(
  params=[-3482258.63459582, 15.0618722713733, -0.358191792925910E-01, -2.02022980381683, -1.03322686717359, -0.511041056535807E-01, 1829.15146461355],
  bse=[890420.383607373, 84.9149257747669, 0.334910077722432E-01, 0.488399681651699, 0.214274163161675, 0.226073200069370, 455.478499142212],
  rsquared=0.995479004577296, fvalue=330.285339234588, sigma=float(np.sqrt(92936.0061673238)), ssr=836424.055505915)
# 2) Chiziqlilashtiriladigan modellar
def tr(type_, X, y):
    if type_ == 'linear': return X, y
    if type_ == 'quadratic': return np.column_stack([c for j in range(X.shape[1]) for c in (X[:, j], X[:, j]**2)]), y
    if type_ == 'power': return np.log(X), np.log(y)
    if type_ == 'exponential': return X, np.log(y)
    if type_ == 'logarithmic': return np.log(X), y
    if type_ == 'hyperbolic': return 1 / X, y
cases = [('daraxtlar', ['diametr', 'balandlik'], 'hajm', 'power', [35, 23]),
         ('uz_aholi', ['yil'], 'aholi', 'exponential', [2030]),
         ('tormoz', ['tezlik'], 'masofa', 'quadratic', [50]),
         ('uz_yaim_umr', ['yaim_pc'], 'umr', 'logarithmic', [3500]),
         ('uz_yaim_umr', ['yaim_pc'], 'umr', 'hyperbolic', [3500]),
         ('bmt_mamlakatlar', ['yaim_pc', 'tugilish'], 'umr_ayol', 'logarithmic', [1427.3, 2.264])]
for idd, fs, t, typ, x0 in cases:
    d = D[idd]; X = cols(d, fs); y = cols(d, [t])[:, 0]
    Xt, yt = tr(typ, X, y); r = sm.OLS(yt, sm.add_constant(Xt)).fit()
    logy = typ in ('power', 'exponential'); fitted = np.exp(r.fittedvalues) if logy else r.fittedvalues
    sse = ((y - fitted)**2).sum(); sst = ((y - y.mean())**2).sum()
    x0t, _ = tr(typ, np.array([x0], float), np.array([1.0])); pr = r.get_prediction(sm.add_constant(x0t, has_constant='add')).summary_frame(0.05)
    inv = np.exp if logy else (lambda v: v)
    out[f'{idd}_{typ}'] = dict(id=idd, features=fs, target=t, type=typ, x0=x0, params=r.params.tolist(), bse=r.bse.tolist(), r2_lin=r.rsquared,
        r2_index=1 - sse / sst, mape=float(100 * np.mean(np.abs((y - fitted) / y))), yhat=float(inv(pr['mean'].iloc[0])),
        ci=[float(inv(pr['mean_ci_lower'].iloc[0])), float(inv(pr['mean_ci_upper'].iloc[0]))], pi=[float(inv(pr['obs_ci_lower'].iloc[0])), float(inv(pr['obs_ci_upper'].iloc[0]))])
# 3) HC3 (Engel — geteroskedastiklik)
d = D['engel']; X = cols(d, ['daromad']); y = cols(d, ['oziq_ovqat'])[:, 0]
r = sm.OLS(y, sm.add_constant(X)).fit(cov_type='HC3'); r0 = sm.OLS(y, sm.add_constant(X)).fit()
from statsmodels.stats.diagnostic import het_breuschpagan
out['engel_hc3'] = dict(params=r.params.tolist(), bse_hc3=r.bse.tolist(), bse=r0.bse.tolist(), bp=het_breuschpagan(r0.resid, sm.add_constant(X))[1])
d = D['jamgarma']; X = cols(d, d['features']); y = cols(d, ['jamgarma'])[:, 0]
r = sm.OLS(y, sm.add_constant(X)).fit(cov_type='HC3'); out['jamgarma_hc3'] = dict(bse_hc3=r.bse.tolist())
# 4) Xususiy korrelyatsiya (qoldiqlar usuli bilan mustaqil hisoblash) — jamg'arma
Z = np.column_stack([X, y]); m = Z.shape[1]; P = np.eye(m)
for i in range(m):
    for j in range(m):
        if i == j: continue
        rest = [c for c in range(m) if c not in (i, j)]; A = sm.add_constant(Z[:, rest])
        ei = Z[:, i] - A @ np.linalg.lstsq(A, Z[:, i], rcond=None)[0]; ej = Z[:, j] - A @ np.linalg.lstsq(A, Z[:, j], rcond=None)[0]
        P[i, j] = np.corrcoef(ei, ej)[0, 1]
out['partial_jamgarma'] = P.tolist()
out['jamgarma_t'] = sm.OLS(y, sm.add_constant(X)).fit().tvalues.tolist()
# 5) F kritik qiymatlar va tavsifiy statistika
out['fcrit'] = [[a, d1, d2, float(stats.f.ppf(1 - a, d1, d2))] for a in (0.1, 0.05, 0.01) for d1, d2 in ((1, 10), (2, 27), (4, 45), (6, 9), (1, 926))]
v = cols(D['uz_aholi'], ['aholi'])[:, 0]
out['describe_aholi'] = dict(mean=v.mean(), sd=v.std(ddof=1), median=float(np.median(v)), q1=float(np.percentile(v, 25)), q3=float(np.percentile(v, 75)), skew=float(stats.skew(v)))
json.dump(out, open('tests/fixtures/reference_models.json', 'w'), indent=1)
print('ok', len(out))
