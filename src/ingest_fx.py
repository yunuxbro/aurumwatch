import hashlib
import math
import pathlib

import pandas as pd

from db import get_conn, init_db, log_raw
from utils import save_raw

PROJECT_ROOT = pathlib.Path(__file__).resolve().parent.parent
FILE = PROJECT_ROOT / "data" / "raw" / "cbsl_usdlkr.csv"
DATE_COL = "Date"
RATE_COL = "Rate"


def _validated_rows(rows, source):
    cleaned = []
    seen = set()
    for date, value, _ in rows:
        try:
            day = pd.Timestamp(date).strftime("%Y-%m-%d")
            rate = float(value)
        except (TypeError, ValueError, OverflowError) as error:
            raise ValueError(f"{source} returned an invalid USD/LKR observation") from error
        if not math.isfinite(rate) or rate <= 0:
            raise ValueError(f"{source} returned an invalid USD/LKR rate for {day}")
        if day in seen:
            continue
        seen.add(day)
        cleaned.append((day, rate, source))
    if not cleaned:
        raise ValueError(f"{source} returned no usable USD/LKR observations")
    return sorted(cleaned, key=lambda row: row[0])


def _save_source_snapshot(content, prefix):
    digest = hashlib.sha256(content).hexdigest()[:16]
    return save_raw(content, f"{prefix}_{digest}.csv")


def from_cbsl():
    raw = FILE.read_bytes()
    df = pd.read_csv(FILE)
    if not {DATE_COL, RATE_COL}.issubset(df.columns):
        raise ValueError(f"CBSL file must contain {DATE_COL} and {RATE_COL} columns")
    df[DATE_COL] = pd.to_datetime(df[DATE_COL], errors="raise").dt.strftime("%Y-%m-%d")
    rows = _validated_rows(
        ((row[DATE_COL], row[RATE_COL], "CBSL") for _, row in df.iterrows()),
        "CBSL",
    )
    path, sha = _save_source_snapshot(raw, "cbsl_usdlkr")
    log_raw(path, sha, "CBSL manual download")
    return rows


def from_yfinance():
    import yfinance as yf

    df = yf.download(
        "LKR=X", start="2015-01-01", progress=False, auto_adjust=False, threads=False
    )
    if df.empty or "Close" not in df:
        raise ValueError("Yahoo Finance returned no USD/LKR closing rates")
    close = df["Close"].squeeze()
    if isinstance(close, pd.DataFrame):
        close = close.iloc[:, 0]
    rows = _validated_rows(
        ((date, value, "yfinance LKR=X") for date, value in close.dropna().items()),
        "Yahoo Finance LKR=X",
    )
    path, sha = _save_source_snapshot(df.to_csv().encode(), "usdlkr_yfinance")
    log_raw(path, sha, "yfinance LKR=X (market rate, fallback)")
    return rows


def main():
    init_db()
    if FILE.exists():
        rows = from_cbsl()
        source = "CBSL"
    else:
        rows = from_yfinance()
        source = "Yahoo Finance LKR=X"
    with get_conn() as c:
        c.executemany("INSERT OR REPLACE INTO usdlkr VALUES (?,?,?)", rows)
    print(f"Saved {len(rows)} USD/LKR rows from {source}; latest={rows[-1][0]}")


if __name__ == "__main__":
    main()
