import pandas as pd
from clean import load, market_daily, pettah_joined

def report():
    out = {}
    g, f, p = load("world_gold"), load("usdlkr"), load("pettah")
    m = market_daily()
    out["world_gold_rows"] = len(g)
    out["usdlkr_rows"] = len(f)
    out["dates_in_gold_not_fx"] = len(set(g.date) - set(f.date))
    out["dates_in_fx_not_gold"] = len(set(f.date) - set(g.date))
    out["market_rows_after_alignment"] = len(m)
    out["spike_days_flagged"] = int(m.flag_spike.sum())
    out["nonpositive_values"] = int((g.usd_oz <= 0).sum() + (f.lkr_per_usd <= 0).sum())
    out["pettah_rows"] = len(p)
    out["pettah_dates_22k"] = int((p.karat == 22).sum())
    j = pettah_joined(22)
    out["pettah_joined_rows"] = len(j)
    out["max_lag_days"] = int(j.lag_days.max())
    out["market_last_date"] = str(m.date.max().date())
    return out

if __name__ == "__main__":
    for k, v in report().items():
        print(f"{k:30} {v}")