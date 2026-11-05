"""Compare risk backtests under three USD/LKR histories.

The CBSL series is fetched via Macro Lab, and Yahoo fills dates that CBSL
does not publish. Results are sensitivity analysis, not proof that either
provider is error-free.
"""

import json
import pathlib
import re

import numpy as np
import pandas as pd
import requests
from scipy import stats

from backtest import BURN, QS, SIMS, ewma_variance, score
from db import get_conn
from fx_review import filter_reversing_yahoo_prints, reviewed_rate, yahoo_reversal_flags


PROJECT_ROOT = pathlib.Path(__file__).resolve().parent.parent
CBSL_SERIES_URL = "https://macrolab.lk/data/series/LK.EXT.FX.USD.SPOT.D/"


def fetch_cbsl():
    response = requests.get(
        CBSL_SERIES_URL,
        headers={"User-Agent": "AurumWatch FX sensitivity backtest/1.0"},
        timeout=30,
    )
    response.raise_for_status()
    match = re.search(
        r'<script type="application/json" id="series-data">(.*?)</script>',
        response.text,
        re.DOTALL,
    )
    if not match:
        raise ValueError("Macro Lab page did not contain its series-data payload.")
    payload = json.loads(match.group(1))
    if payload.get("code") != "LK.EXT.FX.USD.SPOT.D":
        raise ValueError("Unexpected reference series returned by Macro Lab.")
    values = pd.Series(
        {pd.Timestamp(day): float(value) for day, value in payload["pts"]},
        name="cbsl",
        dtype=float,
    ).sort_index()
    return values, payload.get("vintage")


def load_inputs():
    with get_conn() as connection:
        gold = pd.read_sql_query(
            "SELECT date, usd_oz FROM world_gold ORDER BY date", connection
        )
        yahoo = pd.read_sql_query(
            "SELECT date, lkr_per_usd FROM usdlkr ORDER BY date", connection
        )
    gold["date"] = pd.to_datetime(gold.date)
    yahoo["date"] = pd.to_datetime(yahoo.date)
    gold = gold.dropna(subset=["usd_oz"]).drop_duplicates("date").set_index("date").usd_oz
    yahoo = yahoo.dropna(subset=["lkr_per_usd"]).drop_duplicates("date").set_index("date").lkr_per_usd
    cbsl, vintage = fetch_cbsl()
    return gold.sort_index(), yahoo.sort_index(), cbsl, vintage


def make_fx_variants(yahoo, cbsl, gold):
    raw = yahoo.rename("fx").to_frame()
    filtered, flagged_count = filter_reversing_yahoo_prints(raw.fx)
    filtered = pd.Series(
        [reviewed_rate(day, rate) for day, rate in filtered.items()],
        index=filtered.index,
        name="fx",
    ).reindex(yahoo.index)

    raw_fx = raw.fx
    reviewed_yahoo = pd.Series(
        [reviewed_rate(day, rate) for day, rate in raw_fx.items()],
        index=raw_fx.index,
        name="fx",
    )
    cbsl_primary = cbsl.combine_first(yahoo).reindex(yahoo.index).rename("fx")
    return {
        "raw_yahoo": (raw_fx, 0),
        "yahoo_reviewed_unfiltered": (reviewed_yahoo, 0),
        "yahoo_reversal_filter": (filtered, flagged_count),
        "cbsl_primary_yahoo_gap_fill": (
            cbsl_primary,
            int(gold.index.intersection(yahoo.index).difference(cbsl.index).size),
        ),
    }


def aligned_market(gold, fx):
    market = pd.concat([gold.rename("usd_oz"), fx.rename("lkr_per_usd")], axis=1, join="inner")
    market = market.sort_index()
    market["ret_world"] = np.log(market.usd_oz).diff()
    market["ret_fx"] = np.log(market.lkr_per_usd).diff()
    market = market.dropna(subset=["ret_world", "ret_fx"]).rename_axis("date").reset_index()
    return market


def run_version(market, horizon, seed=0):
    rw, rf = market.ret_world.to_numpy(), market.ret_fx.to_numpy()
    rc = rw + rf
    s2w, s2f, s2c = ewma_variance(rw), ewma_variance(rf), ewma_variance(rc)
    zw, zf = rw / np.sqrt(s2w[:-1]), rf / np.sqrt(s2f[:-1])
    rng = np.random.default_rng(seed)
    zq = stats.norm.ppf(QS)
    ys, Qm, Q1, Q2, end_dates = [], [], [], [], []
    for t in range(BURN, len(rc) - horizon, horizon):
        ys.append(rc[t + 1:t + 1 + horizon].sum())
        end_dates.append(market.date.iloc[t + horizon])
        idx = rng.integers(0, t + 1, size=(SIMS, horizon))
        sim = (
            zw[idx] * np.sqrt(s2w[t + 1])
            + zf[idx] * np.sqrt(s2f[t + 1])
        ).sum(axis=1)
        Qm.append(np.quantile(sim, QS))
        Q1.append(zq * rc[:t + 1].std() * np.sqrt(horizon))
        Q2.append(zq * np.sqrt(s2c[t + 1]) * np.sqrt(horizon))
    models = {
        "model": np.array(Qm),
        "B1_fixed_vol": np.array(Q1),
        "B2_ewma_normal": np.array(Q2),
    }
    return np.array(ys), models, pd.to_datetime(end_dates)


def main():
    gold, yahoo, cbsl, vintage = load_inputs()
    variants = make_fx_variants(yahoo, cbsl, gold)
    filter_flags = yahoo_reversal_flags(yahoo)
    flag_dates = set(filter_flags.index[filter_flags].strftime("%Y-%m-%d"))
    audit_path = PROJECT_ROOT / "web" / "public" / "data" / "fx_audit.json"
    fx_audit = json.loads(audit_path.read_text(encoding="utf-8"))
    audit_dates = {row["date"] for row in fx_audit["return_difference_dates"]}
    audit_difference_count = len(audit_dates)
    filter_audit_overlap = len(flag_dates & audit_dates)
    # Match forecast returns by date after calculating returns on each complete
    # level series. This mirrors production behavior when filtering leaves a
    # value missing and prevents one variant getting different forecast dates.
    markets = {name: aligned_market(gold, fx) for name, (fx, _) in variants.items()}
    shared_dates = None
    for market in markets.values():
        dates = pd.DatetimeIndex(market.date)
        shared_dates = dates if shared_dates is None else shared_dates.intersection(dates)
    markets = {
        name: market[market.date.isin(shared_dates)].reset_index(drop=True)
        for name, market in markets.items()
    }
    all_rows, stress_rows = [], []
    for version, (fx, flagged_count) in variants.items():
        market = markets[version]
        for horizon in (7, 14):
            y, models, dates = run_version(market, horizon)
            for name, quantiles in models.items():
                result = score(y, quantiles, name, horizon)
                result.update({
                    "fx_filter_flagged_days": flagged_count if version == "yahoo_reversal_filter" else 0,
                    "fx_yahoo_gap_fill_days": flagged_count if version == "cbsl_primary_yahoo_gap_fill" else 0,
                    "fx_reviewed_overrides_applied": version in {"yahoo_reviewed_unfiltered", "yahoo_reversal_filter"},
                    "fx_filter_overlap_with_return_audit": filter_audit_overlap,
                    "fx_return_audit_day_count": audit_difference_count,
                })
                result.update({
                    "fx_version": version,
                    "market_return_rows": len(market),
                    "cbsl_vintage": vintage,
                })
                all_rows.append(result)
                stress = (dates >= "2026-01-01") & (dates <= "2026-03-31")
                if stress.any():
                    stress_result = score(y[stress], quantiles[stress], name, horizon)
                    stress_result.update({
                        "fx_version": version,
                        "regime": "Jan-Mar 2026 forecast endpoints",
                    })
                    stress_rows.append(stress_result)

    docs = PROJECT_ROOT / "docs"
    out = PROJECT_ROOT / "web" / "public" / "data"
    docs.mkdir(exist_ok=True)
    out.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(all_rows).to_csv(docs / "backtest_fx_sensitivity.csv", index=False)
    pd.DataFrame(all_rows).to_csv(out / "backtest_fx_sensitivity.csv", index=False)
    (out / "backtest_fx_sensitivity.json").write_text(json.dumps(all_rows, indent=2) + "\n")
    pd.DataFrame(stress_rows).to_csv(docs / "backtest_fx_sensitivity_regime.csv", index=False)
    (out / "backtest_fx_sensitivity_regime.json").write_text(json.dumps(stress_rows, indent=2) + "\n")
    results = pd.DataFrame(all_rows)
    model_rows = results[results.model == "model"].copy()
    print("Model results by FX series (same algorithm, each series' own outcomes):")
    print(f"Reversal rule flags {int(filter_flags.sum())} dates; {filter_audit_overlap} also appear in the {audit_difference_count}-date Yahoo/CBSL return-difference list.")
    print(model_rows[["fx_version", "horizon", "n", "outside_95", "width_95", "pinball", "market_return_rows", "fx_filter_flagged_days", "fx_yahoo_gap_fill_days"]].round(4).to_string(index=False))
    print("\nAll models and baselines:")
    print(results[["fx_version", "horizon", "model", "n", "outside_95", "width_95", "pinball"]].round(4).to_string(index=False))
    print("\nJan-Mar 2026 regime split:")
    print(pd.DataFrame(stress_rows)[["fx_version", "horizon", "model", "n", "outside_95", "width_95"]].round(4).to_string(index=False))


if __name__ == "__main__":
    main()
