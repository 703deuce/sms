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


def map_v2_to_legacy_ass_preset(p: dict) -> dict:
    if not p:
        return {}
    box = p.get("box")
    return {
        "slug": p.get("id") or "cp1",
        "name": p.get("name") or "CP",
        "font": p.get("font") or "Montserrat",
        "weight": int(p.get("weight") or 800),
        "case": p.get("case") or "upper",
        "wordsPerLine": int(p.get("wordsPerChunk") or 3),
        "sizePct": float(p.get("sizePx1920") or 80) / 1920 * 100,
        "position": "bottom",
        "marginVPct": int((1 - float((p.get("position") or {}).get("y") or 0.65)) * 100),
        "primary": p.get("fill") or "#FFFFFF",
        "active": (p.get("highlight") or {}).get("color") or "#FFD93D",
        "activeB": (p.get("highlight") or {}).get("altColor") or "#39FF14",
        "outline": (p.get("stroke") or {}).get("color") or "#000000",
        "outlineW": int((p.get("stroke") or {}).get("px") or 4),
        "shadow": int((p.get("shadow") or {}).get("px") or 0),
        "box": (
            {
                "color": box.get("color"),
                "padX": box.get("padX"),
                "padY": box.get("padY"),
                "radius": box.get("radiusPx"),
                "opacity": box.get("opacity"),
            }
            if isinstance(box, dict)
            else None
        ),
        "animation": (p.get("animation") or {}).get("kind") or "none",
        "emphasisScale": 1.15,
        "highlightMode": (p.get("highlight") or {}).get("mode") or "color",
        "animationMs": int((p.get("animation") or {}).get("ms") or 200),
    }
