"""Clip finder reason tag (Speech / Visual / Both) — keep in sync with new-app/lib/clips/reason-tag.ts."""
from __future__ import annotations

VISUAL_IOU_MIN = 0.3
SPEECH_WPS_MIN = 0.8


def words_per_second(words: list[dict], start_ms: int, end_ms: int) -> float:
    span_s = max(0.001, (end_ms - start_ms) / 1000.0)
    n = 0
    for w in words:
        ws = float(w.get("s", 0)) * 1000.0
        we = float(w.get("e", 0)) * 1000.0
        if we >= start_ms and ws <= end_ms:
            n += 1
    return n / span_s


def reason_tag(ai_meta: dict, wps: float, mode: str | None = None) -> str:
    iou = float(ai_meta.get("videoMomentMatchIou") or 0.0)
    matched = iou >= VISUAL_IOU_MIN
    m = (mode or "").lower()
    if m == "anything":
        return "visual" if wps < SPEECH_WPS_MIN else "both"
    if matched and wps < SPEECH_WPS_MIN:
        return "visual"
    if matched:
        return "both"
    return "speech"


def clip_reason_ai_meta(pick: dict, clip_words: list[dict], mode: str | None) -> dict:
    ai = pick.get("aiMeta") or {}
    wps = words_per_second(clip_words, int(pick["start_ms"]), int(pick["end_ms"]))
    return {
        "wordsPerSec": round(wps, 2),
        "reasonTag": reason_tag(ai, wps, mode),
    }
