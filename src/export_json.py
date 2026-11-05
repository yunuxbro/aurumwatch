import argparse, json, pathlib
from clean import market_daily, pettah_joined
from decompose import decompose
from risk import stock_risk
from anomaly import flag_premium_jumps
from quality import report
from db import get_conn
from market_reference import build_local_dealer_reference, build_market_reference
from market_candles import build_market_candles
from local_quotes import build_local_quote_history
from analysis.attribution import build_attribution
from fx_review import reviewed_rate

OUT = pathlib.Path(__file__).resolve().parent.parent / "web" / "public" / "data"

def _fallback(o):
    return o.item() if hasattr(o, "item") else str(o)

def write(name, obj):
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{name}.json").write_text(json.dumps(obj, indent=2, default=_fallback))
    print("wrote", name)

def rows(df):
    df = df.copy()
    for c in df.columns:
        if str(df[c].dtype).startswith("datetime"):
            df[c] = df[c].dt.strftime("%Y-%m-%d")
    return df.astype(object).where(df.notna(), None).to_dict(orient="records")

def market_reference():
    with get_conn() as connection:
        gold = connection.execute(
            "SELECT date, usd_oz, source FROM world_gold ORDER BY date DESC LIMIT 1"
        ).fetchone()
        fx = connection.execute(
            "SELECT date, lkr_per_usd, source FROM usdlkr ORDER BY date DESC LIMIT 1"
        ).fetchone()
    if gold is None or fx is None:
        return {"status": "unavailable"}
    fx_rate = reviewed_rate(fx[0], fx[1])
    fx_source = f"{fx[2]} + CBSL cross-check" if fx_rate != fx[1] else fx[2]
    return build_market_reference(gold[0], gold[1], gold[2], fx[0], fx_rate, fx_source)

def dealer_quotes():
    with get_conn() as connection:
        latest_fetch = connection.execute(
            "SELECT MAX(fetched_at) FROM dealer_quotes"
        ).fetchone()[0]
        if latest_fetch is None:
            return {"status": "unavailable", "rows": []}
        records = connection.execute(
            """
            SELECT institution, institution_type, commodity, karat, side, unit,
                   unit_label, price_lkr, currency, rate_date, observed_at, source_url
            FROM dealer_quotes
            WHERE fetched_at = ?
            ORDER BY institution, karat DESC, side, unit
            """,
            (latest_fetch,),
        ).fetchall()
    columns = (
        "institution", "institution_type", "commodity", "karat", "side", "unit",
        "unit_label", "price_lkr", "currency", "rate_date", "observed_at", "source_url",
    )
    return {
        "status": "available" if records else "unavailable",
        "source": "Published Sri Lankan dealer feed",
        "last_fetched_at": latest_fetch,
        "rows": [dict(zip(columns, record)) for record in records],
    }

def local_quote_history():
    with get_conn() as connection:
        pettah_records = connection.execute(
            "SELECT date, karat, lkr_per_8g, outlet, url FROM pettah ORDER BY date"
        ).fetchall()
        dealer_records = connection.execute(
            """
            SELECT institution, commodity, karat, side, unit, price_lkr,
                   currency, rate_date, source_url
            FROM dealer_quotes
            ORDER BY rate_date
            """
        ).fetchall()
    pettah_columns = ("date", "karat", "lkr_per_8g", "outlet", "url")
    dealer_columns = (
        "institution", "commodity", "karat", "side", "unit", "price_lkr",
        "currency", "rate_date", "source_url",
    )
    return build_local_quote_history(
        [dict(zip(pettah_columns, record)) for record in pettah_records],
        [dict(zip(dealer_columns, record)) for record in dealer_records],
    )

def dealer_attribution():
    with get_conn() as connection:
        dealer_rows = connection.execute(
            """
            SELECT institution, karat, side, unit, price_lkr, currency,
                   rate_date, source_url
            FROM dealer_quotes
            ORDER BY rate_date, institution
            """
        ).fetchall()
        gold_rows = connection.execute(
            "SELECT date, usd_oz FROM world_gold ORDER BY date"
        ).fetchall()
        fx_rows = connection.execute(
            "SELECT date, lkr_per_usd FROM usdlkr ORDER BY date"
        ).fetchall()
    return build_attribution(dealer_rows, gold_rows, fx_rows)

def market_history():
    market = market_daily().dropna(subset=["usd_oz", "lkr_per_usd"]).copy()
    market["world_equivalent"] = (
        market.usd_oz * market.lkr_per_usd / 31.1035 * 8 * 22 / 24
    )
    pettah = pettah_joined(22)
    markers = rows(pettah[["date", "market_date", "local", "lag_days"]])
    for marker in markers:
        marker["price_lkr_per_8g"] = marker.pop("local")
    return {
        "status": "available" if len(market) else "unavailable",
        "as_of_date": market.date.max().strftime("%Y-%m-%d") if len(market) else None,
        "rows": rows(market[["date", "world_equivalent"]]),
        "pettah_markers": markers,
        "basis": "Daily 22K world-equivalent close from international gold and USD/LKR; Pettah reports remain dated point observations.",
    }

def main(price=None):
    j = pettah_joined(22)
    dealer_data = dealer_quotes()
    dealer_reference = build_local_dealer_reference(dealer_data["rows"])
    risk_price = price
    risk_source = None
    risk_date = None
    if risk_price is None and dealer_reference["status"] == "current":
        risk_price = dealer_reference["price_lkr_per_8g"]
        risk_source = "current Sri Lankan 22K dealer median"
        risk_date = dealer_reference["rate_date"]

    reference = market_reference()
    reference["dealer_reference"] = dealer_reference
    write("history", rows(j[["date", "local", "local_equiv", "premium", "lag_days"]]))
    write("moves", rows(decompose(22)))
    write("anomalies", rows(flag_premium_jumps(22)))
    write("risk", {
        "h7": stock_risk(7, risk_price, start_source=risk_source, start_date=risk_date, dealer_quote_count=dealer_reference.get("quote_count")),
        "h14": stock_risk(14, risk_price, start_source=risk_source, start_date=risk_date, dealer_quote_count=dealer_reference.get("quote_count")),
    })
    write("health", report())
    write("market_reference", reference)
    write("dealer_quotes", dealer_data)
    write("local_quotes", local_quote_history())
    write("attribution", dealer_attribution())
    write("market_history", market_history())
    write("candles", build_market_candles())

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--price", type=float, default=None)
    main(ap.parse_args().price)
