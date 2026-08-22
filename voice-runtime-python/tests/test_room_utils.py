"""Tests for room sid resolution."""

from __future__ import annotations

import asyncio

from transovo_voice.session.room_utils import resolve_room_sid


class _AsyncSidRoom:
  @property
  async def sid(self) -> str:
    return "RM_test123"


class _SyncSidRoom:
  sid = "RM_sync456"


async def test_resolve_room_sid_awaits_async_property():
    sid = await resolve_room_sid(_AsyncSidRoom())
    assert sid == "RM_test123"


async def test_resolve_room_sid_times_out_when_unavailable():
    class _HangingSid:
        @property
        async def sid(self) -> str:
            await asyncio.sleep(5)
            return "RM_never"

    sid = await resolve_room_sid(_HangingSid(), timeout_s=0.05)
    assert sid is None
