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
