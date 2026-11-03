import json
import pathlib

from db import get_conn
from market_ml import train_latest_market_forecast

PROJECT_ROOT = pathlib.Path(__file__).resolve().parent.parent
OUTPUT_FILE = PROJECT_ROOT / "web" / "public" / "data" / "ml_forecast.json"


def _add_source_metadata(result):
    with get_conn() as connection:
        gold = connection.execute(
            "SELECT source FROM world_gold ORDER BY date DESC LIMIT 1"
        ).fetchone()
        fx = connection.execute(
            "SELECT source FROM usdlkr ORDER BY date DESC LIMIT 1"
        ).fetchone()
    result["data_sources"] = {
        "world_gold": gold[0] if gold else None,
        "usd_lkr": fx[0] if fx else None,
    }
    return result


def main():
    result = _add_source_metadata(train_latest_market_forecast())
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    temporary = OUTPUT_FILE.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(result, indent=2, allow_nan=False), encoding="utf-8")
    temporary.replace(OUTPUT_FILE)
    metrics = result["test_metrics"]
    print(
        "Trained 7-observation ridge forecast through "
        f"{result['market_as_of_date']}; held-out MAE "
        f"{metrics['ridge']['mae_bps']:.2f} bps vs "
        f"{metrics['no_change_baseline']['mae_bps']:.2f} bps no-change baseline."
    )


if __name__ == "__main__":
    main()
