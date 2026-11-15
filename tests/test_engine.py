import numpy as np
import pymannkendall as pmk
import pytest

from athar.stats_engine import (analyze_series, benjamini_hochberg, deseasonalize,
                                grid_trend, mann_kendall, pettitt, theil_sen_slope)
from athar.story import case_file_ar, case_file_en
from athar.validate import false_alarm_rate


def _series(n=45, slope=0.03, sd=0.5, seed=1):
    rng = np.random.default_rng(seed)
    t = np.arange(n) + 1981.0
    return t, slope * (t - 1981) + rng.normal(0, sd, n)


def test_mk_matches_reference_library():
    t, y = _series()
    s, z, p, _ = mann_kendall(y, t, correction='none')
    ref = pmk.original_test(y)
    assert s == ref.s and z == pytest.approx(ref.z) and p == pytest.approx(ref.p)


def test_sen_slope_matches_reference_and_recovers_truth():
    t, y = _series(n=60, slope=0.04, sd=0.3)
    slope, _, lo, hi = theil_sen_slope(y, t)
    assert slope == pytest.approx(pmk.sens_slope(y).slope)
    assert lo < 0.04 < hi


def test_no_trend_is_not_significant():
    rng = np.random.default_rng(7)
    t = np.arange(40) + 1990.0
    r = analyze_series(rng.normal(size=40), t, monthly=False)
    assert not r.significant and r.direction == "no significant trend"


def test_monthly_trend_with_strong_seasonality():
    rng = np.random.default_rng(3)
    months = 12 * 35
    tt = 1990 + np.arange(months) / 12
    y = 10 * np.sin(2 * np.pi * np.arange(months) / 12) + 0.04 * (tt - 1990) + rng.normal(0, .5, months)
    r = analyze_series(y, tt, monthly=True)
    assert r.significant and r.direction == "increasing"
    assert r.slope_per_year == pytest.approx(0.04, abs=0.015)


def test_pettitt_finds_step():
    rng = np.random.default_rng(0)
    y = np.r_[rng.normal(0, 1, 25), rng.normal(3, 1, 25)]
    k, p = pettitt(y)
    assert abs(k - 24) <= 3 and p < 0.01


def test_fdr_controls_discoveries():
    p = np.array([0.001, 0.008, 0.039, 0.041, 0.2, 0.9])
    m = benjamini_hochberg(p, 0.05)
    assert m.tolist() == [True, True, False, False, False, False]


def test_grid_matches_pointwise():
    rng = np.random.default_rng(2)
    yrs = np.arange(30) + 1990.0
    cube = rng.normal(size=(30, 3, 4)) + 0.05 * (yrs[:, None, None] - 1990)
    g = grid_trend(cube, yrs)
    s, *_ = theil_sen_slope(cube[:, 1, 2], yrs)
    assert g["slope"][1, 2] == pytest.approx(s)


def test_autocorrelation_correction_reduces_false_alarms():
    plain, corr = false_alarm_rate(n=40, phi=0.5, trials=400, seed=5)
    assert corr < plain and corr < 0.10      # plain MK is ~23 % on this noise


def test_bilingual_story_is_generated():
    t, y = _series()
    r = analyze_series(y, t, monthly=False)
    assert "WHAT" in case_file_en(r, "Temperature", "°C", "Ibra", 1981, 2025)
    assert "ماذا يتغيّر" in case_file_ar(r, "درجة الحرارة", "°C", "إبراء", 1981, 2025)


def test_triage_ranks_real_signal_first():
    import pandas as pd
    from athar.triage import triage_point
    rng = np.random.default_rng(4)
    idx = pd.date_range("1981-01-15", periods=12 * 40, freq="MS") + pd.Timedelta(days=14)
    season = 5 * np.sin(2 * np.pi * np.arange(len(idx)) / 12)
    df = pd.DataFrame({
        "T2M": season + 0.05 * np.arange(len(idx)) / 12 + rng.normal(0, 0.4, len(idx)),   # real warming
        "RH2M": season + rng.normal(0, 1.0, len(idx)),                                   # pure noise
    }, index=idx)
    out = triage_point(df)
    assert out.iloc[0]["code"] == "T2M" and bool(out.iloc[0]["fdr_significant"])
    assert out.iloc[1]["lead"] == "Noise / inconclusive"
