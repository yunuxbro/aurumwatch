import math

import numpy as np
import pandas as pd

from clean import market_daily

GRAMS_PER_TROY_OUNCE = 31.1035
GRAMS_PER_SOVEREIGN = 8.0
KARAT = 22
DEFAULT_HORIZON = 7
MINIMUM_SAMPLES = 300
ALPHAS = (0.01, 0.1, 1.0, 10.0, 100.0)
FEATURE_LAGS = (0, 1, 2, 4, 9)
ROLLING_WINDOWS = (5, 20, 60)


def build_supervised_data(market, horizon=DEFAULT_HORIZON):
    """Build causal features and future log-return targets from aligned market rows."""
    required = {"date", "usd_oz", "lkr_per_usd"}
    if not required.issubset(market.columns):
        raise ValueError(f"Market data is missing columns: {sorted(required - set(market.columns))}")
    if horizon < 1:
        raise ValueError("Forecast horizon must be at least one market observation")

    frame = market.loc[:, ["date", "usd_oz", "lkr_per_usd"]].copy()
    frame["date"] = pd.to_datetime(frame["date"], errors="coerce")
    frame["usd_oz"] = pd.to_numeric(frame["usd_oz"], errors="coerce")
    frame["lkr_per_usd"] = pd.to_numeric(frame["lkr_per_usd"], errors="coerce")
    frame = (
        frame.dropna(subset=["date", "usd_oz", "lkr_per_usd"])
        .loc[lambda data: (data["usd_oz"] > 0) & (data["lkr_per_usd"] > 0)]
        .drop_duplicates("date", keep="last")
        .sort_values("date")
        .reset_index(drop=True)
    )
    if len(frame) <= horizon:
        raise ValueError("Not enough valid market observations for the forecast horizon")

    gold_log = np.log(frame["usd_oz"])
    fx_log = np.log(frame["lkr_per_usd"])
    benchmark_log = (
        gold_log
        + fx_log
        + math.log(GRAMS_PER_SOVEREIGN * KARAT / 24 / GRAMS_PER_TROY_OUNCE)
    )
    returns = {
        "gold": gold_log.diff(),
        "fx": fx_log.diff(),
        "benchmark": benchmark_log.diff(),
    }

    features = {}
    for series_name in ("gold", "fx", "benchmark"):
        series = returns[series_name]
        for lag in FEATURE_LAGS:
            features[f"{series_name}_return_lag_{lag}"] = series.shift(lag)
        for window in ROLLING_WINDOWS:
            rolling = series.rolling(window, min_periods=window)
            features[f"{series_name}_return_mean_{window}"] = rolling.mean()
            features[f"{series_name}_return_volatility_{window}"] = rolling.std(ddof=0)

    feature_frame = pd.DataFrame(features)
    target = benchmark_log.shift(-horizon) - benchmark_log
    valid = feature_frame.notna().all(axis=1)
    samples = feature_frame.loc[valid].copy()
    samples["target"] = target.loc[valid]
    samples["date"] = frame.loc[valid, "date"]
    samples = samples.dropna(subset=["target"]).reset_index(drop=True)

    latest_feature_row = feature_frame.iloc[-1]
    latest_features = latest_feature_row.to_numpy(dtype=float)
    if not np.isfinite(latest_features).all():
        raise ValueError("Latest market observations do not cover the feature lookback window")

    return {
        "features": samples[feature_frame.columns].to_numpy(dtype=float),
        "targets": samples["target"].to_numpy(dtype=float),
        "dates": samples["date"].dt.strftime("%Y-%m-%d").to_numpy(),
        "feature_names": list(feature_frame.columns),
        "latest_features": latest_features,
        "latest_date": frame["date"].iloc[-1].strftime("%Y-%m-%d"),
        "latest_benchmark_lkr_per_8g": float(np.exp(benchmark_log.iloc[-1])),
        "source_rows": len(frame),
        "excluded_rows": int(len(market) - len(frame)),
    }


def chronological_splits(sample_count, horizon=DEFAULT_HORIZON):
    """Create chronological 70/15/15 splits with a horizon-sized label embargo."""
    if sample_count <= horizon * 3:
        raise ValueError("Not enough samples to create purged chronological splits")
    train_boundary = int(sample_count * 0.70)
    validation_boundary = int(sample_count * 0.85)
    train = np.arange(0, max(0, train_boundary - horizon))
    validation = np.arange(train_boundary, max(train_boundary, validation_boundary - horizon))
    test = np.arange(validation_boundary, sample_count)
    if min(len(train), len(validation), len(test)) == 0:
        raise ValueError("Chronological split produced an empty partition")
    return {
        "train": train,
        "validation": validation,
        "test": test,
        "train_boundary": train_boundary,
        "validation_boundary": validation_boundary,
    }


def fit_ridge(features, targets, alpha):
    """Fit standardized ridge regression, fitting scaling only on supplied rows."""
    x = np.asarray(features, dtype=float)
    y = np.asarray(targets, dtype=float)
    if x.ndim != 2 or y.ndim != 1 or len(x) != len(y) or len(y) == 0:
        raise ValueError("Ridge training data must be a non-empty feature matrix and target vector")
    if alpha < 0 or not np.isfinite(x).all() or not np.isfinite(y).all():
        raise ValueError("Ridge training data and alpha must be finite and valid")

    mean = x.mean(axis=0)
    scale = x.std(axis=0)
    scale[scale < 1e-12] = 1.0
    standardized = (x - mean) / scale
    target_mean = float(y.mean())
    regularized = standardized.T @ standardized + alpha * np.eye(x.shape[1])
    coefficients = np.linalg.solve(regularized, standardized.T @ (y - target_mean))
    return {
        "mean": mean,
        "scale": scale,
        "coefficients": coefficients,
        "intercept": target_mean,
    }


def predict_ridge(model, features):
    x = np.asarray(features, dtype=float)
    standardized = (x - model["mean"]) / model["scale"]
    return model["intercept"] + standardized @ model["coefficients"]


def _metrics(actual, predicted):
    actual = np.asarray(actual, dtype=float)
    predicted = np.asarray(predicted, dtype=float)
    return {
        "mae_bps": float(np.mean(np.abs(actual - predicted)) * 10_000),
        "rmse_bps": float(np.sqrt(np.mean(np.square(actual - predicted))) * 10_000),
        "directional_accuracy": float(np.mean(np.sign(actual) == np.sign(predicted))),
    }


def _block_bootstrap_mae_difference(actual, model_prediction, baseline_prediction, horizon, seed=42):
    """Paired moving-block bootstrap of model-minus-baseline absolute error."""
    actual = np.asarray(actual, dtype=float)
    model_error = np.abs(actual - model_prediction)
    baseline_error = np.abs(actual - baseline_prediction)
    differences = model_error - baseline_error
    n = len(differences)
    if n < horizon:
        difference = float(np.mean(differences) * 10_000)
        return [difference, difference]

    rng = np.random.default_rng(seed)
    blocks_per_sample = math.ceil(n / horizon)
    starts = np.arange(n - horizon + 1)
    estimates = np.empty(1000)
    for index in range(len(estimates)):
        selected_starts = rng.choice(starts, size=blocks_per_sample, replace=True)
        sample = np.concatenate([
            differences[start:start + horizon] for start in selected_starts
        ])[:n]
        estimates[index] = sample.mean() * 10_000
    lower, upper = np.quantile(estimates, [0.025, 0.975])
    return [float(lower), float(upper)]


def train_market_forecast(market, horizon=DEFAULT_HORIZON, alphas=ALPHAS):
    """Tune ridge on validation, evaluate on a purged holdout, and refit for production."""
    data = build_supervised_data(market, horizon)
    features = data["features"]
    targets = data["targets"]
    dates = data["dates"]
    if len(targets) < MINIMUM_SAMPLES:
        raise ValueError(
            f"Need at least {MINIMUM_SAMPLES} labeled market samples; found {len(targets)}"
        )

    splits = chronological_splits(len(targets), horizon)
    train_idx = splits["train"]
    validation_idx = splits["validation"]
    test_idx = splits["test"]
    baseline_validation = np.zeros(len(validation_idx))
    validation_scores = []
    selected_alpha = None
    best_model = None
    best_score = float("inf")

    for alpha in alphas:
        model = fit_ridge(features[train_idx], targets[train_idx], alpha)
        prediction = predict_ridge(model, features[validation_idx])
        score = _metrics(targets[validation_idx], prediction)["mae_bps"]
        validation_scores.append({"alpha": float(alpha), "mae_bps": score})
        if score < best_score:
            best_score = score
            selected_alpha = float(alpha)
            best_model = model

    if best_model is None:
        raise RuntimeError("Ridge model tuning did not produce a validation model")

    validation_prediction = predict_ridge(best_model, features[validation_idx])
    validation_errors = targets[validation_idx] - validation_prediction
    validation_error_band = np.quantile(validation_errors, [0.10, 0.90]).tolist()

    fit_idx = np.concatenate([train_idx, validation_idx])
    holdout_model = fit_ridge(features[fit_idx], targets[fit_idx], selected_alpha)
    test_prediction = predict_ridge(holdout_model, features[test_idx])
    baseline_test = np.zeros(len(test_idx))
    model_metrics = _metrics(targets[test_idx], test_prediction)
    baseline_metrics = _metrics(targets[test_idx], baseline_test)
    mae_difference_ci = _block_bootstrap_mae_difference(
        targets[test_idx],
        test_prediction,
        baseline_test,
        horizon,
    )

    production_model = fit_ridge(features, targets, selected_alpha)
    live_prediction = float(predict_ridge(production_model, data["latest_features"]))
    lower_return, upper_return = validation_error_band
    current_price = data["latest_benchmark_lkr_per_8g"]
    test_error_difference = model_metrics["mae_bps"] - baseline_metrics["mae_bps"]
    return {
        "status": "available",
        "model": "standardized ridge regression",
        "target": "forward 7-market-observation log return of the synthetic 22K LKR/8g gold-and-FX benchmark",
        "horizon_market_observations": horizon,
        "market_as_of_date": data["latest_date"],
        "latest_benchmark_lkr_per_8g": current_price,
        "forecast_log_return": live_prediction,
        "forecast_change_percent": (math.exp(live_prediction) - 1) * 100,
        "forecast_lkr_per_8g": current_price * math.exp(live_prediction),
        "validation_error_band_percent": [
            (math.exp(live_prediction + lower_return) - math.exp(live_prediction)) * 100,
            (math.exp(live_prediction + upper_return) - math.exp(live_prediction)) * 100,
        ],
        "validation_error_band_method": "empirical 10th-90th percentile residuals; descriptive, not guaranteed coverage",
        "selected_alpha": selected_alpha,
        "validation_tuning": validation_scores,
        "test_metrics": {
            "ridge": model_metrics,
            "no_change_baseline": baseline_metrics,
            "mae_difference_ridge_minus_baseline_bps": test_error_difference,
            "paired_block_bootstrap_95ci_mae_difference_bps": mae_difference_ci,
            "ridge_beats_baseline_mae": model_metrics["mae_bps"] < baseline_metrics["mae_bps"],
        },
        "evaluation": {
            "source_rows": data["source_rows"],
            "excluded_invalid_or_duplicate_rows": data["excluded_rows"],
            "labeled_samples": len(targets),
            "train_samples": len(train_idx),
            "validation_samples": len(validation_idx),
            "test_samples": len(test_idx),
            "train_end_date": dates[train_idx[-1]],
            "validation_start_date": dates[validation_idx[0]],
            "validation_end_date": dates[validation_idx[-1]],
            "test_start_date": dates[test_idx[0]],
            "test_end_date": dates[test_idx[-1]],
            "target_embargo_market_observations": horizon,
        },
        "feature_weights": [
            {"feature": name, "standardized_coefficient": float(value)}
            for name, value in sorted(
                zip(data["feature_names"], production_model["coefficients"]),
                key=lambda item: abs(item[1]),
                reverse=True,
            )
        ],
        "assumptions": [
            "This model forecasts the synthetic world-gold and USD/LKR benchmark, not Pettah retail prices.",
            "The horizon is measured in joined market observations, not calendar days.",
            "Historical time-series returns do not establish future performance or a buy/sell signal.",
        ],
    }


def train_latest_market_forecast():
    market = market_daily()
    return train_market_forecast(market)
