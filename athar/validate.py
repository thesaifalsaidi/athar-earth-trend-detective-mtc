"""Built-in honesty check: how often does the test cry 'trend!' when there is none?"""
from __future__ import annotations

import numpy as np

from .stats_engine import mann_kendall


def ar1_noise(n: int, phi: float, rng) -> np.ndarray:
    e = rng.normal(size=n + 50)
    x = np.zeros(n + 50)
    for i in range(1, n + 50):
        x[i] = phi * x[i - 1] + e[i]
    return x[50:]


def false_alarm_rate(n: int = 40, phi: float = 0.4, trials: int = 400, alpha: float = 0.05, seed: int = 0):
    """Return (rate_plain_MK, rate_corrected). Both should be near alpha; plain MK is inflated."""
    rng = np.random.default_rng(seed)
    t = np.arange(n, dtype=float)
    plain = corr = 0
    for _ in range(trials):
        y = ar1_noise(n, phi, rng)
        plain += mann_kendall(y, t, alpha, correction='none')[3]
        corr += mann_kendall(y, t, alpha, correction='lag1')[3]
    return plain / trials, corr / trials


def power(n: int = 40, slope: float = 0.05, phi: float = 0.2, trials: int = 300, seed: int = 1) -> float:
    """Chance of detecting a real trend of `slope` sigma/year."""
    rng = np.random.default_rng(seed)
    t = np.arange(n, dtype=float)
    hit = 0
    for _ in range(trials):
        y = slope * t + ar1_noise(n, phi, rng)
        hit += mann_kendall(y, t, 0.05)[3]
    return hit / trials
