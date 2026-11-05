"""Reviewed USD/LKR cross-checks for known Yahoo Finance bad prints."""


# CBSL indicative spot values (LKR per USD), checked against the published
# series on 2026-11-05. Yahoo LKR=X was about Rs 10 low on 2–3 November.
CBSL_CROSSCHECK_RATES = {
    "2026-11-02": 332.60,
    "2026-11-03": 332.60,
    "2026-11-04": 332.64,
}


def reviewed_rate(date, value):
    return CBSL_CROSSCHECK_RATES.get(str(date)[:10], value)


def apply_reviewed_rates(rows):
    """Return date/rate rows with the reviewed CBSL values applied."""
    return [
        (row[0], reviewed_rate(row[0], row[1]), *row[2:])
        for row in rows
    ]
