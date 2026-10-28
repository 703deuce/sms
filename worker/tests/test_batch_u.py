"""Batch U — live streamer import, dedupe, fusion, cancel."""
from clips_worker.streamer.fusion import _inject_video_picker_candidates
from clips_worker.streamer.import_job import _has_pending_stream_import
from clips_worker.streamer.project_cancel import project_error_indicates_operator_cancel


def test_operator_cancel_detect():
    assert project_error_indicates_operator_cancel("Cancelled by operator (manual)")
    assert not project_error_indicates_operator_cancel(None)


def test_rolling_tick_excludes_running_import():
    import inspect
    src = inspect.getsource(_has_pending_stream_import)
    assert "exclude_job_id" in src


def test_video_picker_inject_adds_candidates():
    base = [
        {
            "id": "cand_0",
            "start_ms": 35_000,
            "end_ms": 65_000,
            "peak_ms": 50_000,
            "signal_peak": 0.5,
        }
    ]
    moments = [
        {"start_s": 80.0, "end_s": 110.0, "peak_s": 95.0, "score": 0.8},
        {"start_s": 140.0, "end_s": 170.0, "peak_s": 155.0, "score": 0.75},
    ]
    out = _inject_video_picker_candidates(
        base,
        moments,
        duration_s=180,
        min_clip_s=15,
        max_clip_s=90,
    )
    assert len(out) >= 3
