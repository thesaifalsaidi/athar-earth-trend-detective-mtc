# ATHAR website

Static, dependency-free site (HTML + CSS + vanilla JS). The statistics run in the browser (`js/engine.js`, a port of `athar/stats_engine.py`; results match the Python engine) on annual NASA POWER data bundled in `data/series.json`, so it works offline.

Run locally:  `python3 -m http.server 8000`  then open http://localhost:8000
Deploy: drag the `site/` folder to Netlify, Vercel or GitHub Pages (no build step).

Pages: Home, Platform (triage, case file, compare places, honesty lab, your own data), Method, About. Arabic (RTL) and English.
Refresh data: run the export snippet in the project notes (uses `athar.data_sources.fetch_power_point`).
