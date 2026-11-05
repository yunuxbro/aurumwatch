import json, pathlib
import numpy as np
import pandas as pd
from scipy import stats
from clean import market_daily
from risk import ewma_variance

BURN, SIMS = 500, 4000
QS = [0.005, 0.025, 0.05, 0.5, 0.95, 0.975, 0.995]
LEVELS = {"95": (0.025, 0.975), "99": (0.005, 0.995)}

def pinball(y, q, tau):
    d = y - q
    return np.maximum(tau * d, (tau - 1) * d)

def _ll(x, n, p):
    out = 0.0
    if n - x > 0: out += (n - x) * np.log(1 - p)
    if x > 0: out += x * np.log(p)
    return out

def kupiec(x, n, p):
    lr = -2 * (_ll(x, n, p) - _ll(x, n, x / n))
    return lr, float(1 - stats.chi2.cdf(lr, 1))

def run(h, seed=0, include_dates=False):
    m = market_daily(fx_mode="risk_filtered").dropna(subset=["ret_world", "ret_fx"]).reset_index(drop=True)
    rw, rf = m.ret_world.to_numpy(), m.ret_fx.to_numpy()
    rc = rw + rf                                   # log move of the world-based local price
    s2w, s2f, s2c = ewma_variance(rw), ewma_variance(rf), ewma_variance(rc)
    zw, zf = rw / np.sqrt(s2w[:-1]), rf / np.sqrt(s2f[:-1])
    rng = np.random.default_rng(seed)
    zq = stats.norm.ppf(QS)
    ys, Qm, Q1, Q2, end_dates = [], [], [], [], []
    for t in range(BURN, len(rc) - h, h):          # non-overlapping windows
        ys.append(rc[t + 1:t + 1 + h].sum())       # what actually happened
        end_dates.append(m.date.iloc[t + h])
        idx = rng.integers(0, t + 1, size=(SIMS, h))   # only data up to day t
        sim = (zw[idx] * np.sqrt(s2w[t + 1]) + zf[idx] * np.sqrt(s2f[t + 1])).sum(axis=1)
        Qm.append(np.quantile(sim, QS))
        Q1.append(zq * rc[:t + 1].std() * np.sqrt(h))          # B1: fixed volatility
        Q2.append(zq * np.sqrt(s2c[t + 1]) * np.sqrt(h))       # B2: EWMA, normal
    models = {"model": np.array(Qm), "B1_fixed_vol": np.array(Q1), "B2_ewma_normal": np.array(Q2)}
    if include_dates:
        return np.array(ys), models, pd.to_datetime(end_dates)
    return np.array(ys), models

def score(y, Q, name, h):
    out = {"model": name, "horizon": h, "n": len(y)}
    for lvl, (lo, hi) in LEVELS.items():
        i, j = QS.index(lo), QS.index(hi)
        x = int(((y < Q[:, i]) | (y > Q[:, j])).sum())
        _, pv = kupiec(x, len(y), 1 - float(lvl) / 100)
        out[f"outside_{lvl}"] = x / len(y)
        out[f"kupiec_p_{lvl}"] = pv
        out[f"width_{lvl}"] = float((Q[:, j] - Q[:, i]).mean())
    out["pinball"] = float(np.mean([pinball(y, Q[:, k], tau).mean() for k, tau in enumerate(QS)]))
    return out

def main():
    rows, regime_rows = [], []
    for h in (7, 14):
        y, models, dates = run(h, include_dates=True)
        rows += [score(y, Q, name, h) for name, Q in models.items()]
        stress = (dates >= "2026-01-01") & (dates <= "2026-03-31")
        if stress.any():
            for name, Q in models.items():
                result = score(y[stress], Q[stress], name, h)
                result["regime"] = "Jan-Mar 2026 forecast endpoints"
                regime_rows.append(result)
    df = pd.DataFrame(rows)
    base = pathlib.Path(__file__).resolve().parent.parent
    docs_dir = base / "docs"
    docs_dir.mkdir(exist_ok=True)
    df.to_csv(docs_dir / "backtest_results.csv", index=False)
    out = base / "web" / "public" / "data"
    out.mkdir(parents=True, exist_ok=True)
    (out / "backtest.json").write_text(json.dumps(rows, indent=2))
    pd.DataFrame(regime_rows).to_csv(docs_dir / "backtest_regime_results.csv", index=False)
    (out / "backtest_regime.json").write_text(json.dumps(regime_rows, indent=2))
    pd.set_option("display.width", 220)
    print(df.round(4).to_string(index=False))
    if regime_rows:
        print("\nJan-Mar 2026 regime split (forecast endpoints):")
        print(pd.DataFrame(regime_rows).round(4).to_string(index=False))
    for h in (7, 14):
        m = df[(df.horizon == h) & (df.model == "model")].iloc[0]
        b1 = df[(df.horizon == h) & (df.model == "B1_fixed_vol")].iloc[0]
        bad = m.outside_95 > 0.10 or m.outside_95 < 0.01
        print(f"h={h}: 95% range misses {m.outside_95:.1%} (target 5%).",
              "NOT WORKING by the proposal's rule." if bad else "Within the proposal's tolerance.",
              f"B1 outside={b1.outside_95:.1%}, width={b1.width_95:.1%}; model width={m.width_95:.1%}. No superiority claim.")

if __name__ == "__main__":
    main()
