# Flood Guard

A Ghana-focused web app that lets users check flood risk for Ghana locations or their current position and view the area on an interactive map.

## How it works

- Geocodes search text in Ghana using Open-Meteo geocoding with OpenStreetMap fallback.
- Includes landmark aliases for better neighborhood matching (for example, Circle and Aboabo).
- Reads current location with browser geolocation and checks if it is in Ghana.
- Falls back to approximate IP-based location if GPS is unavailable.
- Fetches 3-day forecast metrics from Open-Meteo forecast API.
- Fetches recent historical weather (last 14 days) from Open-Meteo archive API.
- Scores risk using:
  - maximum hourly precipitation
  - maximum daily precipitation
  - average top-layer soil moisture
  - antecedent rainfall total (past 14 days)
  - historical average soil moisture
- Updates location results on an interactive Leaflet + OpenStreetMap map.
- Shows a live-updated list of known Ghana flood hotspots sorted by current risk.
- Includes a flood-incidence report box and saves reports in browser local storage for future display.
- Includes a `Flood Photo Reports` page where users can capture/upload flood images, add location, and auto-map saved reports.
- Includes quick-menu pages for `Settings`, `Notifications`, `Saved Alerts`, `Help & Support`, and `About App`.

## Run locally

Open `index.html` directly in your browser, or serve this folder with any static server.

For best geolocation behavior, run a local server instead of opening with `file://`.

Example options:

- `python -m http.server 5500`
- VS Code/Cursor Live Server extension

## Notes

- This app provides an **informational estimate**, not an official emergency warning.
- For life-critical decisions, always follow official Ghana authorities such as NADMO.
