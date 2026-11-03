import datetime as dt
import math
import statistics
from collections import defaultdict


SUPPORTED_KARATS = {22, 24}
SUPPORTED_DEALER_UNITS = {"gram", "pawn_8g"}


def _valid_date(value, today):
    try:
        day = dt.date.fromisoformat(str(value))
    except (TypeError, ValueError):
        return None
    return day if day <= today else None


def _positive_price(value):
    try:
        price = float(value)
    except (TypeError, ValueError, OverflowError):
        return None
    return price if math.isfinite(price) and price > 0 else None


def build_local_quote_history(pettah_rows, dealer_rows, today=None):
    """Prefer reported Pettah observations, with dated dealer listings as fallback."""
    today = today or dt.date.today()
    pettah_quotes = defaultdict(lambda: defaultdict(list))
    for row in pettah_rows:
        try:
            karat = int(row["karat"])
        except (KeyError, TypeError, ValueError, OverflowError):
            continue
        day = _valid_date(row.get("date"), today)
        price = _positive_price(row.get("lkr_per_8g"))
        if day is None or karat not in SUPPORTED_KARATS or price is None:
            continue
        outlet = str(row.get("outlet") or "Reported outlet").strip()
        pettah_quotes[(day, karat)][outlet].append({
            "price_lkr_per_8g": price,
            "source_url": row.get("url"),
        })

    observations = []
    pettah_keys = set()
    for (day, karat), outlet_quotes in pettah_quotes.items():
        pettah_keys.add((day, karat))
        outlet_prices = []
        source_urls = set()
        for quotes in outlet_quotes.values():
            outlet_prices.append(statistics.median(
                quote["price_lkr_per_8g"] for quote in quotes
            ))
            source_urls.update(
                quote["source_url"] for quote in quotes if quote["source_url"]
            )
        observations.append({
            "date": day.isoformat(),
            "karat": karat,
            "price_lkr_per_8g": statistics.median(outlet_prices),
            "source_type": "pettah",
            "source": "Pettah news reports",
            "contributors": sorted(outlet_quotes),
            "source_urls": sorted(source_urls),
            "quote_count": len(outlet_prices),
        })

    dealer_quotes = defaultdict(lambda: defaultdict(list))
    for row in dealer_rows:
        try:
            karat = int(row["karat"])
        except (KeyError, TypeError, ValueError, OverflowError):
            continue
        day = _valid_date(row.get("rate_date"), today)
        if (
            day is None
            or karat not in SUPPORTED_KARATS
            or row.get("side") not in {"selling", "listed"}
            or str(row.get("currency", "")).upper() != "LKR"
            or str(row.get("commodity", "")).strip().lower() not in {"gold", "gold jewellery"}
        ):
            continue
        unit = row.get("unit")
        if unit not in SUPPORTED_DEALER_UNITS:
            continue
        price = _positive_price(row.get("price_lkr"))
        institution = str(row.get("institution") or "").strip()
        if price is None or not institution:
            continue
        price_per_8g = price * 8 if unit == "gram" else price
        dealer_quotes[(day, karat)][institution].append({
            "price_lkr_per_8g": price_per_8g,
            "source_url": row.get("source_url"),
        })

    for (day, karat), institutions in dealer_quotes.items():
        if (day, karat) in pettah_keys:
            continue
        institution_quotes = []
        source_urls = set()
        for quotes in institutions.values():
            institution_quotes.append(statistics.median(
                quote["price_lkr_per_8g"] for quote in quotes
            ))
            source_urls.update(
                quote["source_url"] for quote in quotes if quote["source_url"]
            )
        observations.append({
            "date": day.isoformat(),
            "karat": karat,
            "price_lkr_per_8g": statistics.median(institution_quotes),
            "source_type": "dealer",
            "source": "Published dealer listings",
            "contributors": sorted(institutions),
            "source_urls": sorted(source_urls),
            "quote_count": len(institution_quotes),
        })

    return sorted(observations, key=lambda row: (row["date"], row["karat"]))
