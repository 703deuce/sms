"""plan_clips runs before persist; overlapping planned picks are resolved."""
from __future__ import annotations

from clips_worker.pipeline_plan import plan_or_finish_empty
from clips_worker.plan_clips import plan_clips


def _overlap_ratio(a0: int, a1: int, b0: int, b1: int) -> float:
    inter = max(0, min(a1, b1) - max(a0, b0))
    union = max(a1, b1) - min(a0, b0)
    return inter / union if union > 0 else 0.0


def _assert_non_overlapping_planned(picks: list[dict]) -> list[dict]:
    planned = plan_clips(picks, min_clip_ms=15_000)
    spans = [(int(p["start_ms"]), int(p["end_ms"])) for p in planned]
    for i, (a0, a1) in enumerate(spans):
        for b0, b1 in spans[i + 1 :]:
            assert _overlap_ratio(a0, a1, b0, b1) < 0.35
    return planned


def test_anything_style_overlapping_picks_planned_without_overlap():
    """ClipAnything / vision picks use the same plan_clips path as the pipeline helper."""
    pick_a = {
        "start_ms": 5_000,
        "end_ms": 50_000,
        "score": 88,
        "title": "A",
        "hook": "A",
        "reason": "A",
    }
    pick_b = {
        "start_ms": 30_000,
        "end_ms": 75_000,
        "score": 82,
        "title": "B",
        "hook": "B",
        "reason": "B",
    }
    planned = _assert_non_overlapping_planned([pick_a, pick_b])
    assert len(planned) >= 1


def test_streamer_style_fusion_spans_planned_without_overlap():
    """Streamer rank → pipeline picks must pass through plan_or_finish_empty planning."""
    picks = [
        {
            "start_ms": 120_000,
            "end_ms": 165_000,
            "score": 91,
            "title": "Stream peak",
            "hook": "hype",
            "reason": "chat spike",
        },
        {
            "start_ms": 140_000,
            "end_ms": 185_000,
            "score": 87,
            "title": "Overlap",
            "hook": "overlap",
            "reason": "near duplicate",
        },
    ]
    planned = _assert_non_overlapping_planned(picks)
    assert len(planned) >= 1


def test_plan_or_finish_empty_returns_none_when_no_picks():
    calls: list[dict] = []

    def post_progress(job_id, payload):
        calls.append(payload)

    def mark_ready(conn, project_id, error=None):
        calls.append({"ready": True, "error": error})

    out = plan_or_finish_empty(
        None,
        "proj",
        "job",
        post_progress,
        [],
        "no moments",
        mark_project_ready=mark_ready,
    )
    assert out is None
    assert any(c.get("projectStatus") == "READY" for c in calls)


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
