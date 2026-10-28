"""Shared 1080x1920 stream overlay geometry (fit_top + caption/chat safe zones)."""
from __future__ import annotations

PLAY_W = 1080
PLAY_H = 1920
TOP_BLUR_Y = 0
HEADLINE_TOP = 150
HEADLINE_MIN_LINES = 2
HEADLINE_MAX_LINES = 4


def headline_box_height(line_count: int, *, play_h: int = PLAY_H) -> int:
    """White headline band height (~470px at 3 lines on 1080x1920)."""
    lines = max(HEADLINE_MIN_LINES, min(HEADLINE_MAX_LINES, int(line_count) or 2))
    scale = play_h / 1920.0
    per_line = int(round(110 * scale))
    pad = int(round(40 * scale))
    return max(int(round(320 * scale)), lines * per_line + pad)


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
        vid_h = max(2, play_h - vid_y - int(round(80 * play_h / 1920)))
    bottom_y = vid_y + vid_h
    bottom_h = max(0, play_h - bottom_y)
    badge_y = bottom_y - int(round(40 * play_h / 1920))
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
