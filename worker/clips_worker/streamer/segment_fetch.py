"""Segment fetch timebase for STREAM_RENDER (window-relative vs full-VOD absolute)."""
from __future__ import annotations

import json
from pathlib import Path


def plan_segment_download_times(
    *,
    kind: str,
    window_base_ms: int,
    rel_start_s: float,
    rel_end_s: float,
) -> tuple[float, float, float]:
    """
    Return (source_base_s, start_s, end_s) passed to yt-dlp or cut_local_segment.
    Window-local sources use base 0; full Twitch/Kick VOD URLs add window offset.
    """
    base_s = 0.0
    if kind == "full_vod_url":
        base_s = max(0.0, int(window_base_ms) / 1000.0)
    return base_s, rel_start_s + base_s, rel_end_s + base_s


def resolve_clip_window_media(
    clip: dict,
    state: dict,
    *,
    layout_video: Path | None,
    local_upload: Path | None,
) -> tuple[Path | None, str]:
    ai = clip.get("aiMeta") or {}
    if isinstance(ai, str):
        ai = json.loads(ai) if ai else {}
    if (ai.get("streamer") or {}).get("captureVideoKey") or state.get("windowCaptureVideoKey"):
        return None, "window_capture"
    if layout_video and layout_video.is_file():
        if local_upload and layout_video.resolve() == local_upload.resolve():
            return layout_video, "upload"
        return layout_video, "proxy"
    if local_upload and local_upload.is_file():
        return local_upload, "upload"
    return None, "full_vod_url"
