"""Streamer clip metadata (S9): game, VOD offset links, chapter lookup."""
from __future__ import annotations

from typing import Any


def chapter_at_ms(chapters: list[dict] | None, peak_ms: int) -> str | None:
    if not chapters:
        return None
    for ch in chapters:
        start = int(ch.get("startMs") or ch.get("start_ms") or 0)
        end = int(ch.get("endMs") or ch.get("end_ms") or start + 1)
        if start <= peak_ms < end:
            title = ch.get("title") or ch.get("name")
            return str(title) if title else None
    return None


def twitch_vod_timestamp_url(url: str | None, offset_ms: int) -> str | None:
    if not url or "twitch.tv" not in url:
        return None
    total_s = max(0, offset_ms // 1000)
    h = total_s // 3600
    m = (total_s % 3600) // 60
    s = total_s % 60
    if h:
        t = f"{h}h{m}m{s}s"
    elif m:
        t = f"{m}m{s}s"
    else:
        t = f"{s}s"
    sep = "&" if "?" in url else "?"
    return f"{url}{sep}t={t}"


def enrich_streamer_meta(
    ai_meta: dict[str, Any],
    *,
    vod: dict,
    peak_ms: int,
    clip_start_ms: int,
    chapters: list[dict] | None = None,
) -> dict[str, Any]:
    streamer = dict(ai_meta.get("streamer") or {})
    category = vod.get("category")
    game = chapter_at_ms(chapters if isinstance(chapters, list) else None, peak_ms) or category
    channel = None
    if vod.get("channelLogin"):
        channel = vod["channelLogin"]
    vod_base_ms = int(vod.get("rangeStartMs") or 0)
    abs_clip_start = vod_base_ms + int(clip_start_ms)
    abs_peak = vod_base_ms + int(peak_ms)
    meta = {
        "game": game,
        "vodTitle": vod.get("title"),
        "channel": channel,
        "vodOffsetMs": abs_clip_start,
        "vodUrlAt": twitch_vod_timestamp_url(vod.get("url"), abs_clip_start),
        "platform": vod.get("platform"),
    }
    streamer["meta"] = meta
    streamer["vodRangeStartMs"] = vod_base_ms
    streamer["peakMs"] = abs_peak
    out = {**ai_meta, "streamer": streamer}
    return out
