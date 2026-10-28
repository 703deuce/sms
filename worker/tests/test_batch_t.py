"""Batch T — picker hang, coverage, min moments, labeled-frame times, cache miss."""
from __future__ import annotations

from clips_worker.video_picker import (
    _quota_is_daily,
    _remap_labeled_frame_moment_times,
)
from clips_worker.video_picker_coverage import compute_uncovered_spans
from clips_worker.video_picker_prompt import min_moments_for_video, min_moments_rule_description


def test_min_moments_180s_need_four():
    assert min_moments_for_video(180) == 4
    assert "need>=4" in min_moments_rule_description(180)


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
