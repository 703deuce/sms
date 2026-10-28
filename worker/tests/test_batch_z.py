"""Batch Z: lastPulledMs, render dedupe, clip timeline, metadata offset."""
from __future__ import annotations

from datetime import datetime, timezone

from unittest.mock import patch

from clips_worker.streamer.clip_timeline import clip_absolute_span_ms
from clips_worker.streamer.live_capture import plan_live_capture_window_ms
from clips_worker.streamer.metadata import enrich_streamer_meta
from clips_worker.streamer.rolling_state import merge_rolling_last_pulled_ms


def test_merge_last_pulled_never_lowers():
    assert merge_rolling_last_pulled_ms(committed_ms=23_959_602, window_end_ms=23_779_602) == 23_959_602
    assert merge_rolling_last_pulled_ms(committed_ms=0, window_end_ms=100) == 100


def test_three_contiguous_live_windows():
    started = datetime(2026, 1, 1, tzinfo=timezone.utc)
    state = {
        "liveCapture": True,
        "streamStartedAt": started.isoformat(),
        "rolling": {"lastPulledMs": 0, "chunkMin": 1},
    }
    plans: list[tuple[int, int]] = []
    last = 0
    elapsed_seq = [180_000, 240_000, 300_000, 360_000]
    with patch(
        "clips_worker.streamer.live_capture.stream_elapsed_ms",
        side_effect=lambda *a, **k: elapsed_seq.pop(0) if elapsed_seq else 360_000,
    ):
        for tick in range(3):
            plan = plan_live_capture_window_ms(state=state, finalize=False, vod_id="svod_test")
            assert plan not in (None, "stop_session")
            start_ms, end_ms = plan  # type: ignore[misc]
            assert start_ms == last, f"tick {tick} start {start_ms} expected {last}"
            assert end_ms > start_ms
            plans.append((start_ms, end_ms))
            state = {
                **state,
                "rolling": {**state["rolling"], "lastPulledMs": end_ms},
            }
            last = end_ms
    assert plans[1][0] == plans[0][1]
    assert plans[2][0] == plans[1][1]


def test_clip_absolute_span_avoids_double_vod_base():
    clip = {
        "startMs": 23_862_792,
        "endMs": 23_892_792,
        "aiMeta": {"streamer": {"vodRangeStartMs": 23_779_602}},
    }
    abs_start, abs_end, base = clip_absolute_span_ms(clip, 23_779_602)
    assert abs_start == 23_862_792
    assert abs_end == 23_892_792
    assert base == 23_779_602


def test_enrich_streamer_meta_no_double_offset():
    vod = {"rangeStartMs": 23_779_602, "url": "https://twitch.tv/videos/1"}
    meta = enrich_streamer_meta(
        {},
        vod=vod,
        peak_ms=23_870_000,
        clip_start_ms=23_862_792,
        clip_end_ms=23_892_792,
    )
    sm = meta["streamer"]["meta"]
    assert sm["vodOffsetMs"] == 23_862_792
