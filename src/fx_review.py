"""Reviewed USD/LKR cross-check rates and an experimental Yahoo filter."""

import numpy as np
import pandas as pd


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


def yahoo_reversal_flags(rates):
    rates = rates.astype(float).sort_index().copy()
    returns = np.log(rates).diff()
    excluded = (rates.index >= "2022-03-07") & (rates.index <= "2022-04-30")
    flagged = (returns.abs() > 0.01) & (
        (returns + returns.shift(-1)).abs() < 0.3 * returns.abs()
    )
    flagged = flagged.fillna(False) & ~excluded
    return flagged


def filter_reversing_yahoo_prints(rates):
    """Flag Yahoo reversals, then interpolate at most two missing levels.

    The March-April 2022 float transition is excluded. Returns the cleaned
    Series and count of flagged source observations.
    """
    rates = rates.astype(float).sort_index().copy()
    flagged = yahoo_reversal_flags(rates)
    cleaned = rates.copy()
    cleaned.loc[flagged] = np.nan
    return cleaned.interpolate(limit=2), int(flagged.sum())
