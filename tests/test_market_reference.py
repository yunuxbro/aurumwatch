import datetime as dt

import pytest

from market_reference import build_local_dealer_reference, build_market_reference


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


def test_local_dealer_reference_uses_fresh_22k_selling_and_listed_rates():
    rows = [
        {
            "institution": "CMB Gold",
            "karat": 22,
            "side": "selling",
            "unit": "pawn_8g",
            "price_lkr": 325384,
            "currency": "LKR",
            "rate_date": "2026-11-02",
            "source_url": "https://example.com/cmb",
        },
        {
            "institution": "Devi Jewellers",
            "karat": 22,
            "side": "listed",
            "unit": "gram",
            "price_lkr": 40825,
            "currency": "LKR",
            "rate_date": "2026-11-02",
            "source_url": "https://example.com/devi",
        },
        {
            "institution": "Old quote",
            "karat": 22,
            "side": "listed",
            "unit": "pawn_8g",
            "price_lkr": 300000,
            "currency": "LKR",
            "rate_date": "2026-10-19",
            "source_url": "https://example.com/old",
        },
        {
            "institution": "Buying price",
            "karat": 22,
            "side": "buying",
            "unit": "pawn_8g",
            "price_lkr": 310000,
            "currency": "LKR",
            "rate_date": "2026-11-02",
            "source_url": "https://example.com/buying",
        },
    ]

    result = build_local_dealer_reference(rows, today=dt.date(2026, 11, 3))

    assert result["status"] == "current"
    assert result["rate_date"] == "2026-11-02"
    assert result["quote_count"] == 2
    assert result["price_lkr_per_8g"] == pytest.approx((325384 + 40825 * 8) / 2)


def test_local_dealer_reference_does_not_use_stale_or_future_rates():
    rows = [
        {
            "institution": "Old quote",
            "karat": 22,
            "side": "listed",
            "unit": "pawn_8g",
            "price_lkr": 300000,
            "currency": "LKR",
            "rate_date": "2026-10-19",
            "source_url": "https://example.com/old",
        },
        {
            "institution": "Future quote",
            "karat": 22,
            "side": "selling",
            "unit": "pawn_8g",
            "price_lkr": 320000,
            "currency": "LKR",
            "rate_date": "2026-11-04",
            "source_url": "https://example.com/future",
        },
    ]

    result = build_local_dealer_reference(rows, today=dt.date(2026, 11, 3))

    assert result["status"] == "stale"
    assert result["rate_date"] == "2026-10-19"
    assert "price_lkr_per_8g" not in result
