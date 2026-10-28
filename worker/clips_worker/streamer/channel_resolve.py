"""Resolve Twitch/Kick channel display + login for VOD imports."""
from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlparse


def _slug_from_url(url: str | None) -> str | None:
    if not url:
        return None
    try:
        u = urlparse(url if "://" in url else f"https://{url}")
        parts = [p for p in u.path.split("/") if p]
        if not parts:
            return None
        if parts[0].lower() in ("videos", "video", "clip", "clips"):
            return None
        slug = parts[0].lower()
        if slug in ("directory", "settings"):
            return None
        return slug[:25]
    except Exception:
        return None


def _twitch_video_id(url: str | None) -> str | None:
    if not url:
        return None
    m = re.search(r"twitch\.tv/videos/(\d+)", url, re.I)
    return m.group(1) if m else None


def _helix_video_channel(video_id: str) -> tuple[str | None, str | None]:
    try:
        from clips_worker.streamer.autopull_job import _helix_app_token

        import json
        import urllib.request

        token = _helix_app_token()
        cid = __import__("os").environ.get("TWITCH_CLIENT_ID", "")
        if not token or not cid:
            return None, None
        req = urllib.request.Request(
            f"https://api.twitch.tv/helix/videos?id={video_id}",
            headers={"Authorization": f"Bearer {token}", "Client-Id": cid},
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode())
        items = data.get("data") or []
        if not items:
            return None, None
        v = items[0]
        login = str(v.get("user_login") or "").lower() or None
        name = str(v.get("user_name") or login or "").strip() or None
        return login, name
    except Exception:
        return None, None


def resolve_vod_channel_fields(
    vod: dict,
    import_meta: dict[str, Any] | None,
    url: str | None,
) -> dict[str, str | None]:
    """Returns login (lowercase) and display name for badges/meta."""
    state = vod.get("state") or {}
    if isinstance(state, str):
        import json

        state = json.loads(state) if state else {}
    login = (
        str(vod.get("channelLogin") or state.get("channelLogin") or "").strip().lower()
        or str((import_meta or {}).get("login") or "").strip().lower()
        or _slug_from_url(url)
    )
    display = (
        str(state.get("channelDisplayName") or "").strip()
        or str((import_meta or {}).get("channel") or "").strip()
        or (login.upper() if login else None)
    )
    platform = str(vod.get("platform") or "").lower()
    if platform == "twitch" and url:
        vid = _twitch_video_id(url)
        if vid:
            h_login, h_name = _helix_video_channel(vid)
            if h_login:
                login = h_login
            if h_name:
                display = h_name
    if login and not display:
        display = login
    return {"login": login or None, "display": display or None}
