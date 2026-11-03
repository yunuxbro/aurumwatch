import datetime as dt

import pytest

from market_reference import build_market_reference


def test_market_reference_converts_spot_and_fx_to_22k_quote():
    result = build_market_reference(
        "2026-11-02", 3974.7, "gold feed",
        "2026-11-02", 332.5834, "fx feed",
        today=dt.date(2026, 11, 2),
    )

    expected_24k_per_gram = 3974.7 * 332.5834 / 31.1034768
    assert result["status"] == "current"
    assert result["lkr_per_gram_24k"] == pytest.approx(expected_24k_per_gram)
    assert result["lkr_per_gram_22k"] == pytest.approx(expected_24k_per_gram * 22 / 24)
    assert result["lkr_per_gram_18k"] == pytest.approx(expected_24k_per_gram * 18 / 24)
    assert result["lkr_per_8g_24k"] == pytest.approx(expected_24k_per_gram * 8)
    assert result["lkr_per_8g_22k"] == pytest.approx(
        expected_24k_per_gram * 8 * 22 / 24
    )
    assert result["lkr_per_8g_18k"] == pytest.approx(
        expected_24k_per_gram * 8 * 18 / 24
    )


def test_market_reference_marks_oldest_input_stale():
    result = build_market_reference(
        "2026-10-25", 4000, "gold feed",
        "2026-11-02", 330, "fx feed",
        today=dt.date(2026, 11, 2),
    )

    assert result["status"] == "stale"
    assert result["gold_age_days"] == 8
    assert result["fx_age_days"] == 0


@pytest.mark.parametrize("gold_price, exchange_rate", [(0, 330), (-1, 330), (4000, 0)])
def test_market_reference_rejects_nonpositive_rates(gold_price, exchange_rate):
    with pytest.raises(ValueError):
        build_market_reference(
            "2026-11-02", gold_price, "gold feed",
            "2026-11-02", exchange_rate, "fx feed",
            today=dt.date(2026, 11, 2),
        )
