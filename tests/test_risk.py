import numpy as np
import pandas as pd
import pytest
import risk as risk_module
from risk import ewma_variance, stock_risk

def test_ewma_positive():
    s2 = ewma_variance(np.random.default_rng(1).normal(0, 0.01, 200))
    assert (s2 > 0).all()

def test_range_is_ordered():
    r = stock_risk(horizon=7, start_price=300000)
    assert r["status"] == "ok"
    q = r["range_8g"]
    assert q["p5"] < q["p50"] < q["p95"]

def test_old_data_gives_cannot_assess():
    r = stock_risk(horizon=7, start_price=300000, today="2026-12-31")
    assert r["status"] == "cannot_assess"
    assert r["range_8g"] is None


def test_missing_current_pettah_quote_uses_daily_market_benchmark(monkeypatch):
    market = pd.DataFrame([{
        "date": pd.Timestamp("2026-11-02"),
        "usd_oz": 4000,
        "lkr_per_usd": 330,
        "ret_world": 0.01,
        "ret_fx": 0.01,
    }])
    monkeypatch.setattr(risk_module, "market_daily", lambda: market)
    monkeypatch.setattr(
        risk_module,
        "simulate",
        lambda horizon: (np.zeros(10), 0.01, 0.01, pd.Timestamp("2026-11-02")),
    )
    monkeypatch.setattr(
        risk_module,
        "decompose",
        lambda karat: pd.DataFrame({"ret_premium": [-0.01]}),
    )

    result = stock_risk(today="2026-11-03")

    expected_price = 4000 * 330 / 31.1035 * 8 * 22 / 24
    assert result["status"] == "ok"
    assert result["start_price_8g"] == pytest.approx(expected_price)
    assert result["start_source"] == "daily world-gold and USD/LKR benchmark"
    assert "not a verified Pettah shop quote" in result["notes"][0]