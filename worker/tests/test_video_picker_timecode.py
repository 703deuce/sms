from clips_worker.video_picker import (
    _watch_proxy_video_filter,
    collect_time_violations,
    format_timestamped_transcript,
    normalize_sections,
)
from clips_worker.picker.sentences import Sentence


def test_burn_timecode_filter_enabled(monkeypatch):
    monkeypatch.delenv("VIDEO_PICKER_BURN_TIMECODE", raising=False)
    vf = _watch_proxy_video_filter()
    assert "drawtext" in vf
    assert "pts" in vf


def test_collect_time_violations_past_duration():
    secs = [{"start_s": 0, "end_s": 250, "activity": "gaming"}]
    moms = [{"start_s": 215, "end_s": 226, "peak_s": 220, "hook_s": 215}]
    v = collect_time_violations(secs, moms, 226.0)
    assert any("250" in x for x in v)


def test_format_timestamped_transcript_mmss():
    lines = format_timestamped_transcript(
        [Sentence(0, 81220, 82890, "A", "Move fast", 0, 1)],
        0,
        226_000,
    )
    assert "1:21.2" in lines
    assert "81.22s" in lines


def test_normalize_sections_clamps():
    out = normalize_sections([{"start_s": 0, "end_s": 300, "activity": "talk"}], 226.0)
    assert out[0]["end_s"] == 226.0
