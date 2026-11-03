import csv

import market_candles
import pytest
from market_candles import _read_ohlc_snapshot


def test_reads_yfinance_multiheader_ohlc_snapshot(tmp_path):
    path = tmp_path / "market.csv"
    path.write_text(
        "Price,Close,High,Low,Open,Volume\n"
        "Ticker,GC=F,GC=F,GC=F,GC=F,GC=F\n"
        "Date,,,,,\n"
        "2026-11-02,4000,4020,3980,3990,100\n",
        encoding="utf-8",
    )

    assert _read_ohlc_snapshot(path) == [{
        "date": "2026-11-02",
        "open": 3990,
        "high": 4020,
        "low": 3980,
        "close": 4000,
    }]


def test_skips_invalid_candles_and_reads_stooq_headers(tmp_path):
    path = tmp_path / "market.csv"
    with path.open("w", newline="", encoding="utf-8") as output:
        writer = csv.writer(output)
        writer.writerow(["Date", "Open", "High", "Low", "Close", "Volume"])
        writer.writerow(["2026-11-02", 3990, 4020, 3980, 4000, 100])
        writer.writerow(["2026-11-03", 4010, 4000, 3990, 4015, 100])

    assert [row["date"] for row in _read_ohlc_snapshot(path)] == ["2026-11-02"]


def test_market_benchmark_exposes_both_22k_and_24k_prices(monkeypatch, tmp_path):
    gold_path = tmp_path / "gold.csv"
    fx_path = tmp_path / "fx.csv"
    monkeypatch.setattr(
        market_candles,
        "_source_snapshot",
        lambda table, source_column, source_label: (gold_path if table == "world_gold" else fx_path, None),
    )
    snapshots = {
        gold_path: [{"date": "2026-11-03", "open": 4000, "high": 4100, "low": 3900, "close": 4050}],
        fx_path: [{"date": "2026-11-03", "open": 330, "high": 332, "low": 329, "close": 331}],
    }
    monkeypatch.setattr(market_candles, "_read_ohlc_snapshot", lambda path: snapshots[path])

    result = market_candles.build_market_candles()

    candle = result["rows"][0]
    assert result["status"] == "available"
    assert candle["close_24k"] == pytest.approx(candle["close_22k"] * 24 / 22)
    assert candle["open"] == candle["open_22k"]
    assert candle["close"] == candle["close_22k"]
