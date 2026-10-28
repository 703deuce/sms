"""Batch W — rolling session cap, gemini fusion, archetype."""
from datetime import datetime, timezone, timedelta

from clips_worker.streamer.fusion import _inject_video_picker_candidates
from clips_worker.streamer.rolling_ingest import plan_rolling_window_ms


def test_long_archive_offset_does_not_trigger_max_session():
    recent = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()
    state = {"rolling": {"lastPulledMs": 180_000, "lastPullCompletedAt": recent}}
    plan = plan_rolling_window_ms(
        total_vod_ms=37_700_000,
        state=state,
        finalize=False,
        vod_id="svod_test",
    )
    assert plan != "stop_session"
    assert isinstance(plan, tuple)


def test_gemini_replaces_overlap_candidate():
    base = [
        {
            "id": "cand_0",
            "start_ms": 92_000,
            "end_ms": 122_000,
            "peak_ms": 100_000,
            "signal_peak": 0.4,
        }
    ]
    moments = [{"start_s": 100.0, "end_s": 147.0, "peak_s": 120.0, "score": 0.85}]
    out = _inject_video_picker_candidates(
        base,
        moments,
        duration_s=180,
        min_clip_s=15,
        max_clip_s=90,
    )
    assert len(out) == 1
    assert out[0].get("gemini_sourced") is True
    assert out[0]["start_ms"] == 100_000
