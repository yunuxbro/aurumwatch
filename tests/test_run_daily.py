import json
import subprocess

import run_daily


def test_optional_dealer_feed_failure_does_not_block_daily_exports(monkeypatch, tmp_path):
    monkeypatch.setattr(
        run_daily,
        "STEPS",
        [
            ("dealer_prices", "src/ingest_lankabizz.py"),
            ("export", "src/export_json.py"),
        ],
    )
    monkeypatch.setattr(run_daily, "OPTIONAL_STEPS", {"dealer_prices"})
    monkeypatch.setattr(run_daily, "PROJECT_ROOT", tmp_path)
    monkeypatch.setattr(run_daily, "STATUS_FILE", tmp_path / "refresh.json")
    monkeypatch.setattr(run_daily, "LOG_FILE", tmp_path / "daily.log")
    monkeypatch.setattr(run_daily, "init_db", lambda: None)
    monkeypatch.setattr(run_daily, "_latest_data", lambda: {})
    calls = []

    def fake_run(*args, **kwargs):
        calls.append(args[0][-1])
        if len(calls) == 1:
            return subprocess.CompletedProcess(args[0], 1, "", "feed unavailable")
        return subprocess.CompletedProcess(args[0], 0, "exported", "")

    monkeypatch.setattr(run_daily.subprocess, "run", fake_run)

    assert run_daily.refresh() is True
    status = json.loads((tmp_path / "refresh.json").read_text(encoding="utf-8"))
    assert calls == [
        str(tmp_path / "src/ingest_lankabizz.py"),
        str(tmp_path / "src/export_json.py"),
    ]
    assert status["status"] == "success"
    assert status["warnings"] == ["dealer_prices: feed unavailable"]
    assert [step["status"] for step in status["steps"]] == ["failed", "success"]


def test_market_model_failure_marks_forecast_unavailable_and_stops_export(monkeypatch, tmp_path):
    monkeypatch.setattr(run_daily, "STEPS", [
        ("market_model", "src/train_market_model.py"),
        ("export", "src/export_json.py"),
    ])
    monkeypatch.setattr(run_daily, "PROJECT_ROOT", tmp_path)
    monkeypatch.setattr(run_daily, "STATUS_FILE", tmp_path / "refresh.json")
    monkeypatch.setattr(run_daily, "LOG_FILE", tmp_path / "daily.log")
    monkeypatch.setattr(run_daily, "init_db", lambda: None)
    monkeypatch.setattr(run_daily, "_latest_data", lambda: {})
    calls = []

    def fake_run(*args, **kwargs):
        calls.append(args[0][-1])
        return subprocess.CompletedProcess(args[0], 1, "", "insufficient market history")

    monkeypatch.setattr(run_daily.subprocess, "run", fake_run)

    assert run_daily.refresh() is False
    status = json.loads((tmp_path / "refresh.json").read_text(encoding="utf-8"))
    forecast = json.loads(
        (tmp_path / "web" / "public" / "data" / "ml_forecast.json").read_text(encoding="utf-8")
    )
    assert status["status"] == "failed"
    assert status["error"] == "market_model: insufficient market history"
    assert forecast == {
        "status": "unavailable",
        "error": "insufficient market history",
    }
    assert calls == [str(tmp_path / "src/train_market_model.py")]
