import csv
import datetime as dt
import hashlib
import io
import math
import re
from urllib.parse import quote, urlsplit

import requests

from db import get_conn, init_db, log_raw
from utils import save_raw

PAGE_API = "https://lankabizz.net/wp-json/wp/v2/pages"
PAGE_SLUG = "gold-price-tracker"
MAX_CSV_BYTES = 5 * 1024 * 1024
MAX_ROWS = 2000
REQUIRED_COLUMNS = {
    "Institution",
    "Institution Type",
    "Commodity",
    "Karat",
    "Side",
    "Unit",
    "Unit Label",
    "Price (LKR)",
    "Currency",
    "Rate Date",
    "Observed Date",
    "Source URL",
}


def _extract_feed_config(page):
    if not isinstance(page, list) or not page:
        raise ValueError("Dealer tracker page was not found")
    try:
        content = page[0]["content"]["rendered"]
    except (KeyError, TypeError) as error:
        raise ValueError("Dealer tracker page has no rendered content") from error

    def value(name):
        match = re.search(
            rf"\bvar\s+{name}\s*=\s*(['\"])(.*?)\1",
            content,
            flags=re.DOTALL,
        )
        if not match:
            raise ValueError(f"Dealer tracker is missing {name}")
        return match.group(2).strip()

    api_url = value("API_URL")
    token = value("API_TOKEN")
    filename = value("GOLD_FILE")
    parsed_url = urlsplit(api_url)
    if (
        parsed_url.scheme != "https"
        or parsed_url.hostname != "lankabizz.net"
        or parsed_url.path != "/bizz/api_rates.php"
        or parsed_url.query != "file="
    ):
        raise ValueError("Dealer tracker supplied an unexpected feed URL")
    if not re.fullmatch(r"[A-Za-z0-9._-]+\.csv", filename):
        raise ValueError("Dealer tracker supplied an invalid CSV filename")
    if not token or len(token) > 256:
        raise ValueError("Dealer tracker supplied an invalid feed token")
    return api_url, token, filename


def _parse_observed_at(value):
    try:
        observed_at = dt.datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except (TypeError, ValueError) as error:
        raise ValueError("Dealer feed returned an invalid observation timestamp") from error
    if observed_at.tzinfo is None:
        raise ValueError("Dealer observation timestamp has no timezone")
    return observed_at.astimezone(dt.timezone.utc).isoformat(timespec="seconds")


def _parse_csv(content, now=None):
    if len(content) > MAX_CSV_BYTES:
        raise ValueError("Dealer CSV exceeds the 5 MB limit")
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise ValueError("Dealer CSV is not valid UTF-8") from error

    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None or not REQUIRED_COLUMNS.issubset(reader.fieldnames):
        raise ValueError("Dealer CSV is missing required columns")

    checked_at = now or dt.datetime.now(dt.timezone.utc)
    latest_allowed_rate_date = checked_at.date() + dt.timedelta(days=1)
    rows = []
    seen = set()
    for row_number, raw in enumerate(reader, start=2):
        if row_number > MAX_ROWS + 1:
            raise ValueError(f"Dealer CSV exceeds the {MAX_ROWS}-row limit")
        try:
            institution = raw["Institution"].strip()
            institution_type = raw["Institution Type"].strip()
            commodity = raw["Commodity"].strip()
            karat_match = re.fullmatch(
                r"(\d{1,2})\s*(?:ct|k)?",
                raw["Karat"].strip(),
                flags=re.IGNORECASE,
            )
            side = raw["Side"].strip().lower()
            unit = raw["Unit"].strip().lower()
            unit_label = raw["Unit Label"].strip()
            price_lkr = float(raw["Price (LKR)"].replace(",", "").strip())
            currency = raw["Currency"].strip().upper()
            rate_date = dt.date.fromisoformat(raw["Rate Date"].strip()).isoformat()
            source_url = raw["Source URL"].strip()
        except (AttributeError, KeyError, TypeError, ValueError, OverflowError) as error:
            raise ValueError(f"Dealer CSV has an invalid row at line {row_number}") from error

        try:
            observed_at = _parse_observed_at(raw["Observed Date"])
        except ValueError as error:
            raise ValueError(f"{error} at line {row_number}") from error

        parsed_source = urlsplit(source_url)
        if not institution or len(institution) > 120 or len(institution_type) > 80:
            raise ValueError(f"Dealer CSV has an invalid institution at line {row_number}")
        if not commodity or len(commodity) > 50 or not unit or len(unit) > 40:
            raise ValueError(f"Dealer CSV has invalid product details at line {row_number}")
        if not karat_match or not 1 <= int(karat_match.group(1)) <= 24:
            raise ValueError(f"Dealer CSV has an invalid karat at line {row_number}")
        if side not in {"buying", "selling", "listed", "benchmark"}:
            raise ValueError(f"Dealer CSV has an invalid price side at line {row_number}")
        if not unit_label or len(unit_label) > 80 or currency != "LKR":
            raise ValueError(f"Dealer CSV has invalid price units at line {row_number}")
        if not math.isfinite(price_lkr) or price_lkr <= 0:
            raise ValueError(f"Dealer CSV has an invalid price at line {row_number}")
        if rate_date > latest_allowed_rate_date.isoformat():
            raise ValueError(f"Dealer CSV has a future rate date at line {row_number}")
        if parsed_source.scheme not in {"http", "https"} or not parsed_source.hostname:
            raise ValueError(f"Dealer CSV has an invalid source URL at line {row_number}")
        if dt.datetime.fromisoformat(observed_at) > checked_at + dt.timedelta(minutes=5):
            raise ValueError(f"Dealer CSV has a future observation at line {row_number}")

        quote_row = {
            "institution": institution,
            "institution_type": institution_type,
            "commodity": commodity,
            "karat": int(karat_match.group(1)),
            "side": side,
            "unit": unit,
            "unit_label": unit_label,
            "price_lkr": price_lkr,
            "currency": currency,
            "rate_date": rate_date,
            "observed_at": observed_at,
            "source_url": source_url,
        }
        identity = (
            quote_row["institution"],
            quote_row["karat"],
            quote_row["side"],
            quote_row["unit"],
            quote_row["rate_date"],
            quote_row["source_url"],
        )
        if identity in seen:
            raise ValueError(f"Dealer CSV has a duplicate quote at line {row_number}")
        seen.add(identity)
        rows.append(quote_row)

    if not rows:
        raise ValueError("Dealer CSV contains no price observations")
    return rows


def fetch_feed():
    page_response = requests.get(
        PAGE_API,
        params={"slug": PAGE_SLUG, "_fields": "content,modified"},
        timeout=30,
    )
    page_response.raise_for_status()
    page = page_response.json()
    api_url, token, filename = _extract_feed_config(page)

    response = requests.get(
        api_url + quote(filename, safe=""),
        headers={"X-LankaBIZZ-Token": token},
        timeout=30,
    )
    response.raise_for_status()
    if len(response.content) > MAX_CSV_BYTES:
        raise ValueError("Dealer CSV exceeds the 5 MB limit")
    rows = _parse_csv(response.content)
    modified = page[0].get("modified")
    return rows, response.content, modified


def save_quotes(rows, content, fetched_at=None):
    init_db()
    fetched_at = fetched_at or dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    with get_conn() as connection:
        connection.executemany(
            """
            INSERT INTO dealer_quotes (
                institution, institution_type, commodity, karat, side, unit,
                unit_label, price_lkr, currency, rate_date, observed_at,
                source_url, fetched_at
            ) VALUES (
                :institution, :institution_type, :commodity, :karat, :side, :unit,
                :unit_label, :price_lkr, :currency, :rate_date, :observed_at,
                :source_url, :fetched_at
            )
            ON CONFLICT(institution, karat, side, unit, rate_date, source_url)
            DO UPDATE SET
                institution_type = excluded.institution_type,
                commodity = excluded.commodity,
                unit_label = excluded.unit_label,
                price_lkr = excluded.price_lkr,
                currency = excluded.currency,
                observed_at = excluded.observed_at,
                fetched_at = excluded.fetched_at
            """,
            [{**row, "fetched_at": fetched_at} for row in rows],
        )
    digest = hashlib.sha256(content).hexdigest()
    path, _ = save_raw(content, f"dealer_gold_{digest[:16]}.csv")
    log_raw(path, digest, "Published gold-dealer CSV")


def main():
    rows, content, modified = fetch_feed()
    save_quotes(rows, content)
    latest_rate = max(row["rate_date"] for row in rows)
    print(
        f"Saved {len(rows)} published dealer-price observations; "
        f"latest_rate_date={latest_rate}; tracker_modified={modified or 'unknown'}"
    )


if __name__ == "__main__":
    main()
