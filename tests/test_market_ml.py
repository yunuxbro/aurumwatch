import numpy as np
import pandas as pd
import pytest

from market_ml import (
    build_supervised_data,
    chronological_splits,
    fit_ridge,
    predict_ridge,
    train_market_forecast,
)


def synthetic_market(rows=900, seed=12):
    rng = np.random.default_rng(seed)
    gold_returns = rng.normal(0.0002, 0.008, rows)
    fx_returns = rng.normal(0.00005, 0.001, rows)
    gold = 1900 * np.exp(np.cumsum(gold_returns))
    fx = 300 * np.exp(np.cumsum(fx_returns))
    return pd.DataFrame({
        "date": pd.date_range("2020-01-01", periods=rows, freq="B"),
        "usd_oz": gold,
        "lkr_per_usd": fx,
    })


def test_supervised_features_are_causal_and_future_targets_have_fixed_horizon():
    market = synthetic_market(500)
    horizon = 7
    data = build_supervised_data(market, horizon)

    assert data["features"].shape[0] == len(data["targets"])
    assert data["features"].shape[1] == len(data["feature_names"])
    assert np.isfinite(data["features"]).all()
    assert np.isfinite(data["targets"]).all()
    assert data["latest_date"] == market.date.iloc[-1].strftime("%Y-%m-%d")
    assert data["dates"][-1] < data["latest_date"]
    assert data["source_rows"] == len(market)


def test_invalid_and_duplicate_source_rows_are_excluded_without_imputation():
    market = synthetic_market(500)
    market.loc[5, "usd_oz"] = np.nan
    market.loc[6, "lkr_per_usd"] = 0
    market = pd.concat([market, market.iloc[[20]]], ignore_index=True)

    data = build_supervised_data(market)

    assert data["source_rows"] == 498
    assert data["excluded_rows"] == 3
    assert np.isfinite(data["features"]).all()


def test_chronological_splits_purge_horizon_labels_at_boundaries():
    horizon = 7
    splits = chronological_splits(1000, horizon)

    assert splits["train"][-1] + horizon < splits["validation"][0]
    assert splits["validation"][-1] + horizon < splits["test"][0]
    assert splits["train"][0] < splits["train"][-1]
    assert splits["validation"][0] < splits["validation"][-1]
    assert splits["test"][0] < splits["test"][-1]


def test_ridge_fits_scaling_on_training_features_and_predicts():
    features = np.array([[0.0], [1.0], [2.0], [3.0]])
    targets = np.array([0.0, 2.0, 4.0, 6.0])
    model = fit_ridge(features[:3], targets[:3], alpha=0)

    prediction = predict_ridge(model, np.array([[3.0]]))

    assert model["mean"][0] == pytest.approx(1.0)
    assert prediction[0] == pytest.approx(6.0)


def test_model_training_reports_holdout_metrics_and_live_forecast():
    result = train_market_forecast(synthetic_market(1200), alphas=(0.1, 1.0, 10.0))

    assert result["status"] == "available"
    assert result["horizon_market_observations"] == 7
    assert result["evaluation"]["train_end_date"] < result["evaluation"]["validation_start_date"]
    assert result["evaluation"]["validation_end_date"] < result["evaluation"]["test_start_date"]
    assert result["evaluation"]["test_samples"] > 0
    assert result["test_metrics"]["ridge"]["mae_bps"] >= 0
    assert result["test_metrics"]["no_change_baseline"]["mae_bps"] >= 0
    assert np.isfinite(result["forecast_lkr_per_8g"])
    assert result["feature_weights"]


def test_model_rejects_insufficient_labeled_history():
    with pytest.raises(ValueError, match="Need at least"):
        train_market_forecast(synthetic_market(250))
