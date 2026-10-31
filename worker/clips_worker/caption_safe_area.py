"""Caption safe-area clamps for burned-in export (mirrors new-app caption-safe-area.ts)."""
from __future__ import annotations

from clips_worker.caption_presets import PRESETS, resolve_preset

CAPTION_MIN_MARGIN_V_PCT = 12.0
CAPTION_MAX_SIZE_PCT = 10.5
SAFE_TEXT_BAND = 0.82


def caption_min_margin_v_pct(play_w: int | None, play_h: int) -> float:
    """G3a: bottom safe margin by frame shape — 9:16 keeps 12 %; 4:5 10, 1:1 8, 16:9 6 (FV3 layouts)."""
    if not play_w or not play_h:
        return CAPTION_MIN_MARGIN_V_PCT
    r = play_w / play_h
    if r >= 1.5:
        return 6.0
    if r >= 0.95:
        return 8.0
    if r >= 0.75:
        return 10.0
    return CAPTION_MIN_MARGIN_V_PCT


def clamp_caption_export_style(edits_captions: dict, play_h: int = 1280, play_w: int | None = None) -> dict:
    cap = dict(edits_captions or {})
    preset = resolve_preset(cap.get("presetId") or cap.get("preset"))
    min_m = caption_min_margin_v_pct(play_w, play_h)
    margin_v = float(cap.get("marginVPct") or preset.get("marginVPct") or CAPTION_MIN_MARGIN_V_PCT)
    margin_v = max(min_m, margin_v)
    size_pct = float(cap.get("size") or cap.get("sizePct") or preset.get("sizePct") or 6.5)
    size_pct = min(CAPTION_MAX_SIZE_PCT, max(3.0, size_pct))
    fontsize = size_pct / 100.0 * play_h
    margin_px = margin_v / 100.0 * play_h
    max_margin_px = play_h * SAFE_TEXT_BAND - fontsize * 1.45
    if margin_px > max_margin_px and max_margin_px > 0:
        margin_v = max(min_m, (max_margin_px / play_h) * 100.0)
    cap["marginVPct"] = round(margin_v, 1)
    cap["size"] = round(size_pct, 1)
    cap["position"] = cap.get("position") or preset.get("position") or "bottom"
    cap["_safeAreaOk"] = True
    return cap


def verify_all_presets_safe(play_h: int = 1920) -> list[tuple[str, bool]]:
    out: list[tuple[str, bool]] = []
    for preset_id in PRESETS:
        style = clamp_caption_export_style({"presetId": preset_id}, play_h)
        out.append((preset_id, bool(style.get("_safeAreaOk"))))
    return out
