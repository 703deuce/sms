"""Logical stream session stitching across platform VOD splits (≤10 min gap)."""
from __future__ import annotations

import os
from datetime import datetime, timezone


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, str(default)))
    except ValueError:
        return default


SESSION_GAP_MAX_S = _int_env("STREAM_SESSION_GAP_MAX_S", 600)


def _to_dt(value: datetime | str | None) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def gap_seconds(previous_end: datetime | str | None, next_start: datetime | str | None) -> float | None:
    a = _to_dt(previous_end)
    b = _to_dt(next_start)
    if not a or not b:
        return None
    return (b - a).total_seconds()


def should_merge_stream_segments(
    previous_end: datetime | str | None,
    next_start: datetime | str | None,
    *,
    gap_max_s: int | None = None,
) -> bool:
    """True when offline/restart gap is within marathon session window (default 10 min)."""
    g = gap_seconds(previous_end, next_start)
    if g is None:
        return False
    limit = gap_max_s if gap_max_s is not None else SESSION_GAP_MAX_S
    return 0 <= g <= limit


def log_session_merge(channel_id: str, gap_s: float, session_id: str) -> None:
    print(
        f"[clipper:stream] marathon_session_merge channelId={channel_id} "
        f"gapS={gap_s:.0f} sessionId={session_id}",
        flush=True,
    )
