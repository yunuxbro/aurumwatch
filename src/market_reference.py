import datetime as dt
import math
import statistics
from freshness import working_days_since

OUNCE_TO_GRAMS = 31.1034768
MAX_MARKET_AGE_WORKING_DAYS = 5
MAX_DEALER_AGE_WORKING_DAYS = 3


def build_market_reference(
    gold_date,
    gold_usd_oz,
    gold_source,
    fx_date,
    usd_lkr,
    fx_source,
    today=None,
):
    if any(value is None for value in (gold_date, fx_date, gold_usd_oz, usd_lkr)):
        return {"status": "unavailable"}

    gold_price = float(gold_usd_oz)
    exchange_rate = float(usd_lkr)
    if not math.isfinite(gold_price) or gold_price <= 0:
        raise ValueError("Gold price must be a positive finite value")
    if not math.isfinite(exchange_rate) or exchange_rate <= 0:
        raise ValueError("USD/LKR rate must be a positive finite value")

    today = today or dt.date.today()
    gold_day = dt.date.fromisoformat(gold_date)
    fx_day = dt.date.fromisoformat(fx_date)
    gold_age_days = (today - gold_day).days
    fx_age_days = (today - fx_day).days
    gold_working_age = working_days_since(gold_day, today)
    fx_working_age = working_days_since(fx_day, today)
    if gold_age_days < 0 or fx_age_days < 0:
        raise ValueError("Market observations cannot be dated in the future")

    lkr_per_gram_24k = gold_price * exchange_rate / OUNCE_TO_GRAMS
    display_gold_source = gold_source
    if "yfinance" in str(gold_source).lower() or "gc=f" in str(gold_source).lower():
        display_gold_source = "futures proxy (GC=F), not spot"
    return {
        "status": (
            "current"
            if max(gold_working_age, fx_working_age) <= MAX_MARKET_AGE_WORKING_DAYS
            else "stale"
        ),
        "gold_usd_per_oz": gold_price,
        "gold_date": gold_day.isoformat(),
        "gold_age_days": gold_age_days,
        "gold_age_working_days": gold_working_age,
        "gold_source": display_gold_source,
        "usd_lkr": exchange_rate,
        "fx_date": fx_day.isoformat(),
        "fx_age_days": fx_age_days,
        "fx_age_working_days": fx_working_age,
        "fx_source": fx_source,
        "lkr_per_gram_24k": lkr_per_gram_24k,
        "lkr_per_gram_22k": lkr_per_gram_24k * 22 / 24,
        "lkr_per_gram_18k": lkr_per_gram_24k * 18 / 24,
        "lkr_per_8g_24k": lkr_per_gram_24k * 8,
        "lkr_per_8g_22k": lkr_per_gram_24k * 8 * 22 / 24,
        "lkr_per_8g_18k": lkr_per_gram_24k * 8 * 18 / 24,
    }


def build_local_dealer_reference(rows, today=None):
    today = today or dt.date.today()
    candidates = []
    for row in rows:
        if row.get("karat") != 22 or row.get("side") not in {"selling", "listed"}:
            continue
        if row.get("currency") != "LKR":
            continue
        unit = row.get("unit")
        if unit not in {"gram", "pawn_8g"}:
            continue

        try:
            rate_date = dt.date.fromisoformat(row["rate_date"])
            price = float(row["price_lkr"])
        except (KeyError, TypeError, ValueError, OverflowError):
            continue
        age_days = (today - rate_date).days
        working_age = working_days_since(rate_date, today)
        if working_age is None or not math.isfinite(price) or price <= 0:
            continue

        price_per_8g = price * 8 if unit == "gram" else price
        institution = str(row.get("institution") or "").strip()
        if not institution:
            continue
        candidates.append({
            "institution": institution,
            "price_lkr_per_8g": price_per_8g,
            "working_days_old": working_age,
            "rate_date": rate_date,
            "source_url": row.get("source_url"),
        })

    if not candidates:
        return {
            "status": "unavailable",
            "source": "Published Sri Lankan dealer rates",
            "reason": "No current 22K selling or listed dealer rates are available.",
        }

    latest_date = max(row["rate_date"] for row in candidates)
    age_days = (today - latest_date).days
    working_age = working_days_since(latest_date, today)
    if working_age > MAX_DEALER_AGE_WORKING_DAYS:
        return {
            "status": "stale",
            "source": "Published Sri Lankan dealer rates",
            "rate_date": latest_date.isoformat(),
            "age_days": age_days,
            "working_days_old": working_age,
            "reason": "The latest 22K dealer rate is older than three working days.",
        }

    latest_rows = [row for row in candidates if row["rate_date"] == latest_date]
    grouped = {}
    for row in latest_rows:
        grouped.setdefault(row["institution"], []).append(row)

    institutions = [
        {
            "name": name,
            "price_lkr_per_8g": statistics.median(
                item["price_lkr_per_8g"] for item in quotes
            ),
            "source_url": next(
                (item["source_url"] for item in quotes if item["source_url"]),
                None,
            ),
        }
        for name, quotes in sorted(grouped.items())
    ]
    return {
        "status": "current",
        "source": "Published Sri Lankan dealer rates",
        "rate_date": latest_date.isoformat(),
        "age_days": age_days,
        "working_days_old": working_age,
        "price_lkr_per_8g": statistics.median(
            row["price_lkr_per_8g"] for row in institutions
        ),
        "quote_count": len(institutions),
        "institutions": institutions,
    }
