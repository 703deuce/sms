"""STREAM_RENDER segment timebase (archive window vs capture)."""
from __future__ import annotations

from clips_worker.streamer.segment_fetch import plan_segment_download_times, resolve_clip_window_media


def test_full_vod_url_adds_window_base():
    base, start, end = plan_segment_download_times(
        kind="full_vod_url",
        window_base_ms=1_111_000,
        rel_start_s=190.715,
        rel_end_s=279.125,
    )
    assert base == 1111.0
    assert abs(start - 1301.715) < 0.001
    assert abs(end - 1390.125) < 0.001


def test_window_capture_stays_relative():
    base, start, end = plan_segment_download_times(
        kind="window_capture",
        window_base_ms=1_111_000,
        rel_start_s=190.715,
        rel_end_s=279.125,
    )
    assert base == 0.0
    assert start == 190.715
    assert end == 279.125


def test_upload_range_zero_unchanged():
    base, start, end = plan_segment_download_times(
        kind="upload",
        window_base_ms=0,
        rel_start_s=12.5,
        rel_end_s=45.0,
    )
    assert base == 0.0
    assert start == 12.5
    assert end == 45.0


def test_resolve_archive_window_is_full_vod_url():
    clip = {"aiMeta": {"streamer": {"vodRangeStartMs": 1_111_000, "clipTimesAbsolute": True}}}
    state = {"analysisProxyKey": None}
    path, kind = resolve_clip_window_media(clip, state, layout_video=None, local_upload=None)
    assert path is None
    assert kind == "full_vod_url"


def test_resolve_with_capture_key_is_window_capture():
    clip = {"aiMeta": {"streamer": {"captureVideoKey": "ws/x/window.mp4"}}}
    path, kind = resolve_clip_window_media(clip, {}, layout_video=None, local_upload=None)
    assert kind == "window_capture"
