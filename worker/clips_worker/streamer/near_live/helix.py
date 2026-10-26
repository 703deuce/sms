"""Twitch Helix helpers for near-live archive polling."""
from __future__ import annotations

import json
import os
import re
import urllib.request


def _parse_duration(dur: str) -> int:
    h = int(re.search(r"(\d+)h", dur or "").group(1)) if re.search(r"(\d+)h", dur or "") else 0
    m = int(re.search(r"(\d+)m", dur or "").group(1)) if re.search(r"(\d+)m", dur or "") else 0
    s = int(re.search(r"(\d+)s", dur or "").group(1)) if re.search(r"(\d+)s", dur or "") else 0
    return (h * 3600 + m * 60 + s) * 1000


def app_token() -> str:
    import urllib.parse

    cid = os.environ["TWITCH_CLIENT_ID"]
    secret = os.environ["TWITCH_CLIENT_SECRET"]
    data = urllib.parse.urlencode(
        {"client_id": cid, "client_secret": secret, "grant_type": "client_credentials"}
    ).encode()
    req = urllib.request.Request("https://id.twitch.tv/oauth2/token", data=data, method="POST")
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())["access_token"]


def latest_archive_video(user_id: str) -> dict | None:
    token = app_token()
    cid = os.environ["TWITCH_CLIENT_ID"]
    url = f"https://api.twitch.tv/helix/videos?user_id={user_id}&type=archive&first=1"
    req = urllib.request.Request(url, headers={"Client-Id": cid, "Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read())
    v = (data.get("data") or [None])[0]
    if not v:
        return None
    return {
        "id": v["id"],
        "url": v["url"],
        "durationMs": _parse_duration(v.get("duration") or "0s"),
        "title": v.get("title"),
    }
