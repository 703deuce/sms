"""LiveKit room helpers."""

from __future__ import annotations

import asyncio
from typing import Any


async def resolve_room_sid(room: Any) -> str | None:
    """Room.sid is async in current livekit-rtc — always await it."""
    try:
        sid = room.sid
        if asyncio.iscoroutine(sid):
            sid = await sid
        return str(sid) if sid else None
    except Exception:
        return None
