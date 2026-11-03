import io
import hashlib
import math
import pandas as pd
import requests

from db import get_conn, init_db, log_raw
from utils import save_raw

STOOQ = "https://stooq.com/q/d/l/?s=xauusd&i=d"


def _validated_rows(rows, source):
    cleaned = []
    seen = set()
    for date, value, _ in rows:
        try:
            day = pd.Timestamp(date).strftime("%Y-%m-%d")
            price = float(value)
        except (TypeError, ValueError, OverflowError) as error:
            raise ValueError(f"{source} returned an invalid gold observation") from error
        if not math.isfinite(price) or price <= 0:
            raise ValueError(f"{source} returned an invalid gold price for {day}")
        if day in seen:
            continue
        seen.add(day)
        cleaned.append((day, price, source))
    if not cleaned:
        raise ValueError(f"{source} returned no usable gold-price observations")
    return sorted(cleaned, key=lambda row: row[0])


def _save_source_snapshot(content, prefix):
    digest = hashlib.sha256(content).hexdigest()[:16]
    return save_raw(content, f"{prefix}_{digest}.csv")


def from_stooq():
    r = requests.get(STOOQ, timeout=30)
    r.raise_for_status()
    df = pd.read_csv(io.BytesIO(r.content))
    if not {"Date", "Close"}.issubset(df.columns):
        raise ValueError("Stooq response is missing Date or Close columns")
    rows = _validated_rows(
        ((row.Date, row.Close, "stooq") for row in df.itertuples()),
        "Stooq XAU/USD",
    )
    path, sha = _save_source_snapshot(r.content, "world_gold_stooq")
    log_raw(path, sha, "stooq")
    return rows

def from_yfinance():
    import yfinance as yf
    df = yf.download(
        "GC=F", start="2015-01-01", progress=False, auto_adjust=False, threads=False
    )
    if df.empty or "Close" not in df:
        raise ValueError("Yahoo Finance returned no gold-futures closing prices")
    csv = df.to_csv().encode()
    close = df["Close"].squeeze()
    if isinstance(close, pd.DataFrame):
        close = close.iloc[:, 0]
    rows = _validated_rows(
        ((date, value, "yfinance GC=F") for date, value in close.dropna().items()),
        "Yahoo Finance GC=F",
    )
    path, sha = _save_source_snapshot(csv, "world_gold_yfinance")
    log_raw(path, sha, "yfinance GC=F (futures proxy)")
    return rows

def main():
    init_db()
    try:
        rows = from_stooq()
        source = "Stooq XAU/USD"
    except (requests.RequestException, ValueError, KeyError, pd.errors.ParserError) as stooq_error:
        try:
            rows = from_yfinance()
            source = "Yahoo Finance GC=F futures proxy"
            print(f"Stooq unavailable ({stooq_error}); using Yahoo Finance futures proxy")
        except Exception as fallback_error:
            raise RuntimeError(
                f"World gold refresh failed for Stooq and Yahoo Finance: "
                f"{stooq_error}; {fallback_error}"
            ) from fallback_error
    with get_conn() as c:
        c.executemany("INSERT OR REPLACE INTO world_gold VALUES (?,?,?)", rows)
    print(f"Saved {len(rows)} world-gold rows from {source}; latest={rows[-1][0]}")

if __name__ == "__main__":
    main()