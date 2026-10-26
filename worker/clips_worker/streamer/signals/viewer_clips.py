"""Viewer-created clip signal (S6)."""
from __future__ import annotations

import math


def viewer_clips_signal_per_second(
    clips: list[dict],
    duration_s: int,
    *,
    sigma_s: float = 10.0,
) -> list[float]:
    if duration_s <= 0 or not clips:
        return []
    out = [0.0] * duration_s
    sigma2 = 2 * (sigma_s ** 2)
    for clip in clips:
        try:
            center = int(float(clip.get("vod_offset_s", clip.get("offset_s", 0))))
            if clip.get("duration_s"):
                center += int(float(clip["duration_s"]) / 2)
            views = float(clip.get("view_count", clip.get("views", 0)) or 0)
        except (TypeError, ValueError):
            continue
        height = math.log1p(max(0.0, views))
        for t in range(duration_s):
            d = t - center
            out[t] += height * math.exp(-(d * d) / sigma2)
    peak = max(out) if out else 0.0
    if peak > 0:
        out = [v / peak for v in out]
    return out


def viewer_clip_reason_label(clips: list[dict], start_ms: int, end_ms: int) -> str | None:
    lo = start_ms // 1000
    hi = end_ms // 1000
    hits = []
    for c in clips:
        try:
            off = int(float(c.get("vod_offset_s", 0)))
            dur = int(float(c.get("duration_s", 30)))
        except (TypeError, ValueError):
            continue
        if off + dur < lo or off > hi:
            continue
        hits.append(c)
    if not hits:
        return None
    views = sum(int(float(h.get("view_count", h.get("views", 0)) or 0)) for h in hits)
    return f"{len(hits)} viewer clip(s) · {views} views"
