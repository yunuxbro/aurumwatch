import datetime as dt

import pytest

from local_quotes import build_local_quote_history


def test_local_quote_history_prefers_pettah_and_falls_back_to_dealer_by_date_and_karat():
    pettah = [{
        "date": "2026-11-02",
        "karat": 22,
        "lkr_per_8g": 321000,
        "outlet": "News outlet",
        "url": "https://example.com/pettah",
    }]
    dealers = [
        {
            "institution": "Dealer A",
            "commodity": "Gold",
            "karat": 22,
            "side": "listed",
            "unit": "gram",
            "price_lkr": 41000,
            "currency": "LKR",
            "rate_date": "2026-11-02",
            "source_url": "https://example.com/a",
        },
        {
            "institution": "Dealer A",
            "commodity": "Gold",
            "karat": 22,
            "side": "listed",
            "unit": "pawn_8g",
            "price_lkr": 328000,
            "currency": "LKR",
            "rate_date": "2026-11-02",
            "source_url": "https://example.com/a",
        },
        {
            "institution": "Dealer B",
            "commodity": "Gold",
            "karat": 22,
            "side": "selling",
            "unit": "pawn_8g",
            "price_lkr": 326000,
            "currency": "LKR",
            "rate_date": "2026-11-02",
            "source_url": "https://example.com/b",
        },
        {
            "institution": "Dealer A",
            "commodity": "Gold",
            "karat": 24,
            "side": "listed",
            "unit": "pawn_8g",
            "price_lkr": 350000,
            "currency": "LKR",
            "rate_date": "2026-11-02",
            "source_url": "https://example.com/a",
        },
    ]

    result = build_local_quote_history(
        pettah,
        dealers,
        today=dt.date(2026, 11, 3),
    )

    assert result == [
        {
            "date": "2026-11-02",
            "karat": 22,
            "price_lkr_per_8g": 321000,
            "source_type": "pettah",
            "source": "Pettah news reports",
            "contributors": ["News outlet"],
            "source_urls": ["https://example.com/pettah"],
            "quote_count": 1,
        },
        {
            "date": "2026-11-02",
            "karat": 24,
            "price_lkr_per_8g": pytest.approx(350000),
            "source_type": "dealer",
            "source": "Published dealer listings",
            "contributors": ["Dealer A"],
            "source_urls": ["https://example.com/a"],
            "quote_count": 1,
        },
    ]


def test_local_quote_history_medians_per_institution_and_rejects_invalid_or_future_rows():
    dealers = [
        {
            "institution": "Dealer A",
            "commodity": "gold",
            "karat": 22,
            "side": "selling",
            "unit": "pawn_8g",
            "price_lkr": 320000,
            "currency": "LKR",
            "rate_date": "2026-11-01",
            "source_url": "https://example.com/a",
        },
        {
            "institution": "Dealer A",
            "commodity": "gold",
            "karat": 22,
            "side": "listed",
            "unit": "gram",
            "price_lkr": 40000,
            "currency": "LKR",
            "rate_date": "2026-11-01",
            "source_url": "https://example.com/a",
        },
        {
            "institution": "Dealer B",
            "commodity": "gold",
            "karat": 22,
            "side": "selling",
            "unit": "pawn_8g",
            "price_lkr": 340000,
            "currency": "LKR",
            "rate_date": "2026-11-01",
            "source_url": "https://example.com/b",
        },
        {
            "institution": "Future Dealer",
            "commodity": "gold",
            "karat": 22,
            "side": "selling",
            "unit": "pawn_8g",
            "price_lkr": 900000,
            "currency": "LKR",
            "rate_date": "2026-11-04",
            "source_url": "https://example.com/future",
        },
        {
            "institution": "Buyer",
            "commodity": "gold",
            "karat": 22,
            "side": "buying",
            "unit": "pawn_8g",
            "price_lkr": 100000,
            "currency": "LKR",
            "rate_date": "2026-11-01",
            "source_url": "https://example.com/buyer",
        },
    ]

    result = build_local_quote_history(
        [],
        dealers,
        today=dt.date(2026, 11, 3),
    )

    assert len(result) == 1
    assert result[0]["price_lkr_per_8g"] == pytest.approx(330000)
    assert result[0]["source_type"] == "dealer"
    assert result[0]["contributors"] == ["Dealer A", "Dealer B"]
