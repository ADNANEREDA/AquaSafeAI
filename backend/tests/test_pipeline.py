import os
import sys
import tempfile
import unittest
from unittest import mock

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ml import config, predict, store, weather  
from ml.database import clean_history  
from ml.features import build_training_frame  

def synthetic_history(days=900, gap=5, seed=0):
    rng = np.random.default_rng(seed)
    today = pd.Timestamp.now(tz=config.TIMEZONE).normalize().tz_localize(None)
    end = today - pd.Timedelta(days=gap)
    dates = pd.date_range(end=end, periods=days, freq="D")
    doy = dates.dayofyear.to_numpy()
    rain = rng.exponential(2.0, days) * (rng.random(days) < 0.25) * (1 + np.cos(2 * np.pi * doy / 365))
    temp = 22 + 10 * np.sin(2 * np.pi * (doy - 100) / 365) + rng.normal(0, 1.5, days)
    level, lv = 50.0, []
    for r, t in zip(rain, temp):
        level = float(np.clip(level + 0.45 * r - 0.025 * max(t - 12, 0) + rng.normal(0, 0.02), 0, 100))
        lv.append(level)
    return pd.DataFrame({"date": dates, "taux_remplissage": lv,
                         "precipitation_mm": rain, "temp_max_c": temp})


def fake_fetch(lat, lon, past_days, forecast_days):
    today = pd.Timestamp.now(tz=config.TIMEZONE).normalize().tz_localize(None)
    dates = pd.date_range(today - pd.Timedelta(days=past_days), periods=past_days + forecast_days)
    return pd.DataFrame({"date": dates, "precipitation_mm": 1.0, "temp_max_c": 25.0})


class PipelineTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        p = [
            mock.patch.object(config, "MODEL_DIR", self.tmp.name),
            mock.patch("ml.store.load_history", side_effect=lambda b: synthetic_history()),
            mock.patch("ml.predict.load_history", side_effect=lambda b: synthetic_history()),
            mock.patch("ml.weather.fetch_weather", side_effect=fake_fetch),
        ]
        for x in p:
            x.start()
            self.addCleanup(x.stop)

    def test_dates_are_real_not_shifted(self):
        hist = synthetic_history(gap=5)
        rep = predict.get_prediction_report("Al Wahda", horizon=7)
        self.assertEqual(rep["meta"]["gap_days"], 5)
        self.assertTrue(rep["meta"]["data_is_stale"])
        self.assertEqual(rep["meta"]["last_observation_date"], hist["date"].iloc[-1].strftime("%Y-%m-%d"))
        hist_dates = [d["date"] for d in rep["data"] if d["historique"] is not None]
        self.assertEqual(hist_dates[-1], hist["date"].iloc[-1].strftime("%Y-%m-%d"))
        preds = [d for d in rep["data"] if d["historique"] is None]
        self.assertEqual(len(preds), 12)
        dates = pd.to_datetime([d["date"] for d in rep["data"]])
        self.assertTrue((np.diff(dates.values).astype("timedelta64[D]").astype(int) == 1).all())

    def test_output_format_and_bounds(self):
        out = predict.get_real_predictions("al wahda", 2.0, 150.0, 7)
        self.assertIsInstance(out, list)
        for d in out:
            if d["historique"] is None:
                self.assertTrue(0 <= d["prevision_low"] <= d["prevision"] <= d["prevision_high"] <= 100)
                self.assertTrue({"date", "prevision", "rain", "temp"} <= d.keys())
        self.assertIsNotNone(out[7]["prevision"])

    def test_stress_test_only_affects_future(self):
        rep = predict.get_prediction_report("Al Wahda", rain_multiplier=200, temp_delta=3, horizon=7)
        preds = [d for d in rep["data"] if d["historique"] is None]
        self.assertEqual(preds[0]["rain"], 1.0)
        self.assertEqual(preds[-1]["rain"], 2.0)
        self.assertEqual(preds[-1]["temp"], 28.0)

    def test_weather_failure_falls_back_to_climatology(self):
        with mock.patch("ml.weather.fetch_weather", side_effect=weather.WeatherUnavailableError("down")):
            rep = predict.get_prediction_report("Al Wahda", horizon=5)
        self.assertEqual(rep["meta"]["weather_source"], "climatology")
        self.assertTrue(all(d["prevision"] is not None for d in rep["data"][7:]))

    def test_model_cache_and_training_metrics(self):
        b1 = store.get_bundle("Al Wahda")
        self.assertIn("skill_vs_persistence", b1["metrics"])
        with mock.patch("ml.store.train_and_save", side_effect=AssertionError("ne doit pas réentraîner")):
            b2 = store.get_bundle("Al Wahda")
        self.assertEqual(b1["trained_at"], b2["trained_at"])

    def test_stale_model_served_immediately(self):
        b = store.get_bundle("Al Wahda")
        b["trained_at"] -= 10 * 86400
        import joblib
        joblib.dump(b, store.model_path("Al Wahda"))
        with mock.patch("ml.store._refresh_in_background") as refresh:
            served = store.get_bundle("Al Wahda")
        refresh.assert_called_once()
        self.assertIsNotNone(served["model"])

    def test_missing_days_do_not_corrupt_delta(self):
        h = synthetic_history()
        h2 = h.drop(index=range(100, 110)).reset_index(drop=True)
        df = build_training_frame(h2)
        by_date = h2.set_index("date")["taux_remplissage"]
        for _, r in df.iterrows():
            self.assertAlmostEqual(r["taux_veille"], by_date[r["date"] - pd.Timedelta(days=1)])
        gap_day = h["date"].iloc[110]
        self.assertNotIn(gap_day, set(df["date"]))

    def test_clean_history(self):
        raw = pd.DataFrame({
            "date": ["2024-01-02", "2024-01-01", "2024-01-01", "2024-01-03"],
            "taux_remplissage": [50, 40, 41, 150],
            "precipitation_mm": [0, 1, 2, 3], "temp_max_c": [10, 11, 12, 13],
        })
        c = clean_history(raw)
        self.assertEqual(len(c), 2)
        self.assertEqual(c["taux_remplissage"].tolist(), [41, 50])
        with self.assertRaises(ValueError):
            clean_history(raw.drop(columns=["temp_max_c"]))

    def test_unknown_dam_and_injection_string(self):
        with self.assertRaises(ValueError):
            predict.get_real_predictions("x'; DROP TABLE historique_barrages;--")


if __name__ == "__main__":
    unittest.main()