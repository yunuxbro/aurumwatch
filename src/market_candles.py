import csv
import datetime as dt
import math
import pathlib

from db import get_conn
from market_reference import OUNCE_TO_GRAMS
from fx_review import reviewed_rate

PROJECT_ROOT = pathlib.Path(__file__).resolve().parent.parent
GRAMS_PER_SOVEREIGN = 8


def _read_ohlc_snapshot(path):
    with path.open(newline="", encoding="utf-8-sig") as source:
        reader = csv.reader(source)
        header = next(reader, None)
        if not header:
            return []

        columns = {name.strip().lower(): index for index, name in enumerate(header)}
        date_column = columns.get("date", columns.get("price"))
        required = {"open", "high", "low", "close"}
        if date_column is None or not required.issubset(columns):
            return []

        rows = list(reader)
        if rows and rows[0] and rows[0][0].strip().lower() == "ticker":
            rows = rows[2:]

    observations = {}
    for row in rows:
        try:
            day = dt.date.fromisoformat(row[date_column].strip()).isoformat()
            values = {
                name: float(row[columns[name]])
                for name in ("open", "high", "low", "close")
            }
        except (IndexError, TypeError, ValueError, OverflowError):
            continue

        if not all(math.isfinite(value) and value > 0 for value in values.values()):
            continue
        if values["low"] > min(values["open"], values["close"]):
            continue
        if values["high"] < max(values["open"], values["close"]):
            continue
        if values["low"] > values["high"]:
            continue
        observations[day] = {"date": day, **values}
    return [observations[day] for day in sorted(observations)]


def _latest_snapshot(prefix):
    snapshots = list((PROJECT_ROOT / "data" / "raw").glob(f"{prefix}_*.csv"))
    if not snapshots:
        return None
    return max(snapshots, key=lambda path: path.stat().st_mtime)


def _source_snapshot(table, source_column, source_label):
    with get_conn() as connection:
        row = connection.execute(
            f"SELECT {source_column} FROM {table} ORDER BY date DESC LIMIT 1"
        ).fetchone()
    if row is None or row[0] is None:
        return None, f"No {source_label} source is available."

    source = row[0].lower()
    if "stooq" in source:
        prefix = f"{table}_stooq"
    elif "yfinance" in source or "yahoo finance" in source:
        prefix = f"{table}_yfinance"
    else:
        return None, f"The current {source_label} source does not provide daily OHLC data."

    snapshot = _latest_snapshot(prefix)
    if snapshot is None:
        return None, f"No saved OHLC snapshot is available for {source_label}."
    return snapshot, None


def build_market_candles():
    with get_conn() as connection:
        gold_row = connection.execute(
            "SELECT source FROM world_gold ORDER BY date DESC LIMIT 1"
        ).fetchone()
    gold_source = gold_row[0] if gold_row else ""
    gold_label = (
        "futures proxy (GC=F), not spot"
        if "yfinance" in str(gold_source).lower() or "gc=f" in str(gold_source).lower()
        else "Stooq XAU/USD"
    )
    gold_path, gold_reason = _source_snapshot(
        "world_gold", "source", "world-gold"
    )
    fx_path, fx_reason = _source_snapshot("usdlkr", "source", "USD/LKR")
    if gold_reason or fx_reason:
        return {
            "status": "unavailable",
            "rows": [],
            "reason": gold_reason or fx_reason,
        }

    gold_rows = _read_ohlc_snapshot(gold_path)
    fx_rows = _read_ohlc_snapshot(fx_path)
    gold_by_date = {row["date"]: row for row in gold_rows}
    fx_by_date = {row["date"]: row for row in fx_rows}
    factor_24k = GRAMS_PER_SOVEREIGN / OUNCE_TO_GRAMS
    factor_22k = factor_24k * 22 / 24
    candles = []
    for day in sorted(gold_by_date.keys() & fx_by_date.keys()):
        gold = gold_by_date[day]
        fx = fx_by_date[day]
        # For reviewed Yahoo bad prints, use CBSL's published daily rate for
        # every synthetic OHLC value so the candle close matches the cards.
        reviewed_fx = reviewed_rate(day, fx["close"])
        if reviewed_fx != fx["close"]:
            fx = {"open": reviewed_fx, "high": reviewed_fx, "low": reviewed_fx, "close": reviewed_fx}
        opening_24k = gold["open"] * fx["open"] * factor_24k
        closing_24k = gold["close"] * fx["close"] * factor_24k
        high_24k = max(gold["high"] * fx["high"] * factor_24k, opening_24k, closing_24k)
        low_24k = min(gold["low"] * fx["low"] * factor_24k, opening_24k, closing_24k)
        opening_22k = opening_24k * 22 / 24
        closing_22k = closing_24k * 22 / 24
        high_22k = high_24k * 22 / 24
        low_22k = low_24k * 22 / 24
        candles.append({
            "date": day,
            "open": opening_22k,
            "high": high_22k,
            "low": low_22k,
            "close": closing_22k,
            "open_22k": opening_22k,
            "high_22k": high_22k,
            "low_22k": low_22k,
            "close_22k": closing_22k,
            "open_24k": opening_24k,
            "high_24k": high_24k,
            "low_24k": low_24k,
            "close_24k": closing_24k,
        })

    if not candles:
        return {
            "status": "unavailable",
            "rows": [],
            "reason": "The saved gold and FX feeds have no matching OHLC dates.",
        }

    return {
        "status": "available",
        "basis": (
            "Synthetic 22K and 24K LKR/8g benchmarks from daily gold and USD/LKR OHLC. "
            f"Gold source: {gold_label}. "
            "High/low are conservative, non-synchronous envelopes; these are not "
            "observed Pettah or intraday retail prices. Local quote markers distinguish "
            "Pettah news reports from published Sri Lankan dealer listings."
        ),
        "rows": candles,
    }
