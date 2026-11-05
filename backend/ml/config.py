# Configuration centrale du pipeline ML 
import logging
import os
from pathlib import Path

from dotenv import load_dotenv

logger = logging.getLogger("barrages.ml")

PACKAGE_DIR = Path(__file__).resolve().parent

for _candidate in (
    PACKAGE_DIR / ".env",
    PACKAGE_DIR.parent / ".env",
    PACKAGE_DIR.parent.parent / ".env",
):
    if _candidate.exists():
        load_dotenv(_candidate)

MODEL_DIR = Path(os.getenv("MODEL_DIR", PACKAGE_DIR / "models"))

TABLE_NAME = "historique_barrages"
TIMEZONE = "Africa/Casablanca"

DAMS_CONFIG = {
    "Al Wahda": {"lat": 34.60, "lon": -5.40},
    "Al Massira": {"lat": 32.48, "lon": -7.65},
    "Bin El Ouidane": {"lat": 32.10, "lon": -6.45},
    "Idriss Ier": {"lat": 34.07, "lon": -4.62},
    "Oued El Makhazine": {"lat": 35.00, "lon": -5.85},
    "Mansour Eddahbi": {"lat": 30.62, "lon": -6.75},
}

FEATURES = [
    "taux_veille", "precipitation_mm", "rain_3d", "rain_7d", "rain_14d",
    "temp_max_c", "doy_sin", "doy_cos",
]

# Contraintes de monotonie physiques 
MONOTONIC = {
    "taux_veille": 0, "precipitation_mm": 1, "rain_3d": 1, "rain_7d": 1,
    "rain_14d": 1, "temp_max_c": -1, "doy_sin": 0, "doy_cos": 0,
}

MIN_LEVEL, MAX_LEVEL = 0.0, 100.0

MODEL_VERSION = 2                 
MODEL_MAX_AGE_SECONDS = 86400     
MIN_TRAIN_ROWS = 120             
MAX_HORIZON = 16                  
STALE_WARNING_DAYS = 3            


def get_database_url() -> str:
    """Lit DATABASE_URL (lazy, pour ne pas planter à l'import)."""
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL introuvable : vérifie ton fichier .env")
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    return url


def resolve_dam_name(name: str) -> str:
    """Retrouve le nom canonique d'un barrage (insensible à la casse / espaces)."""
    wanted = (name or "").strip().lower()
    for canonical in DAMS_CONFIG:
        if canonical.lower() == wanted:
            return canonical
    raise ValueError(f"Barrage inconnu : {name}")
