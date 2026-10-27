"""Regular-clipper polish defaults (flags, cheap heuristics). Mirrors new-app/lib/clips/clip-polish.ts."""
from __future__ import annotations

import os
from typing import Any

from clips_worker.caption_keyword_emphasis import auto_caption_emphasis_indexes

FEATURE_ENV = {
    "CAPTIONS": "CLIP_POLISH_CAPTIONS",
    "ZOOM": "CLIP_POLISH_ZOOM",
    "SILENCE": "CLIP_POLISH_SILENCE",
    "HOOK": "CLIP_POLISH_HOOK",
    "AUDIO": "CLIP_POLISH_AUDIO",
    "OVERLAYS": "CLIP_POLISH_OVERLAYS",
}


def polish_feature_enabled(feature: str) -> bool:
    if os.environ.get("CLIP_POLISH_DEFAULT") == "0":
        return False
    key = FEATURE_ENV.get(feature)
    if not key:
        return True
    v = os.environ.get(key)
    if v in ("0", "false"):
        return False
    if v in ("1", "true"):
        return True
    return True


POLISHED_CAPTION_CONFIG = {
    "font": "Montserrat",
    "weight": 900,
    "outlineW": 8,
    "primary": "#FFFFFF",
    "active": "#FFD93D",
    "activeB": "#39FF14",
    "emphasisScale": 1.12,
}


def _silence_preset(stream: bool) -> dict:
    if stream:
        return {
            "enabled": True,
            "minGapMs": 520,
            "keepMs": 180,
            "fillerTrim": True,
            "protectReactionGaps": True,
        }
    return {"enabled": True, "minGapMs": 350, "keepMs": 120, "fillerTrim": True}


def apply_clip_polish_initial(
    edits: dict,
    pick: dict,
    clip_words: list[dict],
    settings: dict,
) -> dict:
    stream = settings.get("genre") in ("gaming", "sports") or settings.get("mode") == "anything"
    out = dict(edits)
    cap = dict(out.get("captions") or {})

    if polish_feature_enabled("CAPTIONS"):
        cap.update(
            {
                "enabled": True,
                "presetId": cap.get("presetId") or "bold_pop",
                "animation": "pop",
                "wordsPerLine": 3,
                "case": "upper" if stream else "sentence",
                "keywordHighlight": True,
                "colors": {"a": "#FFD93D", "b": "#39FF14"},
                "presetConfig": {**POLISHED_CAPTION_CONFIG, **(cap.get("presetConfig") or {})},
            }
        )
        emph = auto_caption_emphasis_indexes(clip_words, {"captions": cap})
        cap["emphasis"] = list(dict.fromkeys([*(cap.get("emphasis") or []), *emph]))[:48]
        out["captions"] = cap

    if polish_feature_enabled("ZOOM"):
        layout = (out.get("layout") or {}).get("mode") or settings.get("layout")
        out["zoom"] = {
            "enabled": True,
            "intensity": 1.12,
            "facecamOnly": stream or layout in ("screen_pip",),
        }

    if polish_feature_enabled("SILENCE"):
        out["silenceTrim"] = _silence_preset(stream)

    if polish_feature_enabled("AUDIO"):
        out["loudnessLufs"] = -14

    if polish_feature_enabled("HOOK"):
        hook = str(pick.get("hook") or "").strip()
        if 8 <= len(hook) <= 80 and len(hook.split()) <= 12:
            out["hookOverlay"] = {"enabled": True, "text": hook, "durationMs": 2200}

    if polish_feature_enabled("OVERLAYS"):
        brand = out.get("brand")
        if isinstance(brand, dict):
            pos = str(brand.get("logoPosition") or "bottom_left").lower().replace("-", "_")
            if pos == "bottom_right":
                brand = {**brand, "logoPosition": "bottom_left"}
                out["brand"] = brand

    return out
