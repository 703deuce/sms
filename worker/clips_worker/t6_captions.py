"""T6 caption preset pick + placement (P3)."""
from __future__ import annotations

from clips_worker.t6_registry import CAPTION_PRESETS_V2


def pick_caption_preset(signals: dict, clip: dict, history: list[str], seed: str) -> tuple[str, str]:
    _ = (clip, history, seed)
    lane = str(signals.get("clip_type") or "irl")
    if lane == "gaming":
        return "cp2", "gaming_default"
    if lane == "podcast":
        return "cp5", "podcast_default"
    if lane == "just_chatting":
        return "cp1", "chat_default"
    return "cp10", "irl_default"


def adapt_colors(preset: dict, band: dict) -> dict:
    out = dict(preset)
    luma = float((band or {}).get("luma") or 0.3)
    if luma > 0.6:
        out["fill"] = "#111111"
    return out


def caption_rect(spec: dict, preset: dict, signals: dict) -> dict:
    _ = (preset, signals)
    if isinstance(spec, dict) and isinstance(spec.get("captionRect"), dict):
        return dict(spec["captionRect"])
    return {"x": 0, "y": 1248, "w": 1080, "h": 230}


def resolve_caption_preset_v2(preset_id: str) -> dict:
    return dict(CAPTION_PRESETS_V2.get(preset_id) or CAPTION_PRESETS_V2.get("cp1") or {})
