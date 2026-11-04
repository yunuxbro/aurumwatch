"""Small freshness rules shared by the pipeline and its tests."""

import datetime as dt


MAX_WORKING_DAYS = {
    "pettah": 3,
    "dealer": 3,
    "gold": 5,
    "fx": 5,
}


def working_days_since(date_value, today=None):
    """Count weekdays after an observation date up to today, excluding weekends."""
    try:
        observed = dt.date.fromisoformat(str(date_value)[:10])
        current = today or dt.date.today()
        if isinstance(current, str):
            current = dt.date.fromisoformat(current)
    except (TypeError, ValueError):
        return None

    if observed > current:
        return None

    age = 0
    day = observed
    while day < current:
        day += dt.timedelta(days=1)
        if day.weekday() < 5:
            age += 1
    return age


def source_freshness(source_type, date_value, today=None):
    """Return current, stale, or unavailable using source-specific weekdays."""
    source_type = str(source_type).lower()
    if source_type not in MAX_WORKING_DAYS:
        raise ValueError(f"Unknown source type: {source_type}")
    age = working_days_since(date_value, today)
    if age is None:
        return {"status": "unavailable", "working_days_old": None}
    limit = MAX_WORKING_DAYS[source_type]
    return {
        "status": "stale" if age > limit else "current",
        "working_days_old": age,
        "max_working_days": limit,
    }
