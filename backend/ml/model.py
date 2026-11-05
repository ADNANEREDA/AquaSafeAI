import time
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.model_selection import TimeSeriesSplit

from .config import FEATURES, MIN_TRAIN_ROWS, MODEL_VERSION, MONOTONIC, logger


def make_model() -> HistGradientBoostingRegressor:
    return HistGradientBoostingRegressor(
        loss="absolute_error",
        max_depth=4,
        learning_rate=0.05,
        max_iter=300,
        min_samples_leaf=20,
        l2_regularization=1.0,
        monotonic_cst=[MONOTONIC[f] for f in FEATURES],
        random_state=42,
    )


def evaluate_and_train(df: pd.DataFrame, barrage: str = "") -> dict:
    if len(df) < MIN_TRAIN_ROWS:
        raise ValueError(
            f"{barrage} : {len(df)} jours exploitables, minimum requis = {MIN_TRAIN_ROWS}"
        )

    X, y = df[FEATURES], df["delta_taux"]
    tscv = TimeSeriesSplit(n_splits=5 if len(df) >= 300 else 3)

    y_true_folds, y_pred_folds, mae_base = [], [], []
    for tr, te in tscv.split(X):
        m = make_model().fit(X.iloc[tr], y.iloc[tr])
        y_t = y.iloc[te].to_numpy()
        y_p = m.predict(X.iloc[te])
        y_true_folds.append(y_t)
        y_pred_folds.append(y_p)
        mae_base.append(float(np.mean(np.abs(y_t))))

    best_alpha = 1.0
    best_mae = float("inf")
    for alpha in np.linspace(0.05, 1.0, 20):
        fold_maes = [
            float(np.mean(np.abs(yt - alpha * yp)))
            for yt, yp in zip(y_true_folds, y_pred_folds)
        ]
        mean_mae = float(np.mean(fold_maes))
        if mean_mae < best_mae - 1e-6:
            best_mae = mean_mae
            best_alpha = float(round(alpha, 2))

    resid, mae_model, rmse_model = [], [], []
    for yt, yp in zip(y_true_folds, y_pred_folds):
        err = yt - (best_alpha * yp)
        resid.append(err)
        mae_model.append(float(np.mean(np.abs(err))))
        rmse_model.append(float(np.sqrt(np.mean(err ** 2))))

    residuals = np.concatenate(resid)
    mae_m, mae_b = float(np.mean(mae_model)), float(np.mean(mae_base))
    skill = 1.0 - mae_m / mae_b if mae_b > 0 else float("nan")
    metrics = {
        "mae_delta": mae_m,
        "rmse_delta": float(np.mean(rmse_model)),
        "mae_baseline": mae_b,
        "skill_vs_persistence": skill,
        "damping_alpha": best_alpha,
    }
    logger.info(
        "%s : MAE=%.4f | baseline=%.4f | gain=%.1f%% (alpha=%.2f)",
        barrage, mae_m, mae_b, 100 * skill if np.isfinite(skill) else float("nan"), best_alpha,
    )

    mad = float(np.median(np.abs(residuals - np.median(residuals))))
    robust_bound = 1.96 * 1.4826 * mad if mad > 0 else float(np.std(residuals))

    model = make_model().fit(X, y)
    return {
        "version": MODEL_VERSION,
        "features": list(FEATURES),
        "model": model,
        "damping": best_alpha,
        "resid_std": float(np.std(residuals)),
        "resid_q_low": -robust_bound,
        "resid_q_high": robust_bound,
        "metrics": metrics,
        "n_rows": int(len(df)),
        "last_data_date": str(df["date"].max().date()),
        "trained_at": time.time(),
    }