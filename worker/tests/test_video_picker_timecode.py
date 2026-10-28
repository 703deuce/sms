from clips_worker.video_picker import (
    _watch_proxy_video_filter,
    collect_time_violations,
    normalize_sections,
)


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


def test_normalize_sections_clamps():
    out = normalize_sections([{"start_s": 0, "end_s": 300, "activity": "talk"}], 226.0)
    assert out[0]["end_s"] == 226.0
