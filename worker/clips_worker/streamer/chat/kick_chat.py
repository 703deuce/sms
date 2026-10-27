"""Kick VOD chat replay — best-effort public API; degrade gracefully (S5)."""
from __future__ import annotations

import json
import random
import re
import time
import urllib.error
import urllib.request
from datetime import datetime
from typing import Any

from clips_worker.streamer.errors import RetryableError

_KICK_VIDEO_UUID = re.compile(
    r"kick\.com/[^/]+/videos/([0-9a-f-]{36})",
    re.I,
)


def _parse_kick_vod(url: str | None, external_id: str | None) -> tuple[str | None, str | None]:
    slug: str | None = None
    vid = (external_id or "").strip() or None
    if url:
        m = _KICK_VIDEO_UUID.search(url)
        if m:
            vid = vid or m.group(1)
        parts = url.replace("https://", "").replace("http://", "").split("/")
        try:
            idx = parts.index("kick.com")
            if len(parts) > idx + 1:
                slug = parts[idx + 1]
        except ValueError:
            pass
    return slug, vid


def _get_json(url: str, timeout: float = 45.0) -> Any | None:
    backoff = 1.0
    for attempt in range(6):
        try:
            time.sleep(0.2 + random.random() * 0.15)
            req = urllib.request.Request(
                url,
                headers={
                    "Accept": "application/json",
                    "User-Agent": "TransovoClipper/1.0 (+https://transovo.ai)",
                },
                method="GET",
            )
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                if resp.status == 429 or resp.status >= 500:
                    raise RetryableError(f"kick http {resp.status}")
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            if exc.code in (404, 403, 410):
                return None
            if exc.code == 429 or exc.code >= 500:
                time.sleep(backoff)
                backoff = min(backoff * 2, 30.0)
                continue
            return None
        except RetryableError:
            time.sleep(backoff)
            backoff = min(backoff * 2, 30.0)
        except Exception:
            return None
    return None


def _stream_start_ts(vod: dict) -> float | None:
    streamed_at = vod.get("streamedAt")
    if not streamed_at:
        return None
    if isinstance(streamed_at, str):
        try:
            return datetime.fromisoformat(streamed_at.replace("Z", "+00:00")).timestamp()
        except ValueError:
            return None
    if hasattr(streamed_at, "timestamp"):
        return float(streamed_at.timestamp())
    return None


def _parse_kick_messages(payload: Any, stream_start: float | None) -> list[dict]:
    rows = payload
    if isinstance(payload, dict):
        rows = payload.get("data") or payload.get("messages") or payload.get("items") or []
    if not isinstance(rows, list):
        return []
    out: list[dict] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        text = str(row.get("content") or row.get("message") or row.get("text") or "").strip()
        if not text:
            continue
        user = ""
        sender = row.get("sender") or row.get("user") or {}
        if isinstance(sender, dict):
            user = str(sender.get("username") or sender.get("slug") or sender.get("name") or "")
        t_s = row.get("time_in_seconds")
        if t_s is None and stream_start is not None:
            created = row.get("created_at") or row.get("createdAt")
            if isinstance(created, str):
                try:
                    ts = datetime.fromisoformat(created.replace("Z", "+00:00")).timestamp()
                    t_s = max(0, int(ts - stream_start))
                except ValueError:
                    t_s = 0
        try:
            t_val = int(float(t_s or 0))
        except (TypeError, ValueError):
            t_val = 0
        out.append({"t_s": t_val, "user": user, "text": text})
    return out


def fetch_kick_vod_chat(vod: dict) -> list[dict] | None:
    """
    Best-effort Kick replay chat (undocumented public endpoints).
    Returns None when unavailable so analyze continues on audio-only signals.
    """
    url = vod.get("url")
    external_id = vod.get("externalId") or vod.get("external_id")
    slug, vid = _parse_kick_vod(str(url or ""), str(external_id) if external_id else None)
    if not slug or not vid:
        return None

    meta = _get_json(f"https://kick.com/api/v2/channels/{slug}/videos/{vid}")
    if not isinstance(meta, dict):
        return None

    livestream = meta.get("livestream") if isinstance(meta.get("livestream"), dict) else meta
    chatroom_id = (
        meta.get("chatroom_id")
        or meta.get("chatroomId")
        or (livestream or {}).get("chatroom_id")
        or (livestream or {}).get("id")
    )
    stream_start = _stream_start_ts(vod)

    messages: list[dict] = []
    if chatroom_id:
        page = 1
        while page <= 40 and len(messages) < 300_000:
            page_url = f"https://web.kick.com/api/v1/chatrooms/{chatroom_id}/messages?page={page}"
            payload = _get_json(page_url)
            if payload is None:
                break
            batch = _parse_kick_messages(payload, stream_start)
            if not batch:
                break
            messages.extend(batch)
            if isinstance(payload, dict):
                meta_page = payload.get("meta") or {}
                if not meta_page.get("next_page") and len(batch) < 50:
                    break
            page += 1

    if messages:
        return messages

    # Fallback: channel messages filtered to VOD window when API exposes stream window on meta.
    start_s = meta.get("start_time") or meta.get("startTime")
    end_s = meta.get("end_time") or meta.get("endTime")
    if start_s is not None and end_s is not None:
        alt = _get_json(
            f"https://kick.com/api/v2/channels/{slug}/messages?start_time={start_s}&end_time={end_s}"
        )
        parsed = _parse_kick_messages(alt, stream_start)
        if parsed:
            return parsed

    return None
