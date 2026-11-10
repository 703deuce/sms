"""Per-clip layout decision branches (needs_tracking.choose_clip_layout)."""
from __future__ import annotations

from types import SimpleNamespace

from clips_worker.needs_tracking import (
    apply_layout_decision,
    choose_clip_layout,
    decide_clip_layout,
)


def _face(*, x=0.40, y=0.20, w=0.20, h=0.35, persist=0.8):
    return {"x": x, "y": y, "w": w, "h": h, "persist": persist}


def test_longform_always_full_frame():
    mode, reason, _ = choose_clip_layout(
        source_w=1920, source_h=1080, faces=[_face()], is_screen_share=False, is_longform=True
    )
    assert mode == "full_frame"
    assert reason == "longform_full_frame"


def test_vertical_already_9x16_full_frame():
    mode, reason, _ = choose_clip_layout(
        source_w=1080, source_h=1920, faces=None, is_screen_share=False
    )
    assert mode == "full_frame"
    assert reason == "source_already_vertical_full_frame"


def test_square_vertical_center_crop_no_tracking():
    mode, reason, _ = choose_clip_layout(
        source_w=1080, source_h=1080, faces=[_face(x=0.05, w=0.2)], is_screen_share=False
    )
    assert mode == "center_crop"
    assert reason == "source_already_vertical_center_crop"


def test_screen_share_fit_blur():
    mode, reason, _ = choose_clip_layout(
        source_w=1920, source_h=1080, faces=[_face()], is_screen_share=True
    )
    assert mode == "fit_blur"
    assert reason == "screen_share_or_gameplay"


def test_gameplay_fit_blur():
    mode, reason, _ = choose_clip_layout(
        source_w=1920, source_h=1080, faces=None, is_screen_share=False, is_gameplay=True
    )
    assert mode == "fit_blur"
    assert reason == "screen_share_or_gameplay"


def test_centered_large_face_center_crop():
    # 16:9 source; 9:16 center crop width is ~0.316, so a face at x=0.40 w=0.18 sits inside.
    mode, reason, inputs = choose_clip_layout(
        source_w=1920, source_h=1080, faces=[_face(x=0.40, w=0.18, h=0.36)], is_screen_share=False
    )
    assert mode == "center_crop"
    assert reason == "face_fits_center_crop"
    assert inputs["face_fit"]["kept_whole"] is True


def test_wide_offcenter_face_speaker_follow():
    # Face on the far left would be cut off by a 9:16 center crop.
    mode, reason, inputs = choose_clip_layout(
        source_w=1920, source_h=1080, faces=[_face(x=0.02, w=0.12, h=0.16, persist=0.9)], is_screen_share=False
    )
    assert mode == "speaker_follow"
    assert reason == "wide_face_needs_tracking"
    assert inputs["face_fit"]["kept_whole"] is False or inputs["face_fit"]["tiny"] is True


def test_tiny_centered_face_speaker_follow():
    mode, reason, _ = choose_clip_layout(
        source_w=1920, source_h=1080, faces=[_face(x=0.44, w=0.06, h=0.10)], is_screen_share=False
    )
    assert mode == "speaker_follow"
    assert reason == "wide_face_needs_tracking"


def test_no_face_center_crop():
    mode, reason, _ = choose_clip_layout(
        source_w=1920, source_h=1080, faces=[], is_screen_share=False
    )
    assert mode == "center_crop"
    assert reason == "no_stable_face_center_crop"


def test_apply_only_overwrites_auto_mode():
    edits = {"layout": {"mode": "speaker_follow"}}
    applied = apply_layout_decision(
        edits,
        "unused.mp4",
        source_size_fn=lambda _p: (1920, 1080),
        detect_faces_fn=lambda _p: [],
        probe_screen_share_fn=lambda _p: SimpleNamespace(is_screen_share=False),
    )
    assert applied is None
    assert edits["layout"]["mode"] == "speaker_follow"

    edits = {"layout": {"mode": "auto"}}
    applied = apply_layout_decision(
        edits,
        "unused.mp4",
        source_size_fn=lambda _p: (1920, 1080),
        detect_faces_fn=lambda _p: [],
        probe_screen_share_fn=lambda _p: SimpleNamespace(is_screen_share=False),
    )
    assert applied == "center_crop"
    assert edits["layout"]["mode"] == "center_crop"


def test_apply_longform_full_frame_on_auto():
    edits = {"layout": {"mode": "auto"}}
    applied = apply_layout_decision(
        edits,
        "unused.mp4",
        is_longform=True,
        source_size_fn=lambda _p: (1920, 1080),
    )
    assert applied == "full_frame"
    assert edits["layout"]["mode"] == "full_frame"


def test_decide_uses_probes(monkeypatch):
    mode, reason, _ = decide_clip_layout(
        "unused.mp4",
        archetype="gaming_stream",
        source_size_fn=lambda _p: (1920, 1080),
        probe_screen_share_fn=lambda _p: SimpleNamespace(is_screen_share=False),
        detect_faces_fn=lambda _p: [_face()],
    )
    assert mode == "fit_blur"
    assert reason == "screen_share_or_gameplay"
