"""Regression coverage for absolute Twitch archive ranges on downloaded segments."""

import pytest

from clips_worker.streamer.analyze_job import resolve_analyze_window_ms


@pytest.mark.parametrize(
    "start_ms,end_ms",
    [
        (60 * 60_000, 70 * 60_000),
        (90 * 60_000, 100 * 60_000),
        (0, 10 * 60_000),
    ],
)
def test_downloaded_archive_segment_keeps_stream_timebase(start_ms, end_ms):
    vod = {"rangeStartMs": start_ms, "rangeEndMs": end_ms, "durationMs": 600_000}
    assert resolve_analyze_window_ms(vod, {}) == (start_ms, end_ms)


def test_full_media_range_clamps_at_file_end():
    vod = {"rangeStartMs": 60_000, "rangeEndMs": 660_000, "durationMs": 300_000}
    assert resolve_analyze_window_ms(vod, {}) == (60_000, 300_000)


def test_fully_outside_full_media_is_rejected():
    vod = {"rangeStartMs": 600_000, "rangeEndMs": 950_000, "durationMs": 300_000}
    with pytest.raises(RuntimeError, match="range_outside_media"):
        resolve_analyze_window_ms(vod, {})


def test_backward_range_is_rejected_even_for_segment():
    vod = {"rangeStartMs": 660_000, "rangeEndMs": 600_000, "durationMs": 60_000}
    with pytest.raises(RuntimeError, match="range_outside_media"):
        resolve_analyze_window_ms(vod, {})


def test_explicit_rolling_window_keeps_absolute_timestamps():
    vod = {"rangeStartMs": 0, "rangeEndMs": 1_200_000, "durationMs": 600_000}
    payload = {"rangeStartMs": 600_000, "rangeEndMs": 1_200_000, "windowOnly": True}
    assert resolve_analyze_window_ms(vod, payload) == (600_000, 1_200_000)
