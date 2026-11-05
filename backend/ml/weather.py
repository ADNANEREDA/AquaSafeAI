import time

import numpy as np
import pandas as pd
import requests

from .config import TIMEZONE, logger

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
MAX_PAST_DAYS = 92
MAX_FORECAST_DAYS = 16
RETRIES = 3
CACHE_TTL_SECONDS = 3600

_cache: dict = {}


class WeatherUnavailableError(RuntimeError):
    #Impossible de récupérer la météo (Open-Meteo indisponible
    pass

def fetch_weather(lat: float, lon: float, past_days: int, forecast_days: int) -> pd.DataFrame:
    past_days = max(0, min(int(past_days), MAX_PAST_DAYS))
    forecast_days = max(1, min(int(forecast_days), MAX_FORECAST_DAYS))

    key = (round(lat, 3), round(lon, 3), past_days, forecast_days, pd.Timestamp.now().date())
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < CACHE_TTL_SECONDS:
        return hit[1].copy()

    params = {
        "latitude": lat,
        "longitude": lon,
        "daily": "precipitation_sum,temperature_2m_max",
        "timezone": TIMEZONE,
        "forecast_days": forecast_days,
    }
    if past_days > 0:
        params["past_days"] = past_days

    last_exc = None
    for attempt in range(RETRIES):
        try:
            resp = requests.get(OPEN_METEO_URL, params=params, timeout=10)
            resp.raise_for_status()
            d = resp.json()["daily"]
            w = pd.DataFrame({
                "date": pd.to_datetime(d["time"]),
                "precipitation_mm": pd.to_numeric(d["precipitation_sum"], errors="coerce"),
                "temp_max_c": pd.to_numeric(d["temperature_2m_max"], errors="coerce"),
            })
            _cache[key] = (time.time(), w)
            return w.copy()
        except (requests.RequestException, KeyError, ValueError) as exc:
            last_exc = exc
            logger.warning("Open-Meteo tentative %d/%d échouée : %s", attempt + 1, RETRIES, exc)
            if attempt < RETRIES - 1:
                time.sleep(0.5 * 2 ** attempt)
    raise WeatherUnavailableError(f"Open-Meteo indisponible : {last_exc}") from last_exc


def climatology(hist: pd.DataFrame, dates) -> pd.DataFrame:
    dates = pd.DatetimeIndex(dates, name="date")
    h = hist.dropna(subset=["precipitation_mm", "temp_max_c"])
    hd = h["date"].dt.dayofyear.to_numpy()
    p = h["precipitation_mm"].to_numpy(dtype=float)
    t = h["temp_max_c"].to_numpy(dtype=float)
    global_p = float(p.mean()) if len(p) else 0.0
    global_t = float(t.mean()) if len(t) else 20.0

    rows = []
    for d in dates:
        diff = np.abs(hd - d.dayofyear)
        diff = np.minimum(diff, 365 - diff)
        m = diff <= 7
        rows.append((float(p[m].mean()), float(t[m].mean())) if m.any() else (global_p, global_t))
    return pd.DataFrame(rows, index=dates, columns=["precipitation_mm", "temp_max_c"])


def get_weather_for_period(hist, lat, lon, last_date, today, end_date):
   
    needed = pd.date_range(last_date + pd.Timedelta(days=1), end_date, freq="D")
    gap = max(0, (today - last_date).days)
    forecast_days = (end_date - today).days + 1
    cols = ["precipitation_mm", "temp_max_c"]

    source = "open-meteo"
    try:
        raw = fetch_weather(lat, lon, gap, forecast_days)
        w = raw.drop_duplicates("date").set_index("date").reindex(needed)
    except WeatherUnavailableError as exc:
        logger.error("%s -> repli sur la climatologie", exc)
        w = pd.DataFrame(np.nan, index=needed, columns=cols)
        source = "climatology"
    w.index.name = "date"

    if w[cols].isna().any().any():
        clim = climatology(hist, needed)
        for col in cols:
            w[col] = w[col].fillna(clim[col])
        if source == "open-meteo":
            source = "open-meteo+climatology"
    return w.reset_index(), source
