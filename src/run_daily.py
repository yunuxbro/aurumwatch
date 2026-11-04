import datetime as dt
import json
import pathlib
import subprocess
import sys
import time

from db import get_conn, init_db
from freshness import source_freshness

PROJECT_ROOT = pathlib.Path(__file__).resolve().parent.parent
STATUS_FILE = PROJECT_ROOT / "web" / "public" / "data" / "refresh.json"
LOG_FILE = PROJECT_ROOT / "data" / "logs" / "daily-refresh.log"
STEPS = [
    ("load_pettah", "src/load_pettah.py"),
    ("world_gold", "src/ingest_world.py"),
    ("usd_lkr", "src/ingest_fx.py"),
    ("dealer_prices", "src/ingest_lankabizz.py"),
    ("backtest", "src/backtest.py"),
    ("market_model", "src/train_market_model.py"),
    ("export", "src/export_json.py"),
]
OPTIONAL_STEPS = {"dealer_prices"}


def _utc_now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def _log(message, error=False):
    line = f"{_utc_now()} {message.rstrip()}\n"
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with LOG_FILE.open("a", encoding="utf-8") as log_file:
        log_file.write(line)
    stream = sys.stderr if error else sys.stdout
    stream.write(line)
    stream.flush()


def _latest_data():
    with get_conn() as connection:
        result = {}
        for table in ("world_gold", "usdlkr", "pettah"):
            date, count = connection.execute(
                f"SELECT MAX(date), COUNT(*) FROM {table}"
            ).fetchone()
            age_days = None
            if date:
                age_days = (dt.datetime.now().astimezone().date() - dt.date.fromisoformat(date)).days
            result[table] = {
                "latest_date": date,
                "age_days": age_days,
                "rows": count,
            }
            source_type = {"world_gold": "gold", "usdlkr": "fx", "pettah": "pettah"}[table]
            result[table]["freshness"] = source_freshness(
                source_type, date, dt.datetime.now().astimezone().date()
            )
            if table in {"world_gold", "usdlkr"} and date:
                source = connection.execute(
                    f"SELECT source FROM {table} WHERE date = ?", (date,)
                ).fetchone()
                result[table]["source"] = source[0] if source else None
        latest_fetch, latest_date, latest_observation, latest_rows = connection.execute(
            """
            SELECT fetched_at, MAX(rate_date), MAX(observed_at), COUNT(*)
            FROM dealer_quotes
            WHERE fetched_at = (SELECT MAX(fetched_at) FROM dealer_quotes)
            """
        ).fetchone()
        age_days = None
        if latest_date:
            age_days = (
                dt.datetime.now().astimezone().date() - dt.date.fromisoformat(latest_date)
            ).days
        result["dealer_quotes"] = {
            "latest_date": latest_date,
            "age_days": age_days,
            "observed_at": latest_observation,
            "fetched_at": latest_fetch,
            "rows": latest_rows or 0,
            "freshness": source_freshness(
                "dealer", latest_date, dt.datetime.now().astimezone().date()
            ),
        }
    return result


def _write_status(status):
    STATUS_FILE.parent.mkdir(parents=True, exist_ok=True)
    temporary = STATUS_FILE.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(status, indent=2), encoding="utf-8")
    temporary.replace(STATUS_FILE)


def refresh():
    init_db()
    started_at = _utc_now()
    started_clock = time.monotonic()
    steps = []
    previous_status = {}
    if STATUS_FILE.exists():
        previous_status = json.loads(STATUS_FILE.read_text(encoding="utf-8"))

    failure = None
    warnings = []
    for name, script in STEPS:
        step_start = _utc_now()
        _log(f"==> {name}")
        result = subprocess.run(
            [sys.executable, str(PROJECT_ROOT / script)],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        if result.stdout:
            for line in result.stdout.splitlines():
                _log(line)
        if result.stderr:
            for line in result.stderr.splitlines():
                _log(line, error=True)

        step_error = None
        if result.returncode != 0:
            step_error = next(
                (line.strip() for line in reversed(result.stderr.splitlines()) if line.strip()),
                f"exited with code {result.returncode}",
            )
        steps.append({
            "name": name,
            "status": "success" if result.returncode == 0 else "failed",
            "started_at": step_start,
            "return_code": result.returncode,
            "error": step_error,
        })
        if result.returncode != 0:
            if name in OPTIONAL_STEPS:
                warnings.append(f"{name}: {step_error}")
            else:
                failure = f"{name}: {step_error}"
                if name == "market_model":
                    model_file = PROJECT_ROOT / "web" / "public" / "data" / "ml_forecast.json"
                    model_file.parent.mkdir(parents=True, exist_ok=True)
                    temporary = model_file.with_suffix(".json.tmp")
                    temporary.write_text(
                        json.dumps({"status": "unavailable", "error": step_error}, indent=2),
                        encoding="utf-8",
                    )
                    temporary.replace(model_file)
                break

    succeeded = failure is None
    status = {
        "status": "success" if succeeded else "failed",
        "started_at": started_at,
        "finished_at": _utc_now(),
        "duration_seconds": round(time.monotonic() - started_clock, 1),
        "last_success_at": _utc_now() if succeeded else previous_status.get("last_success_at"),
        "error": failure,
        "warnings": warnings,
        "steps": steps,
        "data": _latest_data(),
        "source_notes": {
            "world_gold": "Stooq XAU/USD; if unavailable, futures proxy (GC=F), not spot.",
            "usdlkr": "CBSL CSV when data/raw/cbsl_usdlkr.csv is present; Yahoo Finance LKR=X fallback.",
            "pettah": "Public-source shop quotes require verification and are loaded from data/pettah_quotes.csv.",
            "dealer_quotes": "Published dealer feed; each row retains its own rate date and crawl time and is not identified as Pettah-specific.",
        },
    }
    _write_status(status)
    if succeeded:
        _log(f"Daily refresh completed in {status['duration_seconds']} seconds.")
    else:
        _log(f"Daily refresh failed: {failure}", error=True)
    return succeeded


if __name__ == "__main__":
    raise SystemExit(0 if refresh() else 1)
