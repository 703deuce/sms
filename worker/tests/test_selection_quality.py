"""Picker selection: no forced minimum clip count on short sources."""
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


def test_short_source_does_not_force_three_clips():
    """Sub-5min sources must not inflate cap to 3 when only one moment scores well."""
    weak = [_pick(5.0, 0, 30_000, "weak")]
    selected = select_clips(weak, source_duration_ms=3 * 60_000)
    assert len(selected) <= 1


def test_empty_when_nothing_meets_min_final():
    ranked = [_pick(4.0, 0, 30_000, "low"), _pick(4.5, 40_000, 70_000, "low2")]
    selected = select_clips(ranked, source_duration_ms=10 * 60_000)
    assert selected == []
