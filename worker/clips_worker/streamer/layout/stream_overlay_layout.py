"""Shared 1080x1920 stream overlay geometry (fit_top + caption/chat safe zones)."""
from __future__ import annotations

from clips_worker.overlay_geometry import GEOM

_ft = GEOM["fitTop"]
PLAY_W = 1080
PLAY_H = 1920
TOP_BLUR_Y = 0
HEADLINE_TOP = int(_ft["headlineTop"])
HEADLINE_MIN_LINES = int(_ft["minLines"])
HEADLINE_MAX_LINES = int(_ft["maxLines"])
_per_line_px = int(_ft["perLinePx"])
_pad_px = int(_ft["padPx"])
_min_box_px = int(_ft["minBoxPx"])
_video_bottom_reserve_px = int(_ft["videoBottomReservePx"])
_badge_offset_px = int(_ft["badgeOffsetPx"])


def headline_box_height(line_count: int, *, play_h: int = PLAY_H) -> int:
    """White headline band height (~470px at 3 lines on 1080x1920)."""
    lines = max(HEADLINE_MIN_LINES, min(HEADLINE_MAX_LINES, int(line_count) or 2))
    scale = play_h / 1920.0
    per_line = int(round(_per_line_px * scale))
    pad = int(round(_pad_px * scale))
    return max(int(round(_min_box_px * scale)), lines * per_line + pad)


def video_band_height(*, play_w: int = PLAY_W) -> int:
    h = int(round(play_w * 9 / 16))
    return h - (h % 2)


def overlay_layout(
    headline_line_count: int,
    *,
    play_w: int = PLAY_W,
    play_h: int = PLAY_H,
) -> dict[str, int]:
    h_box = headline_box_height(headline_line_count, play_h=play_h)
    vid_y = HEADLINE_TOP + h_box
    vid_h = video_band_height(play_w=play_w)
    if vid_y + vid_h > play_h:
        vid_h = max(2, play_h - vid_y - int(round(_video_bottom_reserve_px * play_h / 1920)))
    bottom_y = vid_y + vid_h
    bottom_h = max(0, play_h - bottom_y)
    badge_y = bottom_y - int(round(_badge_offset_px * play_h / 1920))
    return {
        "play_w": play_w,
        "play_h": play_h,
        "top_blur_h": HEADLINE_TOP,
        "headline_top": HEADLINE_TOP,
        "headline_h": h_box,
        "video_y": vid_y,
        "video_h": vid_h,
        "bottom_y": bottom_y,
        "bottom_h": bottom_h,
        "chat_top": bottom_y,
        "chat_h": bottom_h,
        "badge_y": badge_y,
    }
