"""Picker selection: ship all distinct moments; overlap-only dedupe."""
from clips_worker.picker.selection import select_clips


def _pick(final: float, start: int, end: int, title: str = "a") -> dict:
    return {
        "start_ms": start,
        "end_ms": end,
        "final": final,
        "title": title,
        "reason": title,
        "archetype": "story",
    }


def test_ships_weak_scores_ranked():
    ranked = [_pick(4.0, 0, 30_000, "low"), _pick(4.5, 40_000, 70_000, "low2")]
    selected = select_clips(ranked, source_duration_ms=10 * 60_000)
    assert len(selected) == 2
    assert selected[0]["title"] == "low2"


def test_overlap_duplicate_drops_lower_score():
    a = _pick(7.0, 140_000, 167_000, "apex_a")
    b = _pick(6.0, 144_000, 167_000, "apex_b")
    selected = select_clips([a, b], source_duration_ms=4 * 60_000)
    assert len(selected) == 1
    assert selected[0]["title"] == "apex_a"
