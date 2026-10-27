"""Allow export trim to extend slightly beyond the AI clip window on the source timeline."""
from __future__ import annotations

MAX_TRIM_EXTEND_MS = 8000


def expanded_source_cut_ms(clip_start_ms: int, clip_end_ms: int, edits: dict) -> tuple[int, int]:
    trim = edits.get("trim") or {}
    tin = int(trim.get("in", clip_start_ms))
    tout = int(trim.get("out", clip_end_ms))
    lo = max(0, clip_start_ms - MAX_TRIM_EXTEND_MS)
    hi = clip_end_ms + MAX_TRIM_EXTEND_MS
    cut_start = max(lo, min(clip_start_ms, tin))
    cut_end = min(hi, max(clip_end_ms, tout))
    if cut_end <= cut_start:
        return clip_start_ms, clip_end_ms
    return cut_start, cut_end
