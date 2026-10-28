"""Absolute vs window-relative clip times (live rolling capture)."""
from __future__ import annotations

import json


def clip_vod_range_start_ms(clip: dict, vod_default: int) -> int:
    meta = clip.get("aiMeta") or {}
    if isinstance(meta, str):
        meta = json.loads(meta) if meta else {}
    sm = (meta.get("streamer") or {}) if isinstance(meta, dict) else {}
    if sm.get("vodRangeStartMs") is not None:
        return int(sm["vodRangeStartMs"])
    return int(vod_default)


def clip_absolute_span_ms(clip: dict, vod_range_start_ms: int) -> tuple[int, int, int]:
    """
    Return (abs_start_ms, abs_end_ms, window_base_ms).
    """
    start_ms = int(clip["startMs"])
    end_ms = int(clip["endMs"])
    window_base = clip_vod_range_start_ms(clip, vod_range_start_ms)
    meta = clip.get("aiMeta") or {}
    if isinstance(meta, str):
        meta = json.loads(meta) if meta else {}
    sm = (meta.get("streamer") or {}) if isinstance(meta, dict) else {}
    if sm.get("clipTimesAbsolute") is True:
        return start_ms, end_ms, window_base
    if sm.get("clipTimesAbsolute") is False:
        return window_base + start_ms, window_base + end_ms, window_base
    if window_base <= 0:
        return start_ms, end_ms, window_base
    return start_ms, end_ms, window_base
