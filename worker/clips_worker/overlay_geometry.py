"""Shared overlay geometry — parity with new-app/lib/clips/overlay-geometry.json."""
from __future__ import annotations

import json
from pathlib import Path

_DEFAULTS: dict = {
    "version": 1,
    "baseH": 1920,
    "fitTop": {
        "headlineTop": 150,
        "minLines": 2,
        "maxLines": 4,
        "perLinePx": 110,
        "padPx": 40,
        "minBoxPx": 320,
        "videoBottomReservePx": 80,
        "badgeOffsetPx": 40,
    },
    "exportBar": {
        "barFrac": 0.20,
        "footerFrac": 0.28,
        "sourceInsetY": 12,
        "fontLink": 22,
        "badgeW": 108,
        "badgeH": 36,
        "textAnchorFrac": 0.55,
        "textMinPadPx": 48,
        "headlineTextMinY": {
            "tiktok": 260,
            "youtube_shorts": 380,
            "instagram_reels": 250,
        },
    },
    "headline": {
        "wrapCharsPerLine": 22,
        "wrapMaxLines": 3,
        "charLimit": 72,
        "fontFitTop": "Anton",
        "fontBar": "Montserrat",
    },
    "headlineStyles": {
        "stream_white_box": {"textColor": "#000000", "boxColor": "#FFFFFF", "radiusPx": 0},
        "export_bar": {"textColor": "#000000", "boxColor": "#FFFFFF", "radiusPx": 0},
    },
    "badgeRect": {
        "fitTopBand": {
            "widthPx": 200,
            "heightPx": 32,
            "logoSizePx": 28,
            "padPx": 8,
            "centerX": True,
        },
        "exportBar": {
            "widthPx": 108,
            "heightPx": 36,
            "logoSizePx": 24,
            "padLeftPx": 10,
            "linkGapPx": 12,
            "insetLeftPx": 16,
        },
    },
    "platforms": {
        "twitch": {"label": "TWITCH", "color": "#9146FF"},
        "kick": {"label": "KICK", "color": "#53FC18"},
        "default": {"label": "LIVE", "color": "#9146FF"},
    },
}


def load_geometry() -> dict:
    try:
        return json.loads((Path(__file__).parent / "overlay_geometry.json").read_text())
    except Exception as e:
        print(f"[clipper:geometry] fallback_defaults err={type(e).__name__}", flush=True)
        return _DEFAULTS


GEOM = load_geometry()


def _scale_px(px: int, play_h: int) -> int:
    base_h = int(GEOM.get("baseH") or 1920)
    return max(1, int(round(px * play_h / base_h)))


def headline_styles() -> dict:
    return dict(GEOM.get("headlineStyles") or _DEFAULTS["headlineStyles"])


def headline_style_for_preset(preset: str) -> dict:
    styles = headline_styles()
    return dict(styles.get(preset) or styles.get("stream_white_box") or {})


def badge_rect(
    placement: str,
    play_w: int,
    play_h: int,
    *,
    video_y: int = 0,
    video_h: int = 0,
    badge_y: int | None = None,
) -> dict[str, int]:
    """Pixel rect {x,y,w,h} for platform badge overlay."""
    br = GEOM.get("badgeRect") or _DEFAULTS["badgeRect"]
    if placement == "fit_top_band":
        spec = br.get("fitTopBand") or {}
        w = _scale_px(int(spec.get("widthPx") or 200), play_h)
        h = _scale_px(int(spec.get("heightPx") or 32), play_h)
        y = badge_y if badge_y is not None else max(0, video_y + video_h - _scale_px(40, play_h) - h)
        x = (play_w - w) // 2 if spec.get("centerX") else _scale_px(16, play_w)
        return {"x": x, "y": y, "w": w, "h": h}
    spec = br.get("exportBar") or {}
    w = _scale_px(int(spec.get("widthPx") or int(GEOM["exportBar"]["badgeW"])), play_w)
    h = _scale_px(int(spec.get("heightPx") or int(GEOM["exportBar"]["badgeH"])), play_h)
    inset = _scale_px(int(spec.get("insetLeftPx") or 16), play_w)
    inset_y = _scale_px(int(GEOM["exportBar"].get("sourceInsetY") or 12), play_h)
    y = video_y + video_h - h - inset_y if video_h else play_h - h - inset_y
    return {"x": inset, "y": y, "w": w, "h": h}
