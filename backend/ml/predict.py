import numpy as np
import pandas as pd

from .config import (
    DAMS_CONFIG, FEATURES, MAX_HORIZON, MAX_LEVEL, MIN_LEVEL, STALE_WARNING_DAYS,
    TIMEZONE, logger, resolve_dam_name,
)
from .database import load_history
from .features import add_weather_features, complete_daily
from .store import get_bundle
from .weather import get_weather_for_period


def _num(x, ndigits):
    if x is None or not np.isfinite(x):
        return None
    return round(float(x), ndigits)


def _step(model, row: pd.Series, level: float, damping: float = 1.0) -> float:
    feats = row.reindex(FEATURES).astype(float)
    feats["taux_veille"] = level
    x = pd.DataFrame([feats.to_dict()])[FEATURES]
    delta = float(model.predict(x)[0]) * damping
    return float(np.clip(level + delta, MIN_LEVEL, MAX_LEVEL))


def get_prediction_report(
    barrage_name: str,
    temp_delta: float = 0.0,
    rain_multiplier: float = 100.0,
    horizon: int = 7,
) -> dict:
    name = resolve_dam_name(barrage_name)
    horizon = int(max(1, min(int(horizon), MAX_HORIZON)))
    rain_factor = max(0.0, float(rain_multiplier)) / 100.0
    temp_delta = float(temp_delta)

    bundle = get_bundle(name)
    model = bundle["model"]
    hist = load_history(name)

    today = pd.Timestamp.now(tz=TIMEZONE).normalize().tz_localize(None)
    last_date = hist["date"].iloc[-1]
    if last_date > today:
        today = last_date
    gap = int((today - last_date).days)
    end_date = today + pd.Timedelta(days=horizon)

    if gap > STALE_WARNING_DAYS:
        logger.warning(
            "%s : dernier relevé du %s (%d jours de retard) -> simulation depuis cette date",
            name, last_date.date(), gap,
        )

    coords = DAMS_CONFIG[name]
    fut, weather_source = get_weather_for_period(
        hist, coords["lat"], coords["lon"], last_date, today, end_date
    )

    future_mask = fut["date"] > today
    fut.loc[future_mask, "precipitation_mm"] *= rain_factor
    fut.loc[future_mask, "temp_max_c"] += temp_delta

    cols = ["date", "precipitation_mm", "temp_max_c"]
    weather = pd.concat([hist[cols], fut[cols]], ignore_index=True)
    weather = add_weather_features(complete_daily(weather))
    sim = weather[weather["date"] > last_date].reset_index(drop=True)

    recent = hist.tail(8)
    data = []
    for i, (_, r) in enumerate(recent.iterrows()):
        is_last = i == len(recent) - 1
        val = _num(r["taux_remplissage"], 2)
        item = {
            "date": r["date"].strftime("%Y-%m-%d"),
            "historique": val,
            "prevision": val if is_last else None,
        }
        if is_last:
            item["rain"] = _num(r["precipitation_mm"], 1)
            item["temp"] = _num(r["temp_max_c"], 1)
        data.append(item)

    level = float(hist["taux_remplissage"].iloc[-1])
    damping = float(bundle.get("damping", 1.0))
    q_low = bundle.get("resid_q_low", -1.96 * bundle["resid_std"])
    q_high = bundle.get("resid_q_high", 1.96 * bundle["resid_std"])

    for k, row in sim.iterrows():
        level = _step(model, row, level, damping)
        scale = np.sqrt(k + 1)
        low = max(MIN_LEVEL, min(level, level + q_low * scale))
        high = min(MAX_LEVEL, max(level, level + q_high * scale))
        data.append({
            "date": row["date"].strftime("%Y-%m-%d"),
            "historique": None,
            "prevision": _num(level, 2),
            "prevision_low": _num(low, 2),
            "prevision_high": _num(high, 2),
            "rain": _num(row["precipitation_mm"], 1),
            "temp": _num(row["temp_max_c"], 1),
        })

    meta = {
        "barrage": name,
        "today": today.strftime("%Y-%m-%d"),
        "last_observation_date": last_date.strftime("%Y-%m-%d"),
        "gap_days": gap,
        "data_is_stale": gap > STALE_WARNING_DAYS,
        "weather_source": weather_source,
        "horizon": horizon,
        "rain_multiplier": float(rain_multiplier),
        "temp_delta": temp_delta,
        "model_metrics": bundle.get("metrics", {}),
        "model_trained_at": bundle.get("trained_at"),
    }
    return {"data": data, "meta": meta}


def get_real_predictions(
    barrage_name: str,
    temp_delta: float = 0.0,
    rain_multiplier: float = 100.0,
    horizon: int = 7,
):
    return get_prediction_report(barrage_name, temp_delta, rain_multiplier, horizon)["data"]