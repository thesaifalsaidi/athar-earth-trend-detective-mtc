"""Data access layer for ATHAR.

Primary source (works with NO credentials, ideal for a live demo):
    NASA POWER API  -> MERRA-2 reanalysis + CERES satellite products, 1981-present.

Optional sources (need a free NASA Earthdata login):
    earthaccess  -> any NetCDF/HDF5 granule (GPM IMERG, MODIS NDVI, SMAP, GRACE ...)
    CSV upload   -> any user-supplied time series.
"""
from __future__ import annotations

import hashlib
import json
import os
import time
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

import numpy as np
import pandas as pd
import requests

POWER_BASE = "https://power.larc.nasa.gov/api/temporal/monthly"
CACHE_DIR = Path(os.environ.get("ATHAR_CACHE", Path.home() / ".athar_cache"))
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Candidate variables the triage engine scans. (code, English, Arabic, unit, source)
CATALOG: List[Tuple[str, str, str, str, str]] = [
    ("T2M",              "Air temperature (2 m)",          "درجة حرارة الهواء (2 م)",       "°C",        "MERRA-2"),
    ("T2M_MAX",          "Daily max temperature",          "درجة الحرارة العظمى اليومية",    "°C",        "MERRA-2"),
    ("T2M_MIN",          "Daily min temperature",          "درجة الحرارة الصغرى اليومية",    "°C",        "MERRA-2"),
    ("TS",               "Earth skin temperature",         "درجة حرارة سطح الأرض",          "°C",        "MERRA-2"),
    ("PRECTOTCORR",      "Precipitation",                  "هطول الأمطار",                  "mm/day",    "MERRA-2 + GPCP"),
    ("RH2M",             "Relative humidity (2 m)",        "الرطوبة النسبية (2 م)",          "%",         "MERRA-2"),
    ("QV2M",             "Specific humidity (2 m)",        "الرطوبة النوعية (2 م)",          "g/kg",      "MERRA-2"),
    ("WS10M",            "Wind speed (10 m)",              "سرعة الرياح (10 م)",            "m/s",       "MERRA-2"),
    ("ALLSKY_SFC_SW_DWN","Solar radiation at surface",     "الإشعاع الشمسي عند السطح",       "MJ/m²/day", "CERES SYN1deg"),
    ("CLOUD_AMT",        "Cloud amount",                   "نسبة الغطاء السحابي",            "%",         "CERES SYN1deg"),
    ("PS",               "Surface pressure",               "الضغط السطحي",                  "kPa",       "MERRA-2"),
]
CATALOG_INDEX: Dict[str, Tuple[str, str, str, str, str]] = {c[0]: c for c in CATALOG}

PLACES: Dict[str, Tuple[float, float]] = {
    "Ibra / إبراء (Oman)": (22.69, 58.53),
    "Muscat / مسقط (Oman)": (23.59, 58.38),
    "Salalah / صلالة (Oman)": (17.02, 54.09),
    "Sohar / صحار (Oman)": (24.35, 56.71),
    "Ibri / عبري (Oman)": (23.22, 56.52),
    "Duqm / الدقم (Oman)": (19.67, 57.70),
    "Svalbard (Arctic)": (78.2, 15.6),
    "Amazon (Brazil)": (-3.1, -60.0),
    "Sahel (Niger)": (13.5, 2.1),
    "Sydney (Australia)": (-33.9, 151.2),
}

REGIONS: Dict[str, Tuple[float, float, float, float]] = {
    # name: (lat_min, lat_max, lon_min, lon_max)  -- POWER regional limit is 10 x 10 degrees
    "Oman & neighbours / عُمان وجوارها": (16.0, 26.0, 52.0, 62.0),
    "Northern Oman / شمال عُمان": (21.0, 26.0, 55.0, 60.0),
    "Dhofar & Arabian Sea / ظفار وبحر العرب": (14.0, 20.0, 50.0, 60.0),
}


# ----------------------------------------------------------------------------
# tiny disk cache so demos never fail on weak Wi-Fi
# ----------------------------------------------------------------------------

def _cache_get(key: str):
    f = CACHE_DIR / (hashlib.sha1(key.encode()).hexdigest() + ".json")
    if f.exists():
        return json.loads(f.read_text())
    return None


def _cache_put(key: str, obj):
    f = CACHE_DIR / (hashlib.sha1(key.encode()).hexdigest() + ".json")
    f.write_text(json.dumps(obj))


def _get_json(url: str, params: dict, retries: int = 3, timeout: int = 180):
    key = url + json.dumps(params, sort_keys=True)
    hit = _cache_get(key)
    if hit is not None:
        return hit
    last = None
    for k in range(retries):
        try:
            r = requests.get(url, params=params, timeout=timeout)
            r.raise_for_status()
            data = r.json()
            _cache_put(key, data)
            return data
        except Exception as e:  # network hiccup -> back-off and retry
            last = e
            time.sleep(2 * (k + 1))
    raise RuntimeError(f"NASA POWER request failed: {last}")


# ----------------------------------------------------------------------------
# NASA POWER
# ----------------------------------------------------------------------------

def _monthly_dict_to_series(d: Dict[str, float], fill=-999.0) -> pd.Series:
    """POWER keys are YYYYMM; MM=13 is the annual mean -> drop it."""
    rows = [(pd.Timestamp(year=int(k[:4]), month=int(k[4:]), day=15), np.nan if v == fill else v)
            for k, v in d.items() if k[4:] != "13"]
    s = pd.Series(dict(rows)).sort_index()
    s.index.name = "time"
    return s


def fetch_power_point(lat: float, lon: float, params: Iterable[str],
                      start: int = 1981, end: Optional[int] = None) -> pd.DataFrame:
    """Monthly time series of several variables at one point (DataFrame, one column each)."""
    end = end or (pd.Timestamp.today().year - 1)
    q = dict(parameters=",".join(params), community="AG", longitude=lon, latitude=lat,
             start=start, end=end, format="JSON")
    js = _get_json(f"{POWER_BASE}/point", q)
    par = js["properties"]["parameter"]
    return pd.DataFrame({k: _monthly_dict_to_series(v) for k, v in par.items()})


def fetch_power_region(param: str, bbox: Tuple[float, float, float, float],
                       start: int = 1991, end: Optional[int] = None):
    """Gridded monthly field for a <=10x10 degree box.

    returns dict(lats, lons, times(DatetimeIndex), cube[time, lat, lon])
    """
    end = end or (pd.Timestamp.today().year - 1)
    lat0, lat1, lon0, lon1 = bbox
    q = {"parameters": param, "community": "AG", "latitude-min": lat0, "latitude-max": lat1,
         "longitude-min": lon0, "longitude-max": lon1, "start": start, "end": end, "format": "JSON"}
    js = _get_json(f"{POWER_BASE}/regional", q)
    feats = js["features"]
    pts, series = [], []
    for f in feats:
        lon, lat = f["geometry"]["coordinates"][:2]
        s = _monthly_dict_to_series(f["properties"]["parameter"][param])
        pts.append((lat, lon))
        series.append(s)
    lats = np.array(sorted({p[0] for p in pts}))
    lons = np.array(sorted({p[1] for p in pts}))
    times = series[0].index
    cube = np.full((len(times), len(lats), len(lons)), np.nan)
    for (lat, lon), s in zip(pts, series):
        cube[:, np.searchsorted(lats, lat), np.searchsorted(lons, lon)] = s.reindex(times).values
    return {"lats": lats, "lons": lons, "times": times, "cube": cube}


# ----------------------------------------------------------------------------
# helpers shared by point and grid workflows
# ----------------------------------------------------------------------------

def to_annual(s: pd.Series, min_months: int = 10) -> pd.Series:
    """Annual mean; a year is kept only if it has >= min_months valid months."""
    g = s.groupby(s.index.year)
    ann = g.mean()
    cnt = g.count()
    ann[cnt < min_months] = np.nan
    ann.index = ann.index.astype(float) + 0.5
    return ann


def annual_cube(times: pd.DatetimeIndex, cube: np.ndarray, min_months: int = 10):
    years = np.unique(times.year)
    out = np.full((len(years),) + cube.shape[1:], np.nan)
    for i, y in enumerate(years):
        blk = cube[times.year == y]
        ok = np.isfinite(blk).sum(axis=0) >= min_months
        with np.errstate(all="ignore"):
            m = np.nanmean(blk, axis=0)
        out[i] = np.where(ok, m, np.nan)
    return years.astype(float) + 0.5, out


def load_csv(path_or_buffer, time_col: Optional[str] = None, value_col: Optional[str] = None) -> pd.Series:
    """Load a user CSV (first column = date/year, second = value by default)."""
    df = pd.read_csv(path_or_buffer)
    time_col = time_col or df.columns[0]
    value_col = value_col or df.columns[1]
    t = df[time_col]
    if np.issubdtype(t.dtype, np.number) and t.max() < 3000:
        idx = pd.to_datetime(t.astype(int).astype(str) + "-07-01")
    else:
        idx = pd.to_datetime(t)
    s = pd.Series(df[value_col].astype(float).values, index=idx).sort_index()
    s.index.name = "time"
    return s


def load_earthaccess_netcdf(short_name: str, variable: str, bbox, temporal, workdir="data/raw"):
    """OPTIONAL: download granules with NASA Earthdata login and open as xarray.

    bbox = (west, south, east, north); temporal = ("2003-01-01", "2024-12-31").
    Requires:  pip install earthaccess xarray netcdf4   and   earthaccess.login()
    """
    import earthaccess  # imported lazily so the demo works without it
    import xarray as xr
    earthaccess.login()
    res = earthaccess.search_data(short_name=short_name, bounding_box=bbox, temporal=temporal)
    files = earthaccess.download(res, workdir)
    ds = xr.open_mfdataset(files, combine="by_coords")
    return ds[variable]
