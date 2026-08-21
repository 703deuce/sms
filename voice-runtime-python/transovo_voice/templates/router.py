from __future__ import annotations

import os

from livekit.agents import JobContext

from transovo_voice.integrations.backend_client import TransovoBackend
from transovo_voice.observability.call_metrics import CallObservability
from transovo_voice.telemetry import log_event
from transovo_voice.templates.basic_voice import run_basic_voice_template
from transovo_voice.templates.frontdesk_booking import run_frontdesk_booking_template
from transovo_voice.templates.hotel_receptionist import run_hotel_receptionist_template
from transovo_voice.templates.knowledge_rag import run_knowledge_rag_template
from transovo_voice.templates.registry import (
    AGENT_TEMPLATE_VERSION,
    COMPOSED_RECEPTIONIST_TEMPLATE,
    composed_receptionist_allowed,
    resolve_template_id,
    template_runtime_status,
)
from transovo_voice.templates.structured_intake import run_structured_intake_template
from transovo_voice.templates.transovo_receptionist import (
    run_transovo_receptionist_template,
    run_warm_transfer_template,
)
from transovo_voice.userdata import SessionUserData

WORKER_NAME = os.getenv("LIVEKIT_AGENT_NAME", "transovo-voice-runtime")


async def run_template(
    ctx: JobContext,
    ud: SessionUserData,
    backend: TransovoBackend,
    *,
    template_id: str,
    observability: CallObservability | None = None,
) -> None:
    resolved = resolve_template_id(template_id)
    status = template_runtime_status(resolved)

    if resolved == COMPOSED_RECEPTIONIST_TEMPLATE and not composed_receptionist_allowed():
        log_event(
            "composed_receptionist_blocked",
            call_id=ud.call_id,
            workspace_id=ud.workspace_id,
            agent_id=ud.agent_id,
            room=ctx.room.name,
            extra={"requested": template_id, "fallback": "livekit_basic_voice"},
        )
        resolved = "livekit_basic_voice"

    log_event(
        "agent_template_started",
        call_id=ud.call_id,
        workspace_id=ud.workspace_id,
        agent_id=ud.agent_id,
        room=ctx.room.name,
        extra={
            "runtime": "livekit_python",
            "worker": WORKER_NAME,
            "agent_template": resolved,
            "agent_template_version": AGENT_TEMPLATE_VERSION,
            "agent_template_status": status,
            "receptionist_id": ud.agent_id,
            "requested_template": template_id,
        },
    )

    if resolved == "livekit_basic_voice":
        await run_basic_voice_template(ctx, ud, observability=observability)
        return
    if resolved == "livekit_frontdesk_booking":
        await run_frontdesk_booking_template(ctx, ud, observability=observability)
        return
    if resolved == "livekit_warm_transfer":
        await run_warm_transfer_template(ctx, ud, backend)
        return
    if resolved == "livekit_structured_intake":
        await run_structured_intake_template(ctx, ud)
        return
    if resolved == "livekit_hotel_receptionist":
        await run_hotel_receptionist_template(ctx, ud)
        return
    if resolved == "livekit_knowledge_rag":
        await run_knowledge_rag_template(ctx, ud, backend)
        return
    if resolved == COMPOSED_RECEPTIONIST_TEMPLATE:
        await run_transovo_receptionist_template(ctx, ud, backend)
        return

    raise RuntimeError(f"Template {resolved} is catalogued but not implemented yet")
