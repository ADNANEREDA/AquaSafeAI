import numpy as np
import pandas as pd

from .config import FEATURES


def complete_daily(w: pd.DataFrame) -> pd.DataFrame:
    #Complète les jours manquants (index date) et normalise les colonnes
    w = w.drop_duplicates("date", keep="last").set_index("date").sort_index().asfreq("D")
    w["precipitation_mm"] = w["precipitation_mm"].fillna(0.0).clip(lower=0.0)
    w["temp_max_c"] = w["temp_max_c"].ffill().bfill()
    return w.reset_index()


def add_weather_features(w: pd.DataFrame) -> pd.DataFrame:
    w = w.sort_values("date").reset_index(drop=True).copy()
    p = w["precipitation_mm"]
    w["rain_3d"] = p.rolling(3, min_periods=1).sum()
    w["rain_7d"] = p.rolling(7, min_periods=1).sum()
    w["rain_14d"] = p.rolling(14, min_periods=1).sum()

    doy = w["date"].dt.dayofyear
    w["doy_sin"] = np.sin(2 * np.pi * doy / 365.25)
    w["doy_cos"] = np.cos(2 * np.pi * doy / 365.25)
    return w


def build_training_frame(hist: pd.DataFrame) -> pd.DataFrame:
    df = complete_daily(hist)
    df = add_weather_features(df)
    df["taux_veille"] = df["taux_remplissage"].shift(1)
    df["delta_taux"] = df["taux_remplissage"] - df["taux_veille"]
    return df.dropna(subset=FEATURES + ["delta_taux"]).reset_index(drop=True)
