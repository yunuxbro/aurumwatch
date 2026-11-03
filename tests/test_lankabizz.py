import datetime as dt
import sqlite3
from types import SimpleNamespace

import pytest

import db
import export_json
import ingest_lankabizz


NOW = dt.datetime(2026, 11, 3, 1, tzinfo=dt.timezone.utc)
CSV = """Institution,Institution Type,Commodity,Karat,Side,Unit,Unit Label,Price (LKR),Currency,Rate Date,Observed Date,Source URL
CMB Gold,gold_dealer,Gold,22ct,selling,pawn_8g,per 8g,"325,384",LKR,2026-11-02,2026-11-02T10:48:00.000Z,https://example.com/cmb
Devi Jewellers,gold_dealer,Gold,22ct,listed,gram,per gram,40825.5,LKR,2026-11-02,2026-11-02T10:48:00.000Z,https://example.com/devi
Central Bank of Sri Lanka,central_bank,Gold,24ct,benchmark,troy_ounce,per troy ounce,1301234.306,LKR,2026-11-02,2026-11-02T10:48:00.000Z,https://example.com/cbsl
"""


def test_extract_feed_config_reads_public_tracker_client_values():
    page = [{
        "content": {
            "rendered": """
                var API_URL = "https://lankabizz.net/bizz/api_rates.php?file=";
                var API_TOKEN = "public-test-token";
                var GOLD_FILE = "lanka_gold_rates.csv";
            """
        }
    }]

    assert ingest_lankabizz._extract_feed_config(page) == (
        "https://lankabizz.net/bizz/api_rates.php?file=",
        "public-test-token",
        "lanka_gold_rates.csv",
    )


def test_parse_csv_validates_rows_and_preserves_quote_and_observation_dates():
    rows = ingest_lankabizz._parse_csv(CSV.encode(), now=NOW)

    assert len(rows) == 3
    assert rows[0]["price_lkr"] == pytest.approx(325384)
    assert rows[0]["karat"] == 22
    assert rows[0]["rate_date"] == "2026-11-02"
    assert rows[0]["observed_at"] == "2026-11-02T10:48:00+00:00"
    assert rows[1]["side"] == "listed"
    assert rows[2]["side"] == "benchmark"


@pytest.mark.parametrize(
    "change",
    [
        ("325,384", "0"),
        ("325,384", "-12"),
        ("2026-11-02", "2099-01-01"),
    ],
)
def test_parse_csv_rejects_invalid_or_future_prices(change):
    bad_csv = CSV.replace(*change)

    with pytest.raises(ValueError):
        ingest_lankabizz._parse_csv(bad_csv.encode(), now=NOW)


def test_parse_csv_rejects_missing_timezone_and_unsafe_source_url():
    no_timezone = CSV.replace("2026-11-02T10:48:00.000Z", "2026-11-02T10:48:00")
    unsafe_source = CSV.replace("https://example.com/cmb", "javascript:alert(1)")

    with pytest.raises(ValueError, match="timezone"):
        ingest_lankabizz._parse_csv(no_timezone.encode(), now=NOW)
    with pytest.raises(ValueError, match="source URL"):
        ingest_lankabizz._parse_csv(unsafe_source.encode(), now=NOW)


def test_fetch_feed_uses_token_extracted_from_public_tracker(monkeypatch):
    page = [{
        "content": {
            "rendered": """
                var API_URL = "https://lankabizz.net/bizz/api_rates.php?file=";
                var API_TOKEN = "rotated-public-token";
                var GOLD_FILE = "lanka_gold_rates.csv";
            """
        },
        "modified": "2026-09-12T08:37:51",
    }]
    calls = []

    def fake_get(url, **kwargs):
        calls.append((url, kwargs))
        if len(calls) == 1:
            return SimpleNamespace(
                raise_for_status=lambda: None,
                json=lambda: page,
            )
        return SimpleNamespace(
            raise_for_status=lambda: None,
            content=CSV.encode(),
        )

    monkeypatch.setattr(ingest_lankabizz.requests, "get", fake_get)

    rows, content, modified = ingest_lankabizz.fetch_feed()

    assert len(rows) == 3
    assert content == CSV.encode()
    assert modified == "2026-09-12T08:37:51"
    assert calls[1][0].endswith("lanka_gold_rates.csv")
    assert calls[1][1]["headers"]["X-LankaBIZZ-Token"] == "rotated-public-token"


def test_quotes_persist_and_export_only_the_latest_feed_batch(monkeypatch, tmp_path):
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "aurum.db")
    monkeypatch.setattr(ingest_lankabizz, "save_raw", lambda *_: ("snapshot.csv", "digest"))
    monkeypatch.setattr(ingest_lankabizz, "log_raw", lambda *_: None)
    first_rows = ingest_lankabizz._parse_csv(CSV.encode(), now=NOW)
    ingest_lankabizz.save_quotes(first_rows, CSV.encode(), "2026-11-03T01:00:00+00:00")

    updated_csv = CSV.replace("325,384", "326,000")
    updated_rows = ingest_lankabizz._parse_csv(updated_csv.encode(), now=NOW)
    ingest_lankabizz.save_quotes(updated_rows, updated_csv.encode(), "2026-11-03T02:00:00+00:00")

    exported = export_json.dealer_quotes()
    assert exported["status"] == "available"
    assert exported["last_fetched_at"] == "2026-11-03T02:00:00+00:00"
    assert len(exported["rows"]) == 3
    assert exported["rows"][0]["price_lkr"] == pytest.approx(326000)
    with db.get_conn() as connection:
        history_count = connection.execute("SELECT COUNT(*) FROM dealer_quotes").fetchone()[0]
    assert history_count == 3
