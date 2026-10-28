"""plan_clips runs before persist; overlapping planned picks are resolved."""
from __future__ import annotations

from clips_worker.plan_clips import plan_clips


def _overlap_ratio(a0: int, a1: int, b0: int, b1: int) -> float:
    inter = max(0, min(a1, b1) - max(a0, b0))
    union = max(a1, b1) - min(a0, b0)
    return inter / union if union > 0 else 0.0


def test_headstart_span_and_planned_second_pick_ship_without_overlap():
    """Headstart 0–45.5s + planned 22.3–66.6s must not both ship overlapping."""
    pick_a = {
        "start_ms": 0,
        "end_ms": 45_500,
        "score": 90,
        "title": "A",
        "hook": "A",
        "reason": "A",
    }
    pick_b = {
        "start_ms": 22_300,
        "end_ms": 66_600,
        "score": 85,
        "title": "B",
        "hook": "B",
        "reason": "B",
    }
    planned = plan_clips([pick_a, pick_b], min_clip_ms=15_000)
    assert len(planned) >= 1
    spans = [(int(p["start_ms"]), int(p["end_ms"])) for p in planned]
    for i, (a0, a1) in enumerate(spans):
        for b0, b1 in spans[i + 1 :]:
            assert _overlap_ratio(a0, a1, b0, b1) < 0.35
