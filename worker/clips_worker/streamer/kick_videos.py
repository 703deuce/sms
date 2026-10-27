"""Kick channel replay list (undocumented v2 API + yt-dlp fallback)."""
from __future__ import annotations

import json
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any


def _parse_kick_time(raw: str) -> datetime | None:
    s = (raw or "").strip()
    if not s:
        return None
    if "T" in s:
        try:
            return datetime.fromisoformat(s.replace("Z", "+00:00"))
        except ValueError:
            pass
    try:
        return datetime.strptime(s, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def fetch_kick_channel_videos(slug: str, timeout_s: int = 30) -> list[dict[str, Any]]:
    url = f"https://kick.com/api/v2/channels/{slug}/videos"
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:
            data = json.loads(resp.read())
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError, TimeoutError):
        return []
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ("videos", "data"):
            inner = data.get(key)
            if isinstance(inner, list):
                return inner
    return []


def normalize_kick_video_entry(ent: dict[str, Any], slug: str) -> dict[str, Any] | None:
    video = ent.get("video") if isinstance(ent.get("video"), dict) else {}
    uuid = video.get("uuid") or ent.get("uuid")
    if not uuid:
        return None
    start_raw = ent.get("start_time") or ent.get("created_at") or video.get("created_at")
    start_dt = _parse_kick_time(str(start_raw or ""))
    dur_raw = ent.get("duration")
    duration_s = 0.0
    if dur_raw is not None:
        try:
            d = float(dur_raw)
            duration_s = d / 1000.0 if d > 100_000 else d
        except (TypeError, ValueError):
            duration_s = 0.0
    title = ent.get("session_title") or ent.get("title") or video.get("title")
    page = f"https://kick.com/{slug}/videos/{uuid}"
    return {
        "url": page,
        "webpage_url": page,
        "title": title,
        "id": str(uuid),
        "video_id": str(uuid),
        "start_time": start_dt.timestamp() if start_dt else None,
        "duration": duration_s,
        "duration_s": duration_s,
    }


def match_kick_vod_from_entries(
    entries: list[dict[str, Any]],
    slug: str,
    streamed_at: datetime,
) -> dict[str, Any] | None:
    """Match replay to stream start (webhook `startedAt`), allowing publish delay up to ~90 min after end."""
    if streamed_at.tzinfo is None:
        streamed_at = streamed_at.replace(tzinfo=timezone.utc)
    target = streamed_at.timestamp()
    normalized: list[dict[str, Any]] = []
    for ent in entries:
        row = normalize_kick_video_entry(ent, slug)
        if row and row.get("start_time") is not None:
            normalized.append(row)
    if not normalized:
        return None

    for row in normalized:
        ts = float(row["start_time"])
        if abs(ts - target) <= 15 * 60:
            return row

    # Publish can lag stream end; accept newest replay whose start is within a long session window.
    window_end = target + (6 * 3600) + (90 * 60)
    candidates = [r for r in normalized if target - 5 * 60 <= float(r["start_time"]) <= window_end]
    if not candidates:
        return None
    candidates.sort(key=lambda r: abs(float(r["start_time"]) - target))
    return candidates[0]
