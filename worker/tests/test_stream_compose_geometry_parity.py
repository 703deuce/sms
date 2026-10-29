"""TS ↔ worker overlay layout parity for stream headline compose."""
from __future__ import annotations

from clips_worker.streamer.layout.stream_overlay_layout import overlay_layout


def test_overlay_layout_golden_two_lines():
    lay = overlay_layout(2, play_w=1080, play_h=1920)
    assert lay["headline_top"] == 150
    assert lay["headline_h"] == 320
    assert lay["video_y"] == 470
    assert lay["video_h"] == 608
    assert lay["bottom_y"] == lay["video_y"] + lay["video_h"]


def test_badge_top_gap_anchor():
    from clips_worker.overlay_geometry import badge_rect

    rect = badge_rect("fit_top_band", 1080, 1920, text="TWITCH", show_logo=True, anchor_top_gap=True)
    assert rect["y"] >= 20
    assert rect["y"] < 150
    assert abs(rect["x"] + rect["w"] / 2 - 540) < 2
