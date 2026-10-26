"""Twitch Helix Get Clips for viewer-clip signal (S6)."""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request


def _app_token() -> str | None:
    cid = os.environ.get("TWITCH_CLIENT_ID") or os.environ.get("TWITCH_HELIX_CLIENT_ID")
    secret = os.environ.get("TWITCH_CLIENT_SECRET") or os.environ.get("TWITCH_HELIX_CLIENT_SECRET")
    if not cid or not secret:
        return None
    body = urllib.parse.urlencode(
        {"client_id": cid, "client_secret": secret, "grant_type": "client_credentials"}
    ).encode()
    req = urllib.request.Request(
        "https://id.twitch.tv/oauth2/token",
        data=body,
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode())
    return data.get("access_token")


def _helix_get(path: str, params: dict, token: str, client_id: str) -> dict:
    q = urllib.parse.urlencode(params)
    url = f"https://api.twitch.tv/helix/{path}?{q}"
    req = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {token}", "Client-Id": client_id},
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode())


def fetch_clips_for_vod(
    *,
    broadcaster_id: str,
    video_id: str,
    started_at: str,
    ended_at: str,
    max_clips: int = 1000,
) -> list[dict]:
    cid = os.environ.get("TWITCH_CLIENT_ID") or os.environ.get("TWITCH_HELIX_CLIENT_ID")
    if not cid:
        return []
    token = _app_token()
    if not token:
        return []
    out: list[dict] = []
    cursor: str | None = None
    while len(out) < max_clips:
        params: dict[str, str | int] = {
            "broadcaster_id": broadcaster_id,
            "started_at": started_at,
            "ended_at": ended_at,
            "first": 100,
        }
        if cursor:
            params["after"] = cursor
        try:
            data = _helix_get("clips", params, token, cid)
        except (urllib.error.HTTPError, TimeoutError, OSError):
            break
        for row in data.get("data") or []:
            if str(row.get("video_id")) != str(video_id):
                continue
            if row.get("vod_offset") is None:
                continue
            out.append(
                {
                    "vod_offset_s": int(row["vod_offset"]),
                    "duration_s": float(row.get("duration", 30)),
                    "view_count": int(row.get("view_count", 0)),
                    "id": row.get("id"),
                }
            )
        cursor = (data.get("pagination") or {}).get("cursor")
        if not cursor:
            break
        time.sleep(0.15)
    return out[:max_clips]
