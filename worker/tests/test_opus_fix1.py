"""CLIPS_OPUS_fix1 unit tests (new; do not weaken existing tests)."""
from __future__ import annotations

from clips_worker.clip_layout_policy import fit_blur_variety_indices
from clips_worker.video_picker import GAMING_AUTO_MAX_SPAN_S, validate_and_normalize_moments
from clips_worker.video_picker_prompt import min_moments_for_video


def _pick(score: float, *, gaming: bool = False, wide: bool = False) -> dict:
    p: dict = {"score": score, "final": score}
    if gaming:
        p["content_type"] = "gaming"
    if wide:
        p["aiMeta"] = {"wideShot": True}
    return p


def test_fit_blur_variety_indices_empty_when_three_or_fewer():
    assert fit_blur_variety_indices([_pick(1), _pick(0.5), _pick(0.4)]) == set()


def test_fit_blur_variety_indices_one_when_five_excludes_top():
    picks = [_pick(0.9), _pick(0.8), _pick(0.7), _pick(0.6), _pick(0.5)]
    idx = fit_blur_variety_indices(picks)
    assert len(idx) == 1
    assert 0 not in idx


def test_fit_blur_variety_indices_two_when_ten():
    picks = [_pick(1 - i * 0.05) for i in range(10)]
    idx = fit_blur_variety_indices(picks)
    assert len(idx) == 2
    assert 0 not in idx


def test_fit_blur_variety_indices_excludes_gaming():
    picks = [_pick(0.9), _pick(0.2, gaming=True), _pick(0.15), _pick(0.1), _pick(0.05)]
    idx = fit_blur_variety_indices(picks)
    assert 1 not in idx


def test_min_moments_for_video_226s():
    assert min_moments_for_video(226) == 6


def test_min_moments_for_video_180s():
    assert min_moments_for_video(180) == 6


def test_min_moments_for_video_30s_short():
    assert min_moments_for_video(30) == 2


def test_gaming_auto_max_span_trim():
    raw = [
        {
            "start_s": 80.7,
            "end_s": 166.0,
            "peak_s": 161.0,
            "hook_s": 145.0,
            "score": 0.9,
            "content_type": "gaming",
        }
    ]
    moments, _ = validate_and_normalize_moments(raw, 226.0, max_span_s=90.0)
    assert len(moments) == 1
    span = moments[0]["end_s"] - moments[0]["start_s"]
    assert span <= GAMING_AUTO_MAX_SPAN_S + 0.01
    assert moments[0]["peak_s"] >= 161.0 - 0.01
