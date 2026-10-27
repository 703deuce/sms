"""Twitch VOD storage checks for autopull (Helix archive list)."""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request


def twitch_archive_count(user_id: str) -> int:
    import urllib.parse

    cid = os.environ["TWITCH_CLIENT_ID"]
    secret = os.environ["TWITCH_CLIENT_SECRET"]
    data = urllib.parse.urlencode(
        {"client_id": cid, "client_secret": secret, "grant_type": "client_credentials"}
    ).encode()
    req = urllib.request.Request("https://id.twitch.tv/oauth2/token", data=data, method="POST")
    with urllib.request.urlopen(req, timeout=30) as resp:
        token = json.loads(resp.read())["access_token"]
    url = f"https://api.twitch.tv/helix/videos?user_id={user_id}&type=archive&first=1"
    vreq = urllib.request.Request(
        url, headers={"Client-Id": cid, "Authorization": f"Bearer {token}"}
    )
    with urllib.request.urlopen(vreq, timeout=30) as resp:
        body = json.loads(resp.read())
    return len(body.get("data") or [])


def channel_stores_past_broadcasts(user_id: str) -> bool:
    try:
        return twitch_archive_count(user_id) > 0
    except (urllib.error.URLError, urllib.error.HTTPError, KeyError, OSError):
        return True
