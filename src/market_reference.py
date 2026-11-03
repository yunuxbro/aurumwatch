import datetime as dt
import math

OUNCE_TO_GRAMS = 31.1034768
MAX_MARKET_AGE_DAYS = 5


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
    if gold_age_days < 0 or fx_age_days < 0:
        raise ValueError("Market observations cannot be dated in the future")

    lkr_per_gram_24k = gold_price * exchange_rate / OUNCE_TO_GRAMS
    return {
        "status": (
            "current"
            if max(gold_age_days, fx_age_days) <= MAX_MARKET_AGE_DAYS
            else "stale"
        ),
        "gold_usd_per_oz": gold_price,
        "gold_date": gold_day.isoformat(),
        "gold_age_days": gold_age_days,
        "gold_source": gold_source,
        "usd_lkr": exchange_rate,
        "fx_date": fx_day.isoformat(),
        "fx_age_days": fx_age_days,
        "fx_source": fx_source,
        "lkr_per_gram_24k": lkr_per_gram_24k,
        "lkr_per_gram_22k": lkr_per_gram_24k * 22 / 24,
        "lkr_per_gram_18k": lkr_per_gram_24k * 18 / 24,
        "lkr_per_8g_24k": lkr_per_gram_24k * 8,
        "lkr_per_8g_22k": lkr_per_gram_24k * 8 * 22 / 24,
        "lkr_per_8g_18k": lkr_per_gram_24k * 8 * 18 / 24,
    }
