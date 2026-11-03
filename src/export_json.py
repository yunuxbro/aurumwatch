import argparse, json, pathlib
from clean import pettah_joined
from decompose import decompose
from risk import stock_risk
from anomaly import flag_premium_jumps
from quality import report
from db import get_conn
from market_reference import build_market_reference

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
    return build_market_reference(
        gold[0], gold[1], gold[2], fx[0], fx[1], fx[2]
    )

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
        "source": "LankaBIZZ Gold Price Tracker",
        "last_fetched_at": latest_fetch,
        "rows": [dict(zip(columns, record)) for record in records],
    }

def main(price=None):
    j = pettah_joined(22)
    write("history", rows(j[["date", "local", "local_equiv", "premium", "lag_days"]]))
    write("moves", rows(decompose(22)))
    write("anomalies", rows(flag_premium_jumps(22)))
    write("risk", {"h7": stock_risk(7, price), "h14": stock_risk(14, price)})
    write("health", report())
    write("market_reference", market_reference())
    write("dealer_quotes", dealer_quotes())

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--price", type=float, default=None)
    main(ap.parse_args().price)