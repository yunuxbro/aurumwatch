import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from analysis.attribution import build_attribution


def test_dealer_attribution_components_sum_exactly_to_log_move():
    dealer_rows = [
        ("Shop A", 22, "listed", "pawn_8g", 320000, "LKR", "2026-10-30", "https://example.com/a"),
        ("Shop A", 22, "listed", "pawn_8g", 326000, "LKR", "2026-11-02", "https://example.com/a"),
    ]
    gold_rows = [("2026-10-30", 4000), ("2026-11-02", 4100)]
    fx_rows = [("2026-10-30", 320), ("2026-11-02", 322)]

    result = build_attribution(dealer_rows, gold_rows, fx_rows)
    move = result["moves"][0]

    assert (
        move["world_log_return"]
        + move["rupee_log_return"]
        + move["dealer_premium_log_return"]
    ) == move["dealer_log_return"]
