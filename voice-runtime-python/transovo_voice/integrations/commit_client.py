from __future__ import annotations

import asyncio
import logging
from typing import Any

from transovo_voice.integrations.backend_client import TransovoBackend
from transovo_voice.userdata import SessionUserData

logger = logging.getLogger("transovo-voice.commit")


async def commit_booking_resilient(
    backend: TransovoBackend,
    ud: SessionUserData,
    payload: dict[str, Any],
) -> dict[str, Any]:
    """
    Await backend commit and keep the HTTP task alive through job shutdown.

    The calendar write runs entirely in transovo-web; once the HTTP request is
    accepted, disconnecting the voice session must not cancel the provider write.
    """
    task = asyncio.create_task(backend.call("commit_booking", payload))
    ud.pending_provider_tasks.append(task)
    try:
        return await task
    finally:
        if task in ud.pending_provider_tasks:
            ud.pending_provider_tasks.remove(task)


async def drain_pending_provider_tasks(ud: SessionUserData) -> None:
    pending = [t for t in ud.pending_provider_tasks if not t.done()]
    if not pending:
        return
    logger.info(
        "draining %d pending provider task(s) callId=%s",
        len(pending),
        ud.call_id,
    )
    await asyncio.gather(*pending, return_exceptions=True)
