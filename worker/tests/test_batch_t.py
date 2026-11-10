"""Batch T — picker hang, coverage, min moments, labeled-frame times, cache miss."""
from __future__ import annotations

from clips_worker.video_picker import (
    _quota_is_daily,
    _remap_labeled_frame_moment_times,
)
from clips_worker.video_picker_coverage import compute_uncovered_spans
from clips_worker.video_picker_prompt import min_moments_for_video, min_moments_rule_description


def test_min_moments_180s_need_six():
    # CLIPS_OPUS_fix1 2a: short uploads floor max(6, 1.5/min), not ~1/53s min 2.
    assert min_moments_for_video(180) == 6
    assert "need>=6" in min_moments_rule_description(180)


def test_min_moments_long_stream_floor_six():
    assert min_moments_for_video(25 * 60) >= 6


def test_uncovered_not_whole_section_when_moment_at_end():
    sections = [
        {"start_s": 0, "end_s": 121, "activity": "talking"},
        {"start_s": 121, "end_s": 180, "activity": "reaction"},
    ]
    moments = [{"start_s": 111, "end_s": 121, "peak_s": 116, "score": 0.8}]
    spans = compute_uncovered_spans(sections, moments, 180.0, pad_s=30.0)
    labels = " ".join(s["label"] for s in spans)
    assert "0-" in labels or "86" in labels or "30" in labels
    assert any(s["start_s"] < 90 for s in spans)
    assert any(s["start_s"] >= 121 for s in spans)


def test_daily_quota_detect():
    assert _quota_is_daily({"quotaId": "GenerateRequestsPerDayPerProjectPerModel-FreeTier"})
    assert not _quota_is_daily({"quotaId": "GenerateRequestsPerMinutePerProjectPerModel-FreeTier"})


def test_frame_label_series_respects_duration():
    dur = 226.0
    n = 113
    times = [round(i * dur / (n - 1), 3) for i in range(n)]
    assert max(times) <= dur + 0.05


def test_remap_labeled_frame_times_scales_down():
    raw = [{"start_s": 272, "end_s": 290, "peak_s": 280, "hook_s": 275, "score": 0.7}]
    out = _remap_labeled_frame_moment_times(
        raw,
        duration_s=226.0,
        fps=0.5,
        trim_start_s=0.0,
        frame_times=None,
    )
    assert float(out[0]["start_s"]) <= 226.0


def test_remap_does_not_subtract_offset_outside_window():
    """Live bug: absolute times from earlier in the source (e.g. ~501s)
    on a 180s end-edge window starting at 871s became end_s=-369.8."""
    raw = [{"start_s": 0.0, "end_s": 501.2, "peak_s": 480.0, "hook_s": 470.0, "score": 0.4}]
    out = _remap_labeled_frame_moment_times(
        raw,
        duration_s=180.0,
        fps=0.25,
        trim_start_s=871.0,
        frame_times=None,
    )
    assert float(out[0]["end_s"]) == 501.2
    assert float(out[0]["end_s"]) > 0


def test_remap_subtracts_offset_only_when_inside_window():
    raw = [{"start_s": 880.0, "end_s": 1020.0, "peak_s": 950.0, "hook_s": 890.0, "score": 0.5}]
    out = _remap_labeled_frame_moment_times(
        raw,
        duration_s=180.0,
        fps=0.25,
        trim_start_s=871.0,
        frame_times=None,
    )
    assert abs(float(out[0]["start_s"]) - 9.0) < 0.01
    assert abs(float(out[0]["end_s"]) - 149.0) < 0.01
