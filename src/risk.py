import argparse, datetime as dt
import numpy as np
import pandas as pd
from clean import market_daily
from decompose import decompose
from freshness import working_days_since

LAMBDA = 0.94
N_SIMS = 10_000
MAX_MARKET_AGE_DAYS = 5
SOVEREIGNS_PER_KG = 125       # 1000 g / 8 g
GRAMS_PER_TROY_OUNCE = 31.1034768
GRAMS_PER_SOVEREIGN = 8.0

def ewma_variance(r, lam=LAMBDA):
    """s2[t] = variance forecast for r[t], made before seeing r[t]."""
    r = np.asarray(r, dtype=float)
    s2 = np.empty(len(r) + 1)
    s2[0] = np.var(r[:30])
    for t in range(len(r)):
        s2[t + 1] = lam * s2[t] + (1 - lam) * r[t] ** 2
    return s2

def simulate(horizon, n=N_SIMS, seed=42):
    m = market_daily(fx_mode="risk_filtered").dropna(subset=["ret_world", "ret_fx"]).reset_index(drop=True)
    rw, rf = m.ret_world.to_numpy(), m.ret_fx.to_numpy()
    s2w, s2f = ewma_variance(rw), ewma_variance(rf)
    zw, zf = rw / np.sqrt(s2w[:-1]), rf / np.sqrt(s2f[:-1])   # standardised moves
    sw, sf = np.sqrt(s2w[-1]), np.sqrt(s2f[-1])               # today's volatility
    rng = np.random.default_rng(seed)
    idx = rng.integers(0, len(zw), size=(n, horizon))         # pick whole days, so gold and rupee stay linked
    total = (zw[idx] * sw + zf[idx] * sf).sum(axis=1)         # log move over the horizon
    return total, sw, sf, m.date.iloc[-1]

def stock_risk(
    horizon=7,
    start_price=None,
    today=None,
    start_source=None,
    start_date=None,
    dealer_quote_count=None,
):
    today = pd.Timestamp(today or dt.date.today())
    total, sw, sf, market_date = simulate(horizon)
    notes = []
    market_rows = market_daily().dropna(subset=["usd_oz", "lkr_per_usd"])
    latest_market = market_rows.iloc[-1]
    market_benchmark_22k = (
        float(latest_market.usd_oz)
        * float(latest_market.lkr_per_usd)
        / GRAMS_PER_TROY_OUNCE
        * GRAMS_PER_SOVEREIGN
        * (22 / 24)
    )
    if start_price is None:
        quote_date = pd.Timestamp(market_date)
        start_price = market_benchmark_22k
        source = "daily world-gold and USD/LKR benchmark"
        notes.append(
            "The starting value is a market-derived 22K estimate, not a verified Pettah shop quote."
        )
    else:
        quote_date = pd.Timestamp(start_date or today)
        source = start_source or "manual quote"
    market_age = working_days_since(market_date, today.date())

    status = "ok"
    if market_age > MAX_MARKET_AGE_DAYS:
        status = "cannot_assess"
        notes.append(f"World gold / USD-LKR data is {market_age} working days old.")

    paths = start_price * np.exp(total)
    q = {f"p{p}": float(np.percentile(paths, p)) for p in (1, 5, 25, 50, 75, 95, 99)}
    d = decompose(22)
    worst = float(d.ret_premium.min()) if len(d) else None

    ok = status == "ok"
    return {
        "status": status,
        "notes": notes,
        "horizon_days": horizon,
        "start_price_8g": start_price,
        "start_source": source,
        "dealer_quote_count": dealer_quote_count,
        "quote_date": str(quote_date.date()),
        "market_date": str(market_date.date()),
        "daily_vol": {"world": float(sw), "fx": float(sf)},
        "range_8g": q if ok else None,
        "stock_1kg_lkr": {k: v * SOVEREIGNS_PER_KG for k, v in q.items()} if ok else None,
        "prob_fall_5pct": float((paths < 0.95 * start_price).mean()) if ok else None,
        "prob_fall_10pct": float((paths < 0.90 * start_price).mean()) if ok else None,
        "worst_premium_move": worst,
        "premium_stress_8g": start_price * float(np.exp(worst)) if (ok and worst is not None) else None,
        "assumptions": [
            "Premium held constant in the range; range covers world gold and rupee only.",
            "Risk FX input applies the documented Yahoo reversal filter; market history and attribution remain unfiltered.",
            "Premium stress uses the worst move seen in a very short history (experimental).",
            "Volatility held at the latest EWMA level over the horizon. No point forecast. Not advice.",
        ],
    }

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--price", type=float, default=None)
    ap.add_argument("--horizon", type=int, default=7)
    a = ap.parse_args()
    r = stock_risk(a.horizon, a.price)
    print("status:", r["status"], r["notes"])
    if r["range_8g"]:
        print("5% / 50% / 95% (Rs per 8g):",
              round(r["range_8g"]["p5"]), round(r["range_8g"]["p50"]), round(r["range_8g"]["p95"]))
        print("chance of falling >5%:", round(r["prob_fall_5pct"], 3),
              " >10%:", round(r["prob_fall_10pct"], 3))
        print("1 kg stock, 5% case:", round(r["stock_1kg_lkr"]["p5"]))
