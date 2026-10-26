"""Load viewer clip metadata for a StreamVod (S6)."""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

from clips_worker.streamer.viewer_clips.twitch import fetch_clips_for_vod


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def fetch_viewer_clips_for_vod(vod: dict, conn) -> list[dict]:
    platform = str(vod.get("platform") or "").lower()
    if platform == "twitch":
        video_id = vod.get("externalId") or vod.get("external_id")
        if not video_id:
            return []
        broadcaster_id = vod.get("broadcasterId") or _broadcaster_from_channel(conn, vod.get("channelId"))
        streamed_at = vod.get("streamedAt")
        duration_ms = int(vod.get("durationMs") or 0)
        if not broadcaster_id or not streamed_at or duration_ms <= 0:
            return []
        if isinstance(streamed_at, str):
            streamed_at = datetime.fromisoformat(streamed_at.replace("Z", "+00:00"))
        start = streamed_at
        end = streamed_at + timedelta(milliseconds=duration_ms) + timedelta(hours=1)
        return fetch_clips_for_vod(
            broadcaster_id=str(broadcaster_id),
            video_id=str(video_id),
            started_at=_iso(start),
            ended_at=_iso(end),
        )
    if platform == "kick":
        if os.environ.get("KICK_CLIPS_SIGNAL", "").lower() not in ("1", "true", "yes"):
            return []
        from clips_worker.streamer.viewer_clips.kick import fetch_kick_clips_for_vod

        return fetch_kick_clips_for_vod(vod)
    return []


def _broadcaster_from_channel(conn, channel_id: str | None) -> str | None:
    if not channel_id:
        return None
    with conn.cursor() as cur:
        cur.execute('SELECT "externalId" FROM stream_channels WHERE id = %s', (channel_id,))
        row = cur.fetchone()
    return row[0] if row and row[0] else None
