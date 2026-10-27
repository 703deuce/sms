"""Resolve Kick live HLS playback URL (design — see KICK-LIVE-CAPTURE-DESIGN.md)."""
from __future__ import annotations

import json
import os
import subprocess
import urllib.error
import urllib.request
from typing import Any


def _channel_v2(slug: str, timeout_s: int = 30) -> dict[str, Any]:
    url = f"https://kick.com/api/v2/channels/{slug}"
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout_s) as resp:
        data = json.loads(resp.read())
    return data if isinstance(data, dict) else {}


def _pick_hls_from_channel(data: dict[str, Any]) -> str | None:
    for key in ("playback_url", "hls_source"):
        raw = data.get(key)
        if isinstance(raw, str) and "m3u8" in raw:
            return raw
    live = data.get("livestream")
    if isinstance(live, dict):
        for key in ("source", "playback_url", "hls_source"):
            raw = live.get(key)
            if isinstance(raw, str) and "m3u8" in raw:
                return raw
    return None


def resolve_kick_live_hls_url(slug: str, *, allow_ytdlp: bool = True) -> str | None:
    """
    Best-effort live master playlist URL.
    Official webhook does not include HLS; uses undocumented v2 channel API then yt-dlp -g.
    """
    slug = slug.strip().lower()
    try:
        data = _channel_v2(slug)
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError, TimeoutError):
        data = {}
    live = data.get("livestream") if isinstance(data.get("livestream"), dict) else {}
    if live and not live.get("is_live", True):
        # Channel page can expose playback_url even when offline — require live flag when present.
        if live.get("is_live") is False:
            return None
    url = _pick_hls_from_channel(data)
    if url:
        return url
    if not allow_ytdlp or os.environ.get("KICK_LIVE_YTDLP_FALLBACK", "1") != "1":
        return None
    try:
        out = subprocess.check_output(
            ["yt-dlp", "-g", "--no-playlist", f"https://kick.com/{slug}"],
            text=True,
            timeout=90,
        )
        line = (out or "").strip().splitlines()[0] if out else ""
        return line if "m3u8" in line else None
    except (subprocess.CalledProcessError, OSError, IndexError):
        return None


def playback_host_for_log(url: str | None) -> str:
    if not url:
        return "-"
    try:
        from urllib.parse import urlparse

        return urlparse(url).netloc or "-"
    except Exception:
        return "-"
