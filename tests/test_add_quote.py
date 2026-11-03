import csv

import pytest

import add_quote


@pytest.mark.parametrize(
    "values, message",
    [
        (("not-a-date", 22, 300000, "shop", ""), "YYYY-MM-DD"),
        (("2099-01-01", 22, 300000, "shop", ""), "future"),
        (("2026-01-01", 23, 300000, "shop", ""), "karat"),
        (("2026-01-01", 22, 0, "shop", ""), "positive finite"),
        (("2026-01-01", 22, float("inf"), "shop", ""), "positive finite"),
        (("2026-01-01", 22, 300000, "  ", ""), "must not be empty"),
        (("2026-01-01", 22, 300000, "shop", "example.com"), "source URL"),
    ],
)
def test_add_quote_rejects_unverified_or_invalid_values(values, message):
    with pytest.raises(ValueError, match=message):
        add_quote.add_quote(*values)


def test_add_quote_saves_sorted_csv_and_database_record(tmp_path, monkeypatch):
    quote_file = tmp_path / "pettah_quotes.csv"
    quote_file.write_text(
        "date,karat,lkr_per_8g,outlet,url\n"
        "2026-01-02,22,300000,Shop B,https://example.com/b\n",
        encoding="utf-8",
    )
    saved_records = []

    class Connection:
        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

        def execute(self, query, record):
            assert query.startswith("INSERT OR REPLACE")
            saved_records.append(record)

    monkeypatch.setattr(add_quote, "QUOTE_FILE", quote_file)
    monkeypatch.setattr(add_quote, "init_db", lambda: None)
    monkeypatch.setattr(add_quote, "get_conn", Connection)

    add_quote.add_quote(
        "2026-01-01", 22, 310000, " Shop A ", "https://example.com/a"
    )

    with quote_file.open(newline="", encoding="utf-8") as file:
        rows = list(csv.DictReader(file))
    assert [row["date"] for row in rows] == ["2026-01-01", "2026-01-02"]
    assert saved_records == [
        ("2026-01-01", 22, 310000, "Shop A", "https://example.com/a")
    ]
