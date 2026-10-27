import numpy as np
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