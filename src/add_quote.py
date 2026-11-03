import argparse
import csv
import datetime as dt
import math
import pathlib

from db import get_conn, init_db

PROJECT_ROOT = pathlib.Path(__file__).resolve().parent.parent
QUOTE_FILE = PROJECT_ROOT / "data" / "pettah_quotes.csv"
FIELDS = ["date", "karat", "lkr_per_8g", "outlet", "url"]


def add_quote(date, karat, price, outlet, url):
    try:
        quote_date = dt.date.fromisoformat(date)
    except ValueError as error:
        raise ValueError("date must use YYYY-MM-DD format") from error
    if quote_date > dt.date.today():
        raise ValueError("quote date cannot be in the future")
    if karat not in (18, 20, 21, 22, 24):
        raise ValueError("karat must be 18, 20, 21, 22, or 24")
    if not math.isfinite(price) or price <= 0:
        raise ValueError("quote price must be a positive finite number")
    if not outlet.strip():
        raise ValueError("outlet/source must not be empty")
    outlet = outlet.strip()
    if url and not url.startswith(("https://", "http://")):
        raise ValueError("source URL must start with http:// or https://")

    QUOTE_FILE.parent.mkdir(parents=True, exist_ok=True)
    rows = []
    if QUOTE_FILE.exists():
        with QUOTE_FILE.open(newline="", encoding="utf-8") as quote_file:
            rows = [
                row for row in csv.DictReader(quote_file)
                if not (
                    row["date"] == date
                    and row["karat"] == str(karat)
                    and row["outlet"] == outlet
                )
            ]
    rows.append({
        "date": date,
        "karat": str(karat),
        "lkr_per_8g": str(price),
        "outlet": outlet,
        "url": url,
    })
    rows.sort(key=lambda row: (row["date"], row["karat"], row["outlet"]))
    temporary = QUOTE_FILE.with_suffix(".csv.tmp")
    with temporary.open("w", newline="", encoding="utf-8") as quote_file:
        writer = csv.DictWriter(quote_file, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    temporary.replace(QUOTE_FILE)

    init_db()
    with get_conn() as connection:
        connection.execute(
            "INSERT OR REPLACE INTO pettah VALUES (?,?,?,?,?)",
            (date, karat, price, outlet, url),
        )


def main():
    parser = argparse.ArgumentParser(description="Add a verified local gold quote.")
    parser.add_argument("date", help="Quote date in YYYY-MM-DD format")
    parser.add_argument("karat", type=int, choices=(18, 20, 21, 22, 24))
    parser.add_argument("price", type=float, help="Local price in LKR per 8 g")
    parser.add_argument("outlet", help="Shop or reporting source")
    parser.add_argument("url", nargs="?", default="", help="Optional source URL")
    args = parser.parse_args()
    add_quote(args.date, args.karat, args.price, args.outlet, args.url)
    print(f"Added verified {args.karat}K quote: {args.date}, LKR {args.price:,.2f} per 8 g")


if __name__ == "__main__":
    main()