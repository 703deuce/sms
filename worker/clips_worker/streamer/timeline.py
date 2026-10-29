"""Single VOD ↔ window-media ↔ clip timeline conversions (ms / s)."""
from __future__ import annotations


def media_ms_to_vod_ms(media_ms: int, anchor_vod_start_ms: int) -> int:
    return int(anchor_vod_start_ms) + int(media_ms)


def vod_ms_to_media_s(vod_ms: int, anchor_vod_start_ms: int) -> float:
    return (int(vod_ms) - int(anchor_vod_start_ms)) / 1000.0


def compute_cut(abs_start_ms: int, abs_end_ms: int, seg_vod_start_ms: int) -> tuple[int, int]:
    """Return (rel_start_ms, rel_end_ms) within a segment whose t=0 is seg_vod_start_ms."""
    rel_start = max(0, int(abs_start_ms) - int(seg_vod_start_ms))
    rel_end = max(rel_start + 100, int(abs_end_ms) - int(seg_vod_start_ms))
    return rel_start, rel_end
