# Accès à la base Neon PostgreSQLimport threading
import threading

import pandas as pd

from .config import TABLE_NAME, get_database_url, logger

_engine = None
_engine_lock = threading.Lock()

REQUIRED_COLUMNS = ["date", "taux_remplissage", "precipitation_mm", "temp_max_c"]


def get_engine():
    """Engine SQLAlchemy unique (pool partagé). Import paresseux de SQLAlchemy."""
    global _engine
    if _engine is None:
        with _engine_lock:
            if _engine is None:
                from sqlalchemy import create_engine

                _engine = create_engine(
                    get_database_url(),
                    pool_pre_ping=True,   #
                    pool_recycle=300,
                    pool_size=5,
                    max_overflow=5,
                )
    return _engine


def load_history(barrage: str) -> pd.DataFrame:
    """Charge, valide et nettoie l'historique d'un barrage (requête paramétrée)."""
    from sqlalchemy import text

    query = text(
        f"SELECT * FROM {TABLE_NAME} WHERE barrage = :barrage ORDER BY date ASC"
    )
    df = pd.read_sql(query, get_engine(), params={"barrage": barrage})

    if df.empty:
        raise ValueError(f"Aucune donnée pour le barrage : {barrage} dans la table {TABLE_NAME}.")
    return clean_history(df, barrage)


def clean_history(df: pd.DataFrame, barrage: str = "") -> pd.DataFrame:
    """Validation + nettoyage (séparé de la requête pour être testable)."""
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"Colonnes manquantes dans {TABLE_NAME} : {missing}")

    df = df.copy()
    df["date"] = pd.to_datetime(df["date"]).dt.tz_localize(None).dt.normalize()
    for col in ("taux_remplissage", "precipitation_mm", "temp_max_c"):
        df[col] = pd.to_numeric(df[col], errors="coerce")

    before = len(df)
    df = df.dropna(subset=["date", "taux_remplissage"])
    df = df[(df["taux_remplissage"] >= 0) & (df["taux_remplissage"] <= 100)]
    df = df.drop_duplicates(subset="date", keep="last").sort_values("date")
    if len(df) < before:
        logger.info("%s : %d lignes invalides/dupliquées ignorées", barrage, before - len(df))

    if df.empty:
        raise ValueError(f"Aucune donnée exploitable pour le barrage : {barrage}")
    return df.reset_index(drop=True)
