"""Moment coercion for Gemini video picker output."""
from clips_worker.video_picker import _coerce_moment_row, validate_and_normalize_moments


def test_coerce_start_end_alias_keys():
    row = _coerce_moment_row(
        {"start": 10.0, "end": 40.0, "peak": 25.0, "hook": 12.0, "score": 0.8},
        226.0,
    )
    assert row is not None
    out, rejects = validate_and_normalize_moments([row], 226.0)
    assert len(out) == 1
    assert rejects == {}


def test_coerce_mm_ss_timestamps():
    row = _coerce_moment_row(
        {
            "start_s": "1:30",
            "end_s": "2:05",
            "peak_s": "1:50",
            "hook_s": "1:32",
            "score": 0.7,
            "what_happened": "test",
            "why_it_works": "test",
        },
        226.0,
    )
    assert row is not None
    out, _ = validate_and_normalize_moments([row], 226.0)
    assert len(out) == 1
    assert out[0]["start_s"] == 90.0
