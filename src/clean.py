import numpy as np
import pandas as pd
from db import get_conn

GRAMS_PER_OZ = 31.1035
SOVEREIGN_G = 8

def load(table):
    with get_conn() as c:
        return pd.read_sql(f"SELECT * FROM {table}", c, parse_dates=["date"])

def market_daily():
    """World gold (USD/oz) and USD/LKR on the days both exist."""
    g = load("world_gold").dropna(subset=["usd_oz"]).drop_duplicates("date").sort_values("date")
    f = load("usdlkr").dropna(subset=["lkr_per_usd"]).drop_duplicates("date").sort_values("date")
    m = g[["date", "usd_oz"]].merge(f[["date", "lkr_per_usd"]], on="date", how="inner")
    m["ret_world"] = np.log(m.usd_oz).diff()
    m["ret_fx"] = np.log(m.lkr_per_usd).diff()
    m["flag_spike"] = (m.ret_world.abs() > 0.05) | (m.ret_fx.abs() > 0.05)  # flagged, never deleted
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