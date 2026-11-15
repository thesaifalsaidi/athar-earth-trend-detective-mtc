"""Statistical trend engine for ATHAR.

Everything here is pure numpy/scipy, so it is deterministic, testable and fast.

Methods
-------
* Mann-Kendall (MK) trend test with tie correction.
* Serial-correlation correction (default: bias-adjusted lag-1 'effective sample size';
  optional Hamed & Rao 1998). Plain MK produces many false alarms on autocorrelated
  climate series - see athar/validate.py for the Monte-Carlo proof.
* Seasonal Mann-Kendall (Hirsch et al. 1982) for monthly data.
* Theil-Sen slope with a distribution-free confidence interval.
* Pettitt change-point test.
* Benjamini-Hochberg false-discovery-rate control for maps (many cells).
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Optional

import numpy as np
from scipy import stats

# ----------------------------------------------------------------------------
# helpers
# ----------------------------------------------------------------------------


def _clean(y: np.ndarray, t: Optional[np.ndarray] = None):
    y = np.asarray(y, dtype=float)
    if t is None:
        t = np.arange(len(y), dtype=float)
    t = np.asarray(t, dtype=float)
    ok = np.isfinite(y) & np.isfinite(t)
    return y[ok], t[ok]


def deseasonalize(y: np.ndarray, period: int = 12) -> np.ndarray:
    """Return anomalies: remove the mean annual cycle (index must start at a cycle start)."""
    y = np.asarray(y, dtype=float)
    out = y.copy()
    for m in range(period):
        idx = np.arange(m, len(y), period)
        out[idx] = y[idx] - np.nanmean(y[idx])
    return out


# ----------------------------------------------------------------------------
# Mann-Kendall
# ----------------------------------------------------------------------------


def mk_statistic(y: np.ndarray) -> float:
    """Kendall's S statistic."""
    y = np.asarray(y, dtype=float)
    n = len(y)
    s = 0.0
    for k in range(n - 1):
        s += np.sign(y[k + 1:] - y[k]).sum()
    return float(s)


def mk_variance(y: np.ndarray) -> float:
    """Var(S) with the tie correction."""
    n = len(y)
    _, counts = np.unique(y, return_counts=True)
    tie = np.sum(counts * (counts - 1) * (2 * counts + 5))
    return (n * (n - 1) * (2 * n + 5) - tie) / 18.0


def _hamed_rao_factor(y: np.ndarray, t: np.ndarray) -> float:
    """Hamed-Rao variance inflation factor n/n* from significant autocorrelations
    of the detrended, rank-transformed series."""
    n = len(y)
    if n < 10:
        return 1.0
    slope = theil_sen_slope(y, t)[0]
    detr = y - slope * t
    ranks = stats.rankdata(detr)
    ranks = ranks - ranks.mean()
    denom = np.sum(ranks * ranks)
    if denom == 0:
        return 1.0
    max_lag = min(n - 2, int(n / 3))
    z = stats.norm.ppf(0.975)
    sum_term = 0.0
    for k in range(1, max_lag + 1):
        rk = np.sum(ranks[:-k] * ranks[k:]) / denom
        # 95% limits of the null autocorrelation
        lo = (-1 - z * np.sqrt(n - k - 1)) / (n - k)
        hi = (-1 + z * np.sqrt(n - k - 1)) / (n - k)
        if rk < lo or rk > hi:
            sum_term += (n - k) * (n - k - 1) * (n - k - 2) * rk
    factor = 1.0 + 2.0 / (n * (n - 1) * (n - 2)) * sum_term
    return float(max(factor, 1.0)) if np.isfinite(factor) else 1.0


def _lag1_factor(y: np.ndarray, t: np.ndarray) -> float:
    """Variance inflation (1+r1)/(1-r1) from the lag-1 autocorrelation of the detrended
    series, with a small-sample bias adjustment. Calibrated by Monte Carlo (see validate.py):
    false-alarm rate ~4-6 % for AR(1) noise with phi = 0 ... 0.5 and n = 40."""
    n = len(y)
    if n < 8:
        return 1.0
    slope = theil_sen_slope(y, t)[0]
    d = y - slope * t
    d = d - d.mean()
    den = np.sum(d * d)
    if den == 0:
        return 1.0
    r1 = np.sum(d[:-1] * d[1:]) / den
    r1 = (r1 * n + 1.0) / (n - 4.0) if n > 5 else r1
    r1 = min(max(r1, 0.0), 0.9)
    return float((1 + r1) / (1 - r1))


def mann_kendall(y, t=None, alpha: float = 0.05, correction: str = "lag1"):
    """Return (S, Z, p_value, significant).

    correction : 'lag1' (default) | 'hr' (Hamed-Rao) | 'none' (plain Mann-Kendall)
    """
    y, t = _clean(y, t)
    n = len(y)
    if n < 8:
        return 0.0, 0.0, 1.0, False
    s = mk_statistic(y)
    var = mk_variance(y)
    if correction == "lag1":
        var *= _lag1_factor(y, t)
    elif correction == "hr":
        var *= _hamed_rao_factor(y, t)
    if var <= 0:
        return s, 0.0, 1.0, False
    if s > 0:
        z = (s - 1) / np.sqrt(var)
    elif s < 0:
        z = (s + 1) / np.sqrt(var)
    else:
        z = 0.0
    p = 2 * (1 - stats.norm.cdf(abs(z)))
    return float(s), float(z), float(p), bool(p < alpha)


def seasonal_mann_kendall(y, period: int = 12, alpha: float = 0.05, correct: bool = True):
    """Hirsch seasonal Mann-Kendall: MK within each season, then summed.
    Monthly anomalies are strongly persistent, so the variance is inflated with the
    lag-1 factor of the de-seasonalised series when correct=True."""
    y = np.asarray(y, dtype=float)
    s_tot, var_tot = 0.0, 0.0
    for m in range(period):
        ym = y[m::period]
        ym = ym[np.isfinite(ym)]
        if len(ym) < 5:
            continue
        s_tot += mk_statistic(ym)
        var_tot += mk_variance(ym)
    if correct:
        an = deseasonalize(y, period)
        tt = np.arange(len(an), dtype=float)
        ok = np.isfinite(an)
        var_tot *= _lag1_factor(an[ok], tt[ok])
    if var_tot <= 0:
        return 0.0, 0.0, 1.0, False
    z = (s_tot - np.sign(s_tot)) / np.sqrt(var_tot) if s_tot != 0 else 0.0
    p = 2 * (1 - stats.norm.cdf(abs(z)))
    return float(s_tot), float(z), float(p), bool(p < alpha)


# ----------------------------------------------------------------------------
# Theil-Sen slope
# ----------------------------------------------------------------------------


def theil_sen_slope(y, t=None, conf: float = 0.95, var_factor: float = 1.0):
    """Return (slope, intercept, slope_low, slope_high).

    var_factor inflates Var(S) for serial correlation so the confidence interval is
    consistent with the corrected Mann-Kendall p-value."""
    y, t = _clean(y, t)
    n = len(y)
    if n < 3:
        return np.nan, np.nan, np.nan, np.nan
    i, j = np.triu_indices(n, k=1)
    dt = t[j] - t[i]
    ok = dt != 0
    slopes = (y[j] - y[i])[ok] / dt[ok]
    slopes.sort()
    m = len(slopes)
    slope = float(np.median(slopes))
    # Sen (1968) distribution-free CI
    var = mk_variance(y) * var_factor
    c = stats.norm.ppf(0.5 + conf / 2) * np.sqrt(var)
    m1 = int(np.floor((m - c) / 2))
    m2 = int(np.ceil((m + c) / 2))
    lo = float(slopes[max(0, min(m - 1, m1))])
    hi = float(slopes[max(0, min(m - 1, m2))])
    intercept = float(np.median(y - slope * t))
    return slope, intercept, lo, hi


# ----------------------------------------------------------------------------
# Pettitt change-point test
# ----------------------------------------------------------------------------


def pettitt(y):
    """Return (change_index, p_value). Index = last point of the first regime."""
    y = np.asarray(y, dtype=float)
    y = y[np.isfinite(y)]
    n = len(y)
    if n < 10:
        return None, 1.0
    # Pettitt (1979) U_k computed from cumulative rank sums
    r = stats.rankdata(y)
    uk = 2 * np.cumsum(r) - (np.arange(1, n + 1)) * (n + 1)
    k = int(np.argmax(np.abs(uk)))
    kstat = float(np.abs(uk[k]))
    p = 2 * np.exp(-6 * kstat ** 2 / (n ** 3 + n ** 2))
    return k, float(min(1.0, p))


# ----------------------------------------------------------------------------
# multiple testing
# ----------------------------------------------------------------------------


def benjamini_hochberg(pvals, q: float = 0.05):
    """Boolean mask of discoveries with FDR <= q (NaN p-values are never significant)."""
    p = np.asarray(pvals, dtype=float)
    flat = p.ravel()
    ok = np.isfinite(flat)
    sig = np.zeros_like(flat, dtype=bool)
    pv = flat[ok]
    m = len(pv)
    if m == 0:
        return sig.reshape(p.shape)
    order = np.argsort(pv)
    thresh = q * (np.arange(1, m + 1) / m)
    passed = pv[order] <= thresh
    if passed.any():
        kmax = np.max(np.where(passed)[0])
        cutoff = pv[order][kmax]
        res = pv <= cutoff
    else:
        res = np.zeros(m, dtype=bool)
    sig[ok] = res
    return sig.reshape(p.shape)


# ----------------------------------------------------------------------------
# the one-call result object
# ----------------------------------------------------------------------------


@dataclass
class TrendResult:
    n: int
    slope_per_year: float
    slope_low: float
    slope_high: float
    total_change: float
    pct_change_per_decade: float
    z: float
    p_value: float
    significant: bool
    direction: str                 # 'increasing' | 'decreasing' | 'no significant trend'
    change_year: Optional[float]
    change_p: float
    ols_slope_per_year: float
    ols_p: float
    snr: float                      # |total change| / std of residuals
    step_suspected: bool = False    # an abrupt jump explains most of the change (possible data artifact)

    def to_dict(self):
        return asdict(self)


def analyze_series(values, years, period: int = 12, alpha: float = 0.05,
                   monthly: bool = True) -> TrendResult:
    """Full trend analysis of one time series.

    values : 1-D array (monthly values starting in January if monthly=True,
             or annual values if monthly=False)
    years  : decimal-year time axis, same length as values
    """
    y = np.asarray(values, dtype=float)
    t = np.asarray(years, dtype=float)
    if monthly:
        anom = deseasonalize(y, period)
        s, z, p, sig = seasonal_mann_kendall(y, period, alpha)
        # Sen slope on de-seasonalised anomalies, per year
        ya, ta = _clean(anom, t)
        slope, icpt, lo, hi = theil_sen_slope(anom, t, var_factor=_lag1_factor(ya, ta))
        base_for_pct = np.nanmean(y)
    else:
        s, z, p, sig = mann_kendall(y, t, alpha)
        ya, ta = _clean(y, t)
        slope, icpt, lo, hi = theil_sen_slope(y, t, var_factor=_lag1_factor(ya, ta))
        base_for_pct = np.nanmean(y)
    span = np.nanmax(t) - np.nanmin(t)
    total = slope * span if np.isfinite(slope) else np.nan
    resid = ya - (slope * ta + icpt) if np.isfinite(slope) else ya
    sd = np.nanstd(resid) if len(resid) else np.nan
    snr = abs(total) / sd if sd and np.isfinite(sd) and sd > 0 else 0.0
    pct = (slope * 10 / abs(base_for_pct) * 100) if base_for_pct not in (0, np.nan) and np.isfinite(slope) and base_for_pct != 0 else np.nan
    ci, cp = pettitt(ya)
    cyear = float(ta[ci]) if ci is not None and len(ta) > ci else None
    step = False
    if ci is not None and cp < 0.01 and np.isfinite(total) and total != 0:
        jump = abs(np.median(ya[ci + 1:]) - np.median(ya[:ci + 1]))
        step = bool(jump >= 0.6 * abs(total))
    ols = stats.linregress(ta, ya) if len(ta) > 2 else None
    direction = "no significant trend"
    if sig:
        direction = "increasing" if slope > 0 else "decreasing"
    return TrendResult(
        n=int(len(ya)), slope_per_year=float(slope), slope_low=float(lo), slope_high=float(hi),
        total_change=float(total), pct_change_per_decade=float(pct), z=float(z),
        p_value=float(p), significant=bool(sig), direction=direction,
        change_year=cyear, change_p=float(cp),
        ols_slope_per_year=float(ols.slope) if ols else np.nan,
        ols_p=float(ols.pvalue) if ols else np.nan, snr=float(snr), step_suspected=step,
    )


# ----------------------------------------------------------------------------
# vectorised grid version (for maps)
# ----------------------------------------------------------------------------


def grid_trend(cube: np.ndarray, years: np.ndarray, chunk: int = 2000):
    """Fast per-cell trend on an annual cube.

    cube  : array (time, lat, lon) of annual values (NaN allowed)
    years : (time,) array
    returns dict of 2-D arrays: slope, p, z, n  (p from tie-corrected MK, no autocorr
    correction - use this for screening, then re-test hot cells with analyze_series)
    """
    nt, ny, nx = cube.shape
    flat = cube.reshape(nt, ny * nx)
    slope = np.full(ny * nx, np.nan)
    pval = np.full(ny * nx, np.nan)
    zval = np.full(ny * nx, np.nan)
    nobs = np.zeros(ny * nx, dtype=int)
    ii, jj = np.triu_indices(nt, k=1)
    dt = (years[jj] - years[ii]).astype(float)
    for a in range(0, ny * nx, chunk):
        blk = flat[:, a:a + chunk]                      # (nt, c)
        diff = blk[jj, :] - blk[ii, :]                  # (pairs, c)
        valid = np.isfinite(diff)
        sgn = np.where(valid, np.sign(diff), 0.0)
        s = sgn.sum(axis=0)
        sl = np.where(valid, diff / dt[:, None], np.nan)
        slope[a:a + chunk] = np.nanmedian(sl, axis=0)
        cnt = np.isfinite(blk).sum(axis=0)
        nobs[a:a + chunk] = cnt
        var = cnt * (cnt - 1) * (2 * cnt + 5) / 18.0
        with np.errstate(divide="ignore", invalid="ignore"):
            z = np.where(s > 0, (s - 1), np.where(s < 0, (s + 1), 0.0)) / np.sqrt(var)
        zval[a:a + chunk] = z
        pval[a:a + chunk] = 2 * (1 - stats.norm.cdf(np.abs(z)))
    bad = nobs < 8
    slope[bad] = np.nan
    pval[bad] = np.nan
    zval[bad] = np.nan
    return {"slope": slope.reshape(ny, nx), "p": pval.reshape(ny, nx),
            "z": zval.reshape(ny, nx), "n": nobs.reshape(ny, nx)}
