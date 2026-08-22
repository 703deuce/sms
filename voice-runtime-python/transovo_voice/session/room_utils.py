"""LiveKit room helpers."""

from __future__ import annotations

import asyncio
from typing import Any


async def resolve_room_sid(room: Any, *, timeout_s: float = 2.0) -> str | None:
    """
    Resolve Room.sid after the room connection exists.

  Must NOT be called before ctx.connect() — awaiting sid on a disconnected room
    can block indefinitely and prevent the worker from answering within 10s.
    """
    async def _resolve() -> str | None:
        sid = room.sid
        if asyncio.iscoroutine(sid):
            sid = await sid
        return str(sid) if sid else None

    try:
        return await asyncio.wait_for(_resolve(), timeout=timeout_s)
    except (asyncio.TimeoutError, Exception):
        return None
