"""Load live-captured chat lines for a VOD window (S13)."""
from __future__ import annotations

from datetime import datetime, timedelta


def fetch_live_chat_messages(conn, channel_id: str, start_ms: int, end_ms: int) -> list[dict]:
    if not channel_id:
        return []
    start = datetime.utcfromtimestamp(start_ms / 1000.0)
    end = datetime.utcfromtimestamp(end_ms / 1000.0)
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT at, "user", color, text
            FROM stream_chat_lines
            WHERE "channelId" = %s AND at >= %s AND at <= %s
            ORDER BY at ASC
            LIMIT 50000
            """,
            (channel_id, start - timedelta(seconds=5), end),
        )
        rows = cur.fetchall()
    out: list[dict] = []
    for at, user, color, text in rows:
        t_ms = int(at.timestamp() * 1000)
        out.append({"tMs": t_ms, "user": user, "color": color or "#FFFFFF", "text": text})
    return out
