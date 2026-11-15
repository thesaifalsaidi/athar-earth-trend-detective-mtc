"""Map-level analysis: what / where / how much / significant, plus 'opposite story' finder."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict

import numpy as np

from .stats_engine import analyze_series, benjamini_hochberg


@dataclass
class RegionalResult:
    lats: np.ndarray
    lons: np.ndarray
    years: np.ndarray
    slope: np.ndarray        # per year
    p: np.ndarray
    sig_raw: np.ndarray      # p < alpha (uncorrected)
    sig_fdr: np.ndarray      # Benjamini-Hochberg controlled
    n_valid: int


def regional_trends(years: np.ndarray, cube: np.ndarray, lats, lons,
                    alpha: float = 0.05, fdr_q: float = 0.05) -> RegionalResult:
    nt, ny, nx = cube.shape
    slope = np.full((ny, nx), np.nan)
    p = np.full((ny, nx), np.nan)
    for i in range(ny):
        for j in range(nx):
            y = cube[:, i, j]
            if np.isfinite(y).sum() < 10:
                continue
            r = analyze_series(y, years, monthly=False, alpha=alpha)
            slope[i, j], p[i, j] = r.slope_per_year, r.p_value
    sig_raw = np.isfinite(p) & (p < alpha)
    sig_fdr = benjamini_hochberg(p, q=fdr_q)
    return RegionalResult(np.asarray(lats), np.asarray(lons), np.asarray(years), slope, p,
                          sig_raw, sig_fdr, int(np.isfinite(p).sum()))


def opposite_story(rr: RegionalResult, min_cells: int = 3, min_share: float = 0.05) -> Dict:
    """Detect regions where the SAME variable moves in opposite directions (FDR-significant)."""
    pos = rr.sig_fdr & (rr.slope > 0)
    neg = rr.sig_fdr & (rr.slope < 0)
    n_pos, n_neg = int(pos.sum()), int(neg.sum())
    thresh = max(min_cells, int(np.ceil(min_share * max(rr.n_valid, 1))))
    LAT, LON = np.meshgrid(rr.lats, rr.lons, indexing="ij")

    def centroid(m):
        return (float(LAT[m].mean()), float(LON[m].mean())) if m.any() else None

    return {
        "n_valid_cells": rr.n_valid, "n_increasing": n_pos, "n_decreasing": n_neg,
        "share_increasing": n_pos / max(rr.n_valid, 1), "share_decreasing": n_neg / max(rr.n_valid, 1),
        "opposite": bool(n_pos >= thresh and n_neg >= thresh),
        "opposition_index": min(n_pos, n_neg) / max(rr.n_valid, 1),   # 0 = one-sided ... 0.5 = perfectly split
        "centroid_increasing": centroid(pos), "centroid_decreasing": centroid(neg),
    }
