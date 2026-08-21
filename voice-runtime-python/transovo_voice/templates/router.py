from __future__ import annotations

from livekit.agents import JobContext

from transovo_voice.integrations.backend_client import TransovoBackend
from transovo_voice.telemetry import log_event
from transovo_voice.templates.basic_voice import run_basic_voice_template
from transovo_voice.templates.frontdesk_booking import run_frontdesk_booking_template
from transovo_voice.templates.registry import resolve_template_id
from transovo_voice.templates.transovo_receptionist import (
    run_transovo_receptionist_template,
    run_warm_transfer_template,
)
from transovo_voice.userdata import SessionUserData


async def run_template(
    ctx: JobContext,
    ud: SessionUserData,
    backend: TransovoBackend,
    *,
    template_id: str,
) -> None:
    resolved = resolve_template_id(template_id, production=template_id.startswith("transovo_"))
    log_event(
        "agent_template_started",
        call_id=ud.call_id,
        workspace_id=ud.workspace_id,
        agent_id=ud.agent_id,
        room=ctx.room.name,
        extra={
            "runtime": "livekit_python",
            "agent_template": resolved,
            "agent_template_version": "1",
            "receptionist_id": ud.agent_id,
        },
    )

    if resolved == "livekit_basic_voice":
        await run_basic_voice_template(ctx, ud)
        return
    if resolved == "livekit_frontdesk_booking":
        await run_frontdesk_booking_template(ctx, ud)
        return
    if resolved == "livekit_warm_transfer":
        await run_warm_transfer_template(ctx, ud, backend)
        return
    if resolved == "transovo_receptionist_v1":
        await run_transovo_receptionist_template(ctx, ud, backend)
        return

    raise RuntimeError(f"Template {resolved} is catalogued but not implemented yet")
