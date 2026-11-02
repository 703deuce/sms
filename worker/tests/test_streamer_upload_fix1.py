"""STREAMER_upload_fix1 tests (new file only)."""
from __future__ import annotations

from clips_worker.streamer.analyze_job import resolve_analyze_window_ms
from clips_worker.streamer.render_job import guard_stream_clip_against_media


def test_analyze_window_clamps_range_end_to_duration():
    vod = {"durationMs": 226_000, "rangeStartMs": 0, "rangeEndMs": 900_000}
    start, end = resolve_analyze_window_ms(vod, {})
    assert start == 0
    assert end == 226_000


def test_analyze_window_payload_range_end_clamped():
    vod = {"durationMs": 226_000, "rangeStartMs": 0, "rangeEndMs": 900_000}
    start, end = resolve_analyze_window_ms(vod, {"rangeEndMs": 900_000})
    assert end == 226_000


def test_render_guard_skips_clip_past_media():
    clip = {"id": "clip_x", "startMs": 291_000, "endMs": 346_000}
    assert (
        guard_stream_clip_against_media(clip, media_duration_ms=226_000, vod_range_start_ms=0) is None
    )


def test_render_guard_clamps_end_and_keeps_valid_clip():
    clip = {"id": "clip_y", "startMs": 200_000, "endMs": 240_000}
    span = guard_stream_clip_against_media(clip, media_duration_ms=226_000, vod_range_start_ms=0)
    assert span == (200_000, 226_000)


def test_render_guard_drops_too_short_after_clamp():
    clip = {"id": "clip_z", "startMs": 222_000, "endMs": 240_000}
    assert (
        guard_stream_clip_against_media(clip, media_duration_ms=226_000, vod_range_start_ms=0) is None
    )
