"""statsmodels/scipy yordamida test uchun etalon qiymatlarni yaratadi."""
import json, numpy as np, statsmodels.api as sm
from scipy import stats
from statsmodels.stats.stattools import durbin_watson, jarque_bera
from statsmodels.stats.diagnostic import het_breuschpagan
from statsmodels.stats.outliers_influence import variance_inflation_factor

rng = np.random.default_rng(2024)
cases = {}
reklama = np.array([[2.0,31.5],[3.1,35.2],[3.5,38.0],[4.2,40.1],[4.8,44.3],[5.0,43.8],[5.9,48.9],[6.3,50.2],[6.8,51.0],[7.4,55.6],[7.9,57.1],[8.5,59.8]])
cases['simple'] = (reklama[:, :1], reklama[:, 1])
X = rng.normal(size=(60, 3)) * [3, 10, 0.5] + [5, 50, 2]
y = 2 + 1.5*X[:,0] - 0.3*X[:,1] + 4*X[:,2] + rng.normal(scale=2 + 0.3*np.abs(X[:,0]), size=60)
cases['multi'] = (X, y)
X2 = rng.uniform(0, 100, size=(25, 2)); X2[:,1] = X2[:,0]*0.9 + rng.normal(scale=4, size=25)
y2 = 10 + 0.2*X2[:,0] + 0.5*X2[:,1] + rng.normal(scale=5, size=25)
cases['collinear'] = (X2, y2)

out = {}
for name, (X, y) in cases.items():
    Xc = sm.add_constant(X)
    r = sm.OLS(y, Xc).fit()
    pred_x = X.mean(axis=0) + 1.0
    pr = r.get_prediction(np.r_[1.0, pred_x][None, :]).summary_frame(alpha=0.05)
    infl = r.get_influence()
    jb, jbp, sk, ku = jarque_bera(r.resid)
    bp = het_breuschpagan(r.resid, Xc)
    vif = [variance_inflation_factor(Xc, j) for j in range(1, Xc.shape[1])] if X.shape[1] > 1 else None
    out[name] = dict(
        X=X.tolist(), y=y.tolist(), params=r.params.tolist(), bse=r.bse.tolist(), tvalues=r.tvalues.tolist(),
        pvalues=r.pvalues.tolist(), ci=r.conf_int(0.05).tolist(), r2=r.rsquared, adjr2=r.rsquared_adj,
        f=r.fvalue, fp=r.f_pvalue, llf=r.llf, aic=r.aic, bic=r.bic, mse_resid=r.mse_resid,
        dw=durbin_watson(r.resid), jb=jb, jbp=jbp, skew=sk, kurt=ku, bp=bp[0], bpp=bp[1],
        cond=r.condition_number, leverage=infl.hat_matrix_diag.tolist(), cooks=infl.cooks_distance[0].tolist(),
        student=infl.resid_studentized_internal.tolist(), student_ext=infl.resid_studentized_external.tolist(),
        vif=vif, pred_x=pred_x.tolist(), pred=dict(mean=pr['mean'][0], ci=[pr['mean_ci_lower'][0], pr['mean_ci_upper'][0]], pi=[pr['obs_ci_lower'][0], pr['obs_ci_upper'][0]]),
    )
# no-intercept case
X, y = cases['multi']
r = sm.OLS(y, X).fit()
out['nointercept'] = dict(X=X.tolist(), y=y.tolist(), params=r.params.tolist(), bse=r.bse.tolist(), r2=r.rsquared, adjr2=r.rsquared_adj, f=r.fvalue, fp=r.f_pvalue, pvalues=r.pvalues.tolist())

dist = dict(
  tcdf=[[t, d, stats.t.cdf(t, d)] for t in [-4.2, -1.3, 0.2, 2.1, 7.5] for d in [1, 3, 10, 57]],
  tinv=[[p, d, stats.t.ppf(p, d)] for p in [0.6, 0.9, 0.975, 0.995, 0.9995] for d in [1, 2, 5, 30, 200]],
  fsf=[[f, a, b, stats.f.sf(f, a, b)] for f in [0.5, 2.3, 9.8, 120.0] for a, b in [(1, 10), (3, 56), (5, 200)]],
  chi2sf=[[x, k, stats.chi2.sf(x, k)] for x in [0.3, 2.0, 7.7, 25.0] for k in [1, 2, 3, 8]],
  ncdf=[[z, stats.norm.cdf(z)] for z in [-5, -1.96, -0.3, 0.0, 1.0, 3.3]],
  ninv=[[p, stats.norm.ppf(p)] for p in [1e-6, 0.01, 0.3, 0.5, 0.8, 0.975, 0.999999]],
)
out['dist'] = dist
json.dump(out, open('tests/fixtures/reference.json', 'w'))
print('ok')
