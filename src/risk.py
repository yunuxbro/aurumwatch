import argparse, datetime as dt
import numpy as np
import pandas as pd
from clean import market_daily, pettah_joined
from decompose import decompose

LAMBDA = 0.94
N_SIMS = 10_000
MAX_MARKET_AGE_DAYS = 7       # D1/D2 freshness limit
MAX_QUOTE_AGE_WORKDAYS = 3    # D3 freshness limit
SOVEREIGNS_PER_KG = 125       # 1000 g / 8 g

def ewma_variance(r, lam=LAMBDA):
    """s2[t] = variance forecast for r[t], made before seeing r[t]."""
    r = np.asarray(r, dtype=float)
    s2 = np.empty(len(r) + 1)
    s2[0] = np.var(r[:30])
    for t in range(len(r)):
        s2[t + 1] = lam * s2[t] + (1 - lam) * r[t] ** 2
    return s2

def simulate(horizon, n=N_SIMS, seed=42):
    m = market_daily().dropna(subset=["ret_world", "ret_fx"]).reset_index(drop=True)
    rw, rf = m.ret_world.to_numpy(), m.ret_fx.to_numpy()
    s2w, s2f = ewma_variance(rw), ewma_variance(rf)
    zw, zf = rw / np.sqrt(s2w[:-1]), rf / np.sqrt(s2f[:-1])   # standardised moves
    sw, sf = np.sqrt(s2w[-1]), np.sqrt(s2f[-1])               # today's volatility
    rng = np.random.default_rng(seed)
    idx = rng.integers(0, len(zw), size=(n, horizon))         # pick whole days, so gold and rupee stay linked
    total = (zw[idx] * sw + zf[idx] * sf).sum(axis=1)         # log move over the horizon
    return total, sw, sf, m.date.iloc[-1]

def stock_risk(horizon=7, start_price=None, today=None):
    today = pd.Timestamp(today or dt.date.today())
    total, sw, sf, market_date = simulate(horizon)
    notes = []
    if start_price is None:
        j = pettah_joined(22)
        quote_date = j.date.iloc[-1]
        start_price = float(j.local.iloc[-1])
        source = "latest stored Pettah quote"
    else:
        quote_date = today
        source = "manual quote"
    market_age = (today - market_date).days
    quote_age = int(np.busday_count(quote_date.date(), today.date()))

    status = "ok"
    if market_age > MAX_MARKET_AGE_DAYS:
        status = "cannot_assess"
        notes.append(f"World gold / USD-LKR data is {market_age} days old.")
    elif quote_age > MAX_QUOTE_AGE_WORKDAYS:
        status = "cannot_assess"
        notes.append(f"Latest Pettah quote is {quote_age} working days old. Enter today's quote.")

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
            "Premium stress uses the worst move seen in a very short history (experimental).",
            "Volatility held at today's EWMA level over the horizon. No point forecast. Not advice.",
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