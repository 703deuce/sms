"""T6 per-clip layout signals (P1)."""
from __future__ import annotations

from typing import Any

SIGNALS_VERSION = 1


def _clamp01(v: float) -> float:
    return max(0.0, min(1.0, float(v)))


def _norm_box(raw: Any) -> dict | None:
    if not isinstance(raw, dict):
        return None
    try:
        x = _clamp01(float(raw.get("x", 0)))
        y = _clamp01(float(raw.get("y", 0)))
        w = _clamp01(float(raw.get("w", 0)))
        h = _clamp01(float(raw.get("h", 0)))
    except (TypeError, ValueError):
        return None
    if w <= 0 or h <= 0:
        return None
    if x + w > 1.001:
        w = max(0.01, 1.0 - x)
    if y + h > 1.001:
        h = max(0.01, 1.0 - y)
    return {"x": round(x, 4), "y": round(y, 4), "w": round(w, 4), "h": round(h, 4)}


def validate_ai(raw: dict | None) -> dict:
    if not isinstance(raw, dict):
        return {}
    out: dict[str, Any] = {}
    ct = str(raw.get("clip_type") or raw.get("clipType") or "").strip().lower()
    if ct in ("gaming", "irl", "just_chatting", "podcast"):
        out["clip_type"] = ct
    try:
        out["type_conf"] = _clamp01(float(raw.get("type_conf", raw.get("typeConf", 0))))
    except (TypeError, ValueError):
        out["type_conf"] = 0.0
    for key in ("game_ui_visible", "real_camera_footage", "background_action", "hud_at_edges"):
        if key in raw:
            out[key] = bool(raw.get(key))
    for box_key in ("action_box", "content_box", "facecam_box"):
        if box_key in raw:
            box = _norm_box(raw.get(box_key))
            if box:
                out[box_key] = box
    mk = str(raw.get("moment_kind") or "").strip().lower()
    if mk in ("play", "reaction", "story", "hot_take", "event"):
        out["moment_kind"] = mk
    en = str(raw.get("energy") or "").strip().lower()
    if en in ("low", "mid", "high"):
        out["energy"] = en
    reason = raw.get("background_action_reason")
    if isinstance(reason, str):
        out["background_action_reason"] = reason[:240]
    return out


def signals_or_defaults(ai_meta: dict | None) -> dict:
    meta = ai_meta if isinstance(ai_meta, dict) else {}
    stored = meta.get("signals")
    if isinstance(stored, dict) and stored.get("v") == SIGNALS_VERSION:
        base = dict(stored)
    else:
        base = {"v": SIGNALS_VERSION}
    clip_type = str(meta.get("clipType") or base.get("clip_type") or "irl")
    base.setdefault("clip_type", clip_type)
    base.setdefault("type_conf", float(base.get("type_conf") or 0.0))
    base.setdefault("game_ui_visible", bool(base.get("game_ui_visible", False)))
    base.setdefault("real_camera_footage", bool(base.get("real_camera_footage", False)))
    fc = None
    layout = (meta.get("facecamLayout") or {}) if isinstance(meta.get("facecamLayout"), dict) else {}
    if isinstance(layout.get("facecam"), dict):
        fc = _norm_box(layout.get("facecam"))
    base.setdefault("facecam_box", fc)
    base.setdefault("facecam_conf", float(meta.get("facecamConfidence") or base.get("facecam_conf") or 0.0))
    base.setdefault("person_count", int(base.get("person_count") or 1))
    base.setdefault("background_action", bool(base.get("background_action", True)))
    base.setdefault("moment_kind", str(base.get("moment_kind") or "story"))
    base.setdefault("energy", str(base.get("energy") or "mid"))
    base.setdefault("hud_at_edges", bool(base.get("hud_at_edges", False)))
    bands = base.get("bands")
    if not isinstance(bands, dict):
        bands = {}
    for band in ("top", "bottom", "caption"):
        row = bands.get(band) if isinstance(bands.get(band), dict) else {}
        base.setdefault("bands", {})
        base["bands"].setdefault(
            band,
            {
                "luma": float(row.get("luma", 0.3)),
                "busy": float(row.get("busy", 0.5)),
            },
        )
    base.setdefault("sources", {"ai": "none", "cv": "local"})
    base.setdefault("cost_usd", float(base.get("cost_usd") or 0.0))
    return base


def merge_dense_layout_signals(candidate: dict | None) -> dict | None:
    if not isinstance(candidate, dict):
        return None
    raw = candidate.get("layout_signals")
    if not isinstance(raw, dict):
        return None
    validated = validate_ai(raw)
    if not validated:
        return None
    validated["v"] = SIGNALS_VERSION
    validated["sources"] = {"ai": "dense", "cv": "local"}
    return validated


def signals_call(clip_file, words: list[dict], work, model: str | None = None) -> tuple[dict | None, float]:
    """Optional Flash-Lite signals call; returns (signals, cost_usd)."""
    _ = (clip_file, words, work, model)
    return None, 0.0


def build_signals_for_clip(
    *,
    ai_meta: dict,
    fc_layout: dict | None,
    words: list[dict] | None,
    crop_track: dict | None,
    clip_file,
    work,
    dense_candidate: dict | None = None,
) -> dict:
    from clips_worker.t6_cv import enrich_signals_cv

    base = signals_or_defaults(ai_meta)
    dense = merge_dense_layout_signals(dense_candidate)
    if dense:
        base.update({k: v for k, v in dense.items() if k != "v"})
        base["sources"] = {"ai": "dense", "cv": "local"}
    elif isinstance(ai_meta.get("videoMoment"), dict):
        vm = ai_meta["videoMoment"]
        if vm.get("game_ui_visible") is not None or vm.get("real_camera_footage") is not None:
            base["game_ui_visible"] = bool(vm.get("game_ui_visible"))
            base["real_camera_footage"] = bool(vm.get("real_camera_footage"))
            base["sources"] = {"ai": "picker", "cv": "local"}
    if isinstance(fc_layout, dict):
        if isinstance(fc_layout.get("facecam"), dict):
            box = _norm_box(fc_layout.get("facecam"))
            if box:
                base["facecam_box"] = box
        base["facecam_conf"] = float(fc_layout.get("confidence") or base.get("facecam_conf") or 0.0)
    try:
        base = enrich_signals_cv(base, clip_file, words or [], crop_track)
    except Exception:
        pass
    base["v"] = SIGNALS_VERSION
    return base
