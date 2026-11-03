import math

import pandas as pd
import pytest

from ingest_fx import _validated_rows as validate_fx_rows
from ingest_world import _validated_rows as validate_gold_rows


@pytest.mark.parametrize("validator", [validate_fx_rows, validate_gold_rows])
def test_source_rows_are_sorted_and_duplicate_dates_are_removed(validator):
    rows = validator([
        ("2026-01-02", 2.0, "source"),
        ("2026-01-01", 1.0, "source"),
        ("2026-01-02", 2.1, "duplicate"),
    ], "test source")

    assert rows == [
        ("2026-01-01", 1.0, "test source"),
        ("2026-01-02", 2.0, "test source"),
    ]


@pytest.mark.parametrize("validator", [validate_fx_rows, validate_gold_rows])
@pytest.mark.parametrize("invalid_value", [0, -1, math.inf, -math.inf, math.nan])
def test_source_rows_reject_nonpositive_or_nonfinite_values(validator, invalid_value):
    with pytest.raises(ValueError, match="invalid"):
        validator([("2026-01-01", invalid_value, "source")], "test source")


@pytest.mark.parametrize("validator", [validate_fx_rows, validate_gold_rows])
def test_source_rows_reject_empty_observations(validator):
    with pytest.raises(ValueError, match="no usable"):
        validator([], "test source")


@pytest.mark.parametrize("validator", [validate_fx_rows, validate_gold_rows])
def test_source_rows_reject_invalid_dates(validator):
    with pytest.raises((ValueError, TypeError, pd.errors.OutOfBoundsDatetime)):
        validator([("not-a-date", 1.0, "source")], "test source")
