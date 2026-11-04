import datetime as dt
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from freshness import source_freshness, working_days_since


def test_source_freshness_uses_three_working_days_for_local_quotes():
    today = dt.date(2026, 11, 5)  # Thursday
    three_workdays_ago = "2026-11-02"  # Monday
    four_workdays_ago = "2026-10-30"  # Friday

    assert working_days_since(three_workdays_ago, today) == 3
    assert source_freshness("pettah", three_workdays_ago, today)["status"] == "current"
    assert source_freshness("dealer", four_workdays_ago, today)["status"] == "stale"


def test_source_freshness_uses_five_working_days_for_market_feeds():
    today = dt.date(2026, 11, 9)  # Monday
    four_workdays_ago = "2026-11-03"  # Tuesday
    six_workdays_ago = "2026-10-30"  # Friday

    assert source_freshness("gold", four_workdays_ago, today)["status"] == "current"
    assert source_freshness("fx", six_workdays_ago, today)["status"] == "stale"
