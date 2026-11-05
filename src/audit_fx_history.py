"""Compare stored Yahoo USD/LKR closes with the CBSL series via Macro Lab."""

import datetime as dt
import json
import pathlib
import re

import requests

from db import get_conn


PROJECT_ROOT = pathlib.Path(__file__).resolve().parent.parent
CBSL_SERIES_URL = "https://macrolab.lk/data/series/LK.EXT.FX.USD.SPOT.D/"
DIFFERENCE_TOLERANCE_LKR = 0.05


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

    overlap = sorted(yahoo.keys() & cbsl.keys())
    mismatches = sum(
        abs(yahoo[day] - cbsl[day]) > DIFFERENCE_TOLERANCE_LKR
        for day in overlap
    )
    exact_cent_differences = sum(
        round(yahoo[day] + 1e-10, 2) != round(cbsl[day], 2)
        for day in overlap
    )
    return {
        "status": "available",
        "checked_at": dt.date.today().isoformat(),
        "reference_as_of": payload.get("vintage"),
        "reference": "CBSL USD/LKR indicative spot via Macro Lab",
        "reference_url": CBSL_SERIES_URL,
        "reference_points": len(cbsl),
        "yahoo_rows": len(yahoo),
        "matched_dates": len(overlap),
        "mismatch_tolerance_lkr": DIFFERENCE_TOLERANCE_LKR,
        "mismatched_dates": mismatches,
        "within_tolerance_dates": len(overlap) - mismatches,
        "rounded_to_cent_differences": exact_cent_differences,
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
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
