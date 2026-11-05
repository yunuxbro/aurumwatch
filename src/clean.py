import numpy as np
import pandas as pd
from db import get_conn
from fx_review import filter_reversing_yahoo_prints, reviewed_rate

GRAMS_PER_OZ = 31.1035
SOVEREIGN_G = 8

def load(table):
    with get_conn() as c:
        return pd.read_sql(f"SELECT * FROM {table}", c, parse_dates=["date"])

def market_daily(fx_mode="reviewed"):
    """World gold (USD/oz) and USD/LKR on the days both exist.

    ``reviewed`` applies the three recent CBSL spot cross-check overrides.
    ``risk_filtered`` also applies the Yahoo reversal heuristic, while
    preserving the March-April 2022 float transition.
    """
    g = load("world_gold").dropna(subset=["usd_oz"]).drop_duplicates("date").sort_values("date")
    f = load("usdlkr").dropna(subset=["lkr_per_usd"]).drop_duplicates("date").sort_values("date")
    if fx_mode not in {"reviewed", "risk_filtered"}:
        raise ValueError(f"Unknown USD/LKR processing mode: {fx_mode}")
    if fx_mode == "risk_filtered":
        yahoo_mask = f.source.astype(str).str.contains("yahoo", case=False, na=False)
        if yahoo_mask.any():
            rates = f.loc[yahoo_mask].set_index("date").lkr_per_usd
            cleaned, _ = filter_reversing_yahoo_prints(rates)
            f.loc[yahoo_mask, "lkr_per_usd"] = cleaned.reindex(
                pd.DatetimeIndex(f.loc[yahoo_mask, "date"])
            ).to_numpy()
    f["lkr_per_usd"] = [reviewed_rate(date, rate) for date, rate in zip(f.date, f.lkr_per_usd)]
    m = g[["date", "usd_oz"]].merge(f[["date", "lkr_per_usd"]], on="date", how="inner")
    m["ret_world"] = np.log(m.usd_oz).diff()
    m["ret_fx"] = np.log(m.lkr_per_usd).diff()
    m["fx_crosscheck_corrected"] = m.date.dt.strftime("%Y-%m-%d").isin(
        {"2026-11-02", "2026-11-03", "2026-11-04"}
    )
    m["flag_spike"] = (m.ret_world.abs() > 0.05) | (m.ret_fx.abs() > 0.05)
    return m

def pettah_joined(karat=22):
    """Pettah quotes joined to the latest world/fx values on or before that date."""
    p = load("pettah")
    p = p[p.karat == karat].sort_values("date")
    p = p.groupby("date", as_index=False).agg(local=("lkr_per_8g", "mean"))
    m = market_daily()[["date", "usd_oz", "lkr_per_usd"]].rename(columns={"date": "market_date"})
    j = pd.merge_asof(p, m, left_on="date", right_on="market_date",
                      direction="backward", tolerance=pd.Timedelta("5D"))
    j["lag_days"] = (j.date - j.market_date).dt.days
    j = j.dropna(subset=["usd_oz", "lkr_per_usd"]).reset_index(drop=True)
    j["local_equiv"] = j.usd_oz * j.lkr_per_usd * (SOVEREIGN_G / GRAMS_PER_OZ) * (karat / 24)
    j["premium"] = np.log(j.local) - np.log(j.local_equiv)
    return j
