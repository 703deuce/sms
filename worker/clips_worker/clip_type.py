"""Per-clip content type from Gemini first-pass output + facecam detection (T5)."""
from __future__ import annotations

from typing import Any

CLIP_TYPES = frozenset({"gaming", "irl", "just_chatting", "podcast", "other"})
FACECAM_CONFIDENCE_THRESHOLD = 0.45


def _norm_content_type(raw: str | None) -> str | None:
    v = (raw or "").strip().lower().replace("-", "_").replace(" ", "_")
    if v in CLIP_TYPES:
        return v
    if v in ("justchatting", "just_chat", "talking", "desk"):
        return "just_chatting"
    if v in ("game", "gaming_stream"):
        return "gaming"
    if v in ("reaction", "creative"):
        return "just_chatting"
    return None


def content_type_from_picker_moment(moment: dict | None, section_activity: str | None = None) -> str:
    if isinstance(moment, dict):
        ct = _norm_content_type(str(moment.get("content_type") or ""))
        if ct:
            return ct
        cats = moment.get("category") or []
        if isinstance(cats, list):
            cats_l = [str(c).lower() for c in cats]
            if "gaming" in cats_l:
                return "gaming"
            if "irl" in cats_l:
                return "irl"
            if "talking" in cats_l or "reaction" in cats_l or "creative" in cats_l:
                return "just_chatting"
    act = (section_activity or "").lower()
    if "gaming" in act or "game" in act:
        return "gaming"
    if "irl" in act:
        return "irl"
    if "podcast" in act or "interview" in act:
        return "podcast"
    if "talk" in act or "chat" in act or "reaction" in act:
        return "just_chatting"
    return "other"


def resolve_clip_type(
    *,
    moment: dict | None,
    section_activity: str | None,
    stream_majority: str | None,
    has_facecam: bool,
    facecam_confidence: float,
) -> dict[str, Any]:
    ct = content_type_from_picker_moment(moment, section_activity)
    if ct == "other" and stream_majority in CLIP_TYPES:
        ct = str(stream_majority)
    return {
        "clipType": ct,
        "hasFacecam": bool(has_facecam),
        "facecamConfidence": round(float(facecam_confidence or 0.0), 3),
    }


def video_moment_for_pick(
    video_moments: list[dict] | None,
    start_ms: int,
    end_ms: int,
) -> dict | None:
    if not video_moments:
        return None
    best: dict | None = None
    best_iou = 0.0
    for vm in video_moments:
        try:
            if vm.get("start_ms") is not None:
                v0 = int(vm["start_ms"])
                v1 = int(vm["end_ms"])
            else:
                v0 = int(float(vm.get("start_s", 0)) * 1000)
                v1 = int(float(vm.get("end_s", vm.get("start_s", 0))) * 1000)
        except (TypeError, ValueError):
            continue
        inter = max(0, min(end_ms, v1) - max(start_ms, v0))
        union = max(end_ms, v1) - min(start_ms, v0)
        iou = inter / union if union > 0 else 0.0
        if iou > best_iou:
            best_iou = iou
            best = vm
    return best if best_iou >= 0.15 else None


def section_activity_for_moment(moment: dict | None, sections: list[dict] | None) -> str | None:
    if not isinstance(moment, dict) or not sections:
        return None
    try:
        m0 = float(moment.get("start_s") or 0)
        m1 = float(moment.get("end_s") or m0)
    except (TypeError, ValueError):
        return None
    mid = (m0 + m1) / 2.0
    for sec in sections:
        if not isinstance(sec, dict):
            continue
        try:
            s0 = float(sec.get("start_s") or 0)
            s1 = float(sec.get("end_s") or s0)
        except (TypeError, ValueError):
            continue
        if s0 <= mid <= s1:
            return str(sec.get("activity") or "")
    return None


def stream_majority_clip_type(types: list[str]) -> str | None:
    counts: dict[str, int] = {}
    for t in types:
        if t in CLIP_TYPES:
            counts[t] = counts.get(t, 0) + 1
    if not counts:
        return None
    return max(counts, key=counts.get)
