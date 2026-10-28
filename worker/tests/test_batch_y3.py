"""Y3: live rolling forward capture, analyze lane split, clip titles, modal circuit."""
from __future__ import annotations

import time
from unittest.mock import patch

from clips_worker.streamer.clip_titles import is_placeholder_stream_clip_title, resolve_stream_clip_title
from clips_worker.streamer.lanes import lane_types
from clips_worker.streamer.live_capture import plan_live_capture_window_ms
from clips_worker.streamer.modal_transcribe import (
    modal_transcribe_circuit_open,
    record_modal_transcribe_timeout,
)


def test_stream_lane_excludes_analyze_default_includes():
    stream = set(lane_types("stream"))
    default = set(lane_types("default"))
    assert "STREAM_IMPORT" in stream
    assert "STREAM_ANALYZE" not in stream
    assert "STREAM_ANALYZE" in default


def test_live_capture_plans_forward_from_last_pulled_without_min_new():
    state = {
        "liveCapture": True,
        "streamStartedAt": "2026-10-28T11:00:00+00:00",
        "rolling": {"chunkMin": 3, "lastPulledMs": 180_000},
    }
    with patch("clips_worker.streamer.live_capture.stream_elapsed_ms", return_value=200_000):
        with patch(
            "clips_worker.streamer.live_capture.emit_rolling_session_check",
            return_value=(0.5, 6, state["rolling"], False),
        ):
            plan = plan_live_capture_window_ms(state=state, finalize=False, vod_id="svod_x")
    assert plan == (180_000, 200_000)


def test_modal_circuit_breaker_opens_for_ten_minutes():
    import clips_worker.streamer.modal_transcribe as mt

    mt._modal_circuit_open_until = 0.0
    assert not modal_transcribe_circuit_open()
    record_modal_transcribe_timeout()
    assert modal_transcribe_circuit_open()
    mt._modal_circuit_open_until = time.time() + 0.05
    assert modal_transcribe_circuit_open()
    time.sleep(0.06)
    assert not modal_transcribe_circuit_open()


def test_placeholder_title_rejected_and_transcript_used():
    assert is_placeholder_stream_clip_title("No clear moment")
    words = [{"w": "clutch", "s": 0.0, "e": 0.4}, {"w": "play", "s": 0.5, "e": 0.9}]
    title = resolve_stream_clip_title(
        title="No clear moment",
        hook="",
        words=words,
        start_ms=0,
        end_ms=1000,
    )
    assert title == "clutch play"
