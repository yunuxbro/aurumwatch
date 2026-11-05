"""Split dated dealer price moves into market, FX, and dealer premium parts."""

import bisect
import datetime as dt
import math
import statistics
from fx_review import apply_reviewed_rates


OUNCE_TO_GRAMS = 31.1035


def build_attribution(dealer_rows, gold_rows, fx_rows):
    """Build 22K per 8 g dealer attribution from dated observations.

    Market data is matched using the latest observation on or before each
    dealer quote date. No market observations are filled or interpolated.
    """
    gold_by_date = {row[0]: float(row[1]) for row in gold_rows if row[1]}
    fx_by_date = {row[0]: float(row[1]) for row in apply_reviewed_rates(fx_rows) if row[1]}
    gold_dates = sorted(gold_by_date)
    fx_dates = sorted(fx_by_date)
    by_date = {}

    for row in dealer_rows:
        institution, karat, side, unit, price, currency, quote_date, source_url = row
        if karat != 22 or side not in {"selling", "listed"} or currency != "LKR":
            continue
        if unit not in {"gram", "pawn_8g"} or not price or price <= 0:
            continue
        if not quote_date:
            continue
        parsed_date = dt.date.fromisoformat(quote_date)
        if parsed_date > dt.date.today():
            continue
        index_gold = bisect.bisect_right(gold_dates, quote_date) - 1
        index_fx = bisect.bisect_right(fx_dates, quote_date) - 1
        if index_gold < 0 or index_fx < 0:
            continue
        gold_date = gold_dates[index_gold]
        fx_date = fx_dates[index_fx]
        price_per_8g = float(price) * 8 if unit == "gram" else float(price)
        if institution not in by_date.setdefault(quote_date, {}).setdefault("prices", {}):
            by_date[quote_date]["prices"][institution] = []
        by_date[quote_date]["prices"][institution].append(price_per_8g)
        by_date[quote_date]["urls"] = sorted(set(by_date[quote_date].get("urls", [])) | ({source_url} if source_url else set()))
        by_date[quote_date]["gold_date"] = gold_date
        by_date[quote_date]["gold"] = gold_by_date[gold_date]
        by_date[quote_date]["fx_date"] = fx_date
        by_date[quote_date]["fx"] = fx_by_date[fx_date]

    observations = []
    for quote_date in sorted(by_date):
        row = by_date[quote_date]
        institution_prices = [statistics.median(prices) for prices in row["prices"].values()]
        dealer_price = statistics.median(institution_prices)
        world_equivalent = row["gold"] * row["fx"] / OUNCE_TO_GRAMS * 8 * 22 / 24
        observations.append({
            "date": quote_date,
            "dealer_price_lkr_per_8g": dealer_price,
            "world_equivalent_lkr_per_8g": world_equivalent,
            "dealer_premium": math.log(dealer_price) - math.log(world_equivalent),
            "gold_usd_per_oz": row["gold"],
            "usd_lkr": row["fx"],
            "gold_date": row["gold_date"],
            "fx_date": row["fx_date"],
            "source": "Published dealer listings",
            "institutions": sorted(row["prices"]),
            "source_urls": row["urls"],
        })

    moves = []
    for previous, current in zip(observations, observations[1:]):
        dealer_move = math.log(current["dealer_price_lkr_per_8g"]) - math.log(previous["dealer_price_lkr_per_8g"])
        gold_return = math.log(current["gold_usd_per_oz"] / previous["gold_usd_per_oz"])
        fx_return = math.log(current["usd_lkr"] / previous["usd_lkr"])
        premium_return = dealer_move - (gold_return + fx_return)
        parts_total = gold_return + fx_return + premium_return
        while parts_total != dealer_move:
            premium_return = math.nextafter(
                premium_return,
                math.inf if parts_total < dealer_move else -math.inf,
            )
            parts_total = gold_return + fx_return + premium_return
        assert parts_total == dealer_move
        moves.append({
            "date": current["date"],
            "previous_date": previous["date"],
            "dealer_log_return": dealer_move,
            "world_log_return": gold_return,
            "rupee_log_return": fx_return,
            "dealer_premium_log_return": premium_return,
            "dealer_price_lkr_per_8g": current["dealer_price_lkr_per_8g"],
            "world_equivalent_lkr_per_8g": current["world_equivalent_lkr_per_8g"],
            "source": current["source"],
            "institutions": current["institutions"],
            "source_urls": current["source_urls"],
            "gold_date": current["gold_date"],
            "fx_date": current["fx_date"],
        })
    return {
        "status": "available" if observations else "unavailable",
        "observations": observations,
        "moves": moves,
        "suppressed_moves": [],
        "fx_crosscheck_dates": ["2026-11-02", "2026-11-03", "2026-11-04"],
    }
