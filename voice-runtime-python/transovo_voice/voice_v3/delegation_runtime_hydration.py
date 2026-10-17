from __future__ import annotations

import asyncio
import logging
from typing import Any

from transovo_voice.voice_v3.live_context_hydration import apply_live_context_events
from transovo_voice.voice_v3.tool_client import TransovoV3ToolClient

logger = logging.getLogger("transovo-voice.voice_v3.delegation_runtime_hydration")


def attach_voice_v3_delegation_runtime_hydration(
    *,
    duplex_session: Any,
    tool_client: TransovoV3ToolClient,
) -> None:
    """Golden-era parity: hydrate authoritative runtime on every delegation (LiveKit path)."""

    async def _hydrate(delegation_id: str | None) -> None:
        try:
            payload = await tool_client.fetch_delegation_runtime_context(delegation_id)
            events = payload.get("liveContextEvents") if isinstance(payload, dict) else None
            if not isinstance(events, list):
                return
            applied = apply_live_context_events(
                [e for e in events if isinstance(e, dict)],
                duplex_session=duplex_session,
            )
            if applied:
                logger.info(
                    "voice_v3_delegation_runtime_hydrated applied=%s delegation_id=%s",
                    applied,
                    delegation_id,
                )
        except Exception:
            logger.exception("voice_v3_delegation_runtime_hydration_failed")

    def _on_server(raw: dict[str, Any]) -> None:
        if not isinstance(raw, dict) or raw.get("type") != "session.delegation.created":
            return
        delegation_id = raw.get("delegation_id") or raw.get("id")
        deleg = str(delegation_id).strip() if delegation_id else None
        asyncio.create_task(_hydrate(deleg))

    duplex_session.on("openai_server_event_received", _on_server)
