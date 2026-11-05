import os
import re
import threading
import time

import joblib

from . import config
from .config import MODEL_VERSION, MODEL_MAX_AGE_SECONDS, logger
from .database import load_history
from .features import build_training_frame
from .model import evaluate_and_train

_locks: dict = {}
_locks_guard = threading.Lock()
_refreshing: set = set()


def _lock_for(barrage: str) -> threading.Lock:
    with _locks_guard:
        return _locks.setdefault(barrage, threading.Lock())


def model_path(barrage: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", barrage.lower()).strip("_")
    return os.path.join(str(config.MODEL_DIR), f"{slug}.joblib")


def _load(path: str):
    if not os.path.exists(path):
        return None
    try:
        bundle = joblib.load(path)
        if bundle.get("version") != MODEL_VERSION or bundle.get("features") != config.FEATURES:
            logger.info("Modèle %s obsolète (version/features) -> ré-entraînement", path)
            return None
        return bundle
    except Exception as exc:
        logger.warning("Modèle illisible %s : %s", path, exc)
        return None


def train_and_save(barrage: str) -> dict:
    logger.info("Entraînement du modèle pour %s...", barrage)
    df = build_training_frame(load_history(barrage))
    bundle = evaluate_and_train(df, barrage)

    os.makedirs(str(config.MODEL_DIR), exist_ok=True)
    path = model_path(barrage)
    tmp = f"{path}.{os.getpid()}.tmp"
    joblib.dump(bundle, tmp)
    os.replace(tmp, path)
    return bundle


def _refresh_in_background(barrage: str) -> None:
    with _locks_guard:
        if barrage in _refreshing:
            return
        _refreshing.add(barrage)

    def job():
        try:
            with _lock_for(barrage):
                train_and_save(barrage)
        except Exception as exc:
            logger.error("Ré-entraînement en arrière-plan échoué pour %s : %s", barrage, exc)
        finally:
            with _locks_guard:
                _refreshing.discard(barrage)

    threading.Thread(target=job, daemon=True, name=f"retrain-{barrage}").start()


def get_bundle(barrage: str) -> dict:
    path = model_path(barrage)
    bundle = _load(path)
    if bundle is not None:
        if time.time() - bundle["trained_at"] > MODEL_MAX_AGE_SECONDS:
            _refresh_in_background(barrage)
        return bundle

    with _lock_for(barrage):
        bundle = _load(path)
        if bundle is None:
            bundle = train_and_save(barrage)
    return bundle