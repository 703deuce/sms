"""Kick viewer clips — best effort via yt-dlp flat playlist (S6)."""
from __future__ import annotations

import json
import subprocess


def fetch_kick_clips_for_vod(vod: dict) -> list[dict]:
    url = vod.get("url") or ""
    if "kick.com" not in url:
        return []
    slug = _channel_slug(url)
    if not slug:
        return []
    playlist_url = f"https://kick.com/{slug}/clips"
    try:
        out = subprocess.check_output(
            ["yt-dlp", "--flat-playlist", "-J", playlist_url],
            stderr=subprocess.DEVNULL,
            timeout=120,
            text=True,
        )
        data = json.loads(out)
    except (subprocess.CalledProcessError, json.JSONDecodeError, FileNotFoundError, subprocess.TimeoutExpired):
        return []
    streamed_at = vod.get("streamedAt")
    duration_ms = int(vod.get("durationMs") or 0)
    if not streamed_at or duration_ms <= 0:
        return []
    from datetime import datetime

    if isinstance(streamed_at, str):
        stream_start = datetime.fromisoformat(streamed_at.replace("Z", "+00:00")).timestamp()
    else:
        stream_start = streamed_at.timestamp()
    stream_end = stream_start + duration_ms / 1000.0
    clips: list[dict] = []
    for entry in data.get("entries") or []:
        ts = entry.get("timestamp") or entry.get("release_timestamp")
        if ts is None:
            continue
        t = float(ts)
        if t < stream_start - 3600 or t > stream_end + 3600:
            continue
        dur = float(entry.get("duration") or 30)
        offset = max(0, int(t - stream_start - dur))
        clips.append(
            {
                "vod_offset_s": offset,
                "duration_s": dur,
                "view_count": int(entry.get("view_count") or 0),
                "id": entry.get("id"),
            }
        )
    return clips


def _channel_slug(url: str) -> str | None:
    parts = url.replace("https://", "").replace("http://", "").split("/")
    try:
        idx = parts.index("kick.com")
        return parts[idx + 1] if len(parts) > idx + 1 else None
    except ValueError:
        if len(parts) >= 2 and "kick.com" in parts[0]:
            return parts[1]
    return None
