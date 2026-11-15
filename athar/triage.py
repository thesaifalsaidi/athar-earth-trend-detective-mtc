"""Variable triage: which of the many Earth-science variables is actually telling a story?

The challenge says it is hard to *select* variables that could indicate change.
ATHAR answers by scanning a catalogue and ranking every variable with ONE transparent score.

    score = 100 * ( 0.50 * S  +  0.30 * N  +  0.20 * C )

    S  significance  = min(1, -log10(p) / 4)         p from the autocorrelation-corrected Mann-Kendall test
    N  signal/noise  = min(1, SNR / 3)               SNR = |total change| / residual std
    C  completeness  = valid years / total years
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .data_sources import CATALOG_INDEX, to_annual
from .stats_engine import analyze_series, benjamini_hochberg


def lead_label(p: float, snr: float) -> str:
    if p < 0.01 and snr >= 1.5:
        return "Strong lead"
    if p < 0.05:
        return "Moderate lead"
    return "Noise / inconclusive"


def score_variable(res, completeness: float) -> float:
    s = min(1.0, -np.log10(max(res.p_value, 1e-12)) / 4.0)
    n = min(1.0, res.snr / 3.0)
    return float(100 * (0.5 * s + 0.3 * n + 0.2 * completeness))


def triage_point(df: pd.DataFrame, alpha: float = 0.05) -> pd.DataFrame:
    """df = monthly DataFrame (columns = variable codes). Returns a ranked table."""
    rows = []
    for code in df.columns:
        ann = to_annual(df[code].dropna() if df[code].notna().any() else df[code])
        years = ann.index.values
        res = analyze_series(ann.values, years, monthly=False, alpha=alpha)
        comp = float(np.isfinite(ann.values).mean())
        meta = CATALOG_INDEX.get(code, (code, code, code, "", ""))
        rows.append({
            "code": code, "variable": meta[1], "variable_ar": meta[2], "unit": meta[3],
            "source": meta[4], "slope_per_decade": res.slope_per_year * 10,
            "ci_low_per_decade": res.slope_low * 10, "ci_high_per_decade": res.slope_high * 10,
            "total_change": res.total_change, "pct_per_decade": res.pct_change_per_decade,
            "p_value": res.p_value, "snr": res.snr, "years": res.n,
            "direction": res.direction, "lead": lead_label(res.p_value, res.snr),
            "score": score_variable(res, comp),
        })
    out = pd.DataFrame(rows)
    # many variables are tested at once -> control the false-discovery rate across them too
    out["fdr_significant"] = benjamini_hochberg(out["p_value"].values, q=alpha)
    out = out.sort_values("score", ascending=False).reset_index(drop=True)
    out.index += 1
    return out
