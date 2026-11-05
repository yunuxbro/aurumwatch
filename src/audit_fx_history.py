"""Compare stored Yahoo USD/LKR closes with the CBSL series via Macro Lab."""

import datetime as dt
import json
import pathlib
import re

import requests
import numpy as np
import pandas as pd

from db import get_conn
from clean import market_daily


PROJECT_ROOT = pathlib.Path(__file__).resolve().parent.parent
CBSL_SERIES_URL = "https://macrolab.lk/data/series/LK.EXT.FX.USD.SPOT.D/"


def audit():
    response = requests.get(
        CBSL_SERIES_URL,
        headers={"User-Agent": "AurumWatch data-quality audit/1.0"},
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
    cbsl = {str(day): float(value) for day, value in payload["pts"]}

    with get_conn() as connection:
        yahoo = {
            str(day): float(value)
            for day, value in connection.execute(
                "SELECT date, lkr_per_usd FROM usdlkr"
            ).fetchall()
        }

    common_dates = sorted(yahoo.keys() & cbsl.keys())
    paired = pd.DataFrame(
        {
            "yahoo": {day: yahoo[day] for day in common_dates},
            "cbsl": {day: cbsl[day] for day in common_dates},
        }
    ).sort_index()
    paired.index = pd.to_datetime(paired.index)
    paired["gap_pct"] = (paired.yahoo / paired.cbsl - 1) * 100
    returns = np.log(paired[["yahoo", "cbsl"]]).diff().dropna()
    returns["return_diff_bps"] = (returns.yahoo - returns.cbsl).abs() * 10_000
    return_differences = returns[returns.return_diff_bps > 100]

    market = market_daily().dropna(subset=["ret_world", "ret_fx"])
    spike_dates = {
        pd.Timestamp(day).date().isoformat()
        for day in market.loc[market.flag_spike, "date"]
    }
    return_mismatch_dates = [
        {
            "date": day.date().isoformat(),
            "yahoo_return_pct": float(returns.at[day, "yahoo"] * 100),
            "cbsl_return_pct": float(returns.at[day, "cbsl"] * 100),
            "absolute_difference_bps": float(returns.at[day, "return_diff_bps"]),
            "overlaps_spike_flag": day.date().isoformat() in spike_dates,
        }
        for day in return_differences.index
    ]
    overlap_spikes = [
        row["date"] for row in return_mismatch_dates if row["overlaps_spike_flag"]
    ]
    return {
        "status": "available",
        "checked_at": dt.date.today().isoformat(),
        "reference_as_of": payload.get("vintage"),
        "reference": "CBSL USD/LKR indicative spot via Macro Lab",
        "reference_url": CBSL_SERIES_URL,
        "reference_points": len(cbsl),
        "yahoo_rows": len(yahoo),
        "matched_dates": len(common_dates),
        "absolute_level_gap_median_pct": float(paired.gap_pct.abs().median()),
        "absolute_level_gap_p95_pct": float(paired.gap_pct.abs().quantile(0.95)),
        "absolute_level_gap_max_pct": float(paired.gap_pct.abs().max()),
        "level_gap_over_1pct_dates": int((paired.gap_pct.abs() > 1).sum()),
        "daily_log_return_correlation": float(returns.yahoo.corr(returns.cbsl)),
        "return_difference_threshold_bps": 100,
        "return_difference_over_threshold_dates": len(return_mismatch_dates),
        "return_difference_dates": return_mismatch_dates,
        "existing_spike_flag_dates": sorted(spike_dates),
        "return_difference_spike_overlap_dates": overlap_spikes,
        "return_difference_spike_overlap_count": len(overlap_spikes),
        "yahoo_dates_without_cbsl_observation": len(yahoo.keys() - cbsl.keys()),
        "cbsl_dates_without_yahoo_observation": len(cbsl.keys() - yahoo.keys()),
        "interpretation": (
            "Differences are not automatically erroneous prints: Yahoo LKR=X and "
            "CBSL indicative spot are distinct published series."
        ),
        "licence_note": (
            "Macro Lab charts and text are CC BY 4.0; underlying values belong to "
            "CBSL. CBSL reuse terms were not independently verified."
        ),
    }


def main():
    result = audit()
    out = PROJECT_ROOT / "web" / "public" / "data" / "fx_audit.json"
    out.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    csv_path = PROJECT_ROOT / "docs" / "fx_return_discrepancies.csv"
    pd.DataFrame(result["return_difference_dates"]).to_csv(csv_path, index=False)
    public_csv = PROJECT_ROOT / "web" / "public" / "data" / "fx_return_discrepancies.csv"
    pd.DataFrame(result["return_difference_dates"]).to_csv(public_csv, index=False)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
