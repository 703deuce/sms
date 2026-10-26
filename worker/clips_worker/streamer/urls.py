"""Parse Twitch/Kick stream URLs (parity with new-app/lib/streamer/url.ts)."""
from __future__ import annotations

import re
import urllib.parse

BARE_CHANNEL_MSG = (
    "That's a channel page. Paste a VOD, highlight or clip link. We never record live streams."
)


def _parse_time_hint(url: urllib.parse.ParseResult) -> int | None:
    q = urllib.parse.parse_qs(url.query)
    t = (q.get("t") or [None])[0]
    if not t:
        return None
    m = re.match(r"^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$", t, re.I)
    if m:
        h, mi, s = int(m.group(1) or 0), int(m.group(2) or 0), int(m.group(3) or 0)
        return h * 3600 + mi * 60 + s
    if t.isdigit():
        return int(t)
    return None


def parse_stream_url(raw: str) -> dict:
    trimmed = (raw or "").strip()
    if not trimmed:
        return {"error": "unsupported"}
    try:
        url = urllib.parse.urlparse(trimmed if trimmed.startswith("http") else f"https://{trimmed}")
    except Exception:
        return {"error": "unsupported"}

    host = (url.hostname or "").lower().replace("www.", "").replace("m.", "")
    start_hint_s = _parse_time_hint(url)
    path = url.path.rstrip("/")
    parts = [p for p in path.split("/") if p]

    if host == "clips.twitch.tv" and parts:
        out = {"platform": "twitch", "kind": "clip", "id": parts[0]}
        if start_hint_s is not None:
            out["startHintS"] = start_hint_s
        return out

    if host == "twitch.tv":
        if parts[:1] == ["videos"] and len(parts) >= 2 and parts[1].isdigit():
            out = {"platform": "twitch", "kind": "vod", "id": parts[1]}
            if start_hint_s is not None:
                out["startHintS"] = start_hint_s
            return out
        if len(parts) == 3 and parts[1] == "video" and parts[2].isdigit():
            out = {"platform": "twitch", "kind": "vod", "id": parts[2], "channel": parts[0]}
            if start_hint_s is not None:
                out["startHintS"] = start_hint_s
            return out
        if len(parts) == 3 and parts[1] == "clip":
            out = {"platform": "twitch", "kind": "clip", "id": parts[2], "channel": parts[0]}
            if start_hint_s is not None:
                out["startHintS"] = start_hint_s
            return out
        if len(parts) == 1 and parts[0] not in ("directory", "downloads"):
            return {"error": BARE_CHANNEL_MSG}

    if host == "kick.com":
        clip_param = urllib.parse.parse_qs(url.query).get("clip", [None])[0]
        if len(parts) == 1 and clip_param:
            out = {"platform": "kick", "kind": "clip", "id": clip_param, "channel": parts[0]}
            if start_hint_s is not None:
                out["startHintS"] = start_hint_s
            return out
        if len(parts) == 3 and parts[1] == "clips":
            out = {"platform": "kick", "kind": "clip", "id": parts[2], "channel": parts[0]}
            if start_hint_s is not None:
                out["startHintS"] = start_hint_s
            return out
        if len(parts) == 3 and parts[1] == "videos":
            out = {"platform": "kick", "kind": "vod", "id": parts[2], "channel": parts[0]}
            if start_hint_s is not None:
                out["startHintS"] = start_hint_s
            return out
        if parts[:1] == ["video"] and len(parts) >= 2:
            out = {"platform": "kick", "kind": "vod", "id": parts[1]}
            if start_hint_s is not None:
                out["startHintS"] = start_hint_s
            return out
        if len(parts) == 1:
            return {"error": BARE_CHANNEL_MSG}

    return {"error": "unsupported"}
