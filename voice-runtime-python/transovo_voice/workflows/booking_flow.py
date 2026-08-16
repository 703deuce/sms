from __future__ import annotations

from transovo_voice.integrations.backend_client import TransovoBackend
from transovo_voice.telemetry import log_event
from transovo_voice.userdata import OfferedSlot, SessionUserData, WorkflowState


async def fetch_availability_for_session(
    backend: TransovoBackend,
    ud: SessionUserData,
) -> tuple[bool, str]:
    """Load Calendly slots from backend and stage them on userdata. Returns (ok, tool_message)."""
    ud.workflow = WorkflowState.BOOKING_AVAILABILITY
    log_event(
        "availability_started",
        call_id=ud.call_id,
        workspace_id=ud.workspace_id,
        agent_id=ud.agent_id,
        workflow=ud.workflow.value,
    )
    availability = await backend.call(
        "get_availability",
        {
            "workspaceId": ud.workspace_id,
            "agentId": ud.agent_id,
            "callId": ud.call_id,
            "timezone": ud.timezone,
            "eventTypeUri": ud.event_type_uri,
        },
    )
    if not availability.get("ok"):
        log_event(
            "availability_failed",
            call_id=ud.call_id,
            workspace_id=ud.workspace_id,
            agent_id=ud.agent_id,
            workflow=ud.workflow.value,
            extra={"error": availability.get("error")},
        )
        return False, "I couldn't check the calendar right now. Offer to take a message."

    ud.offered_slots = [
        OfferedSlot(
            slot_id=s["slotId"],
            start_time_iso=s["startTimeIso"],
            duration_min=s["durationMin"],
            spoken_label=s.get("spokenLabel") or s["slotId"],
        )
        for s in availability.get("slots") or []
    ]
    ud.workflow = WorkflowState.BOOKING_SELECT
    lines = availability.get("linesForModel") or "No slots available."
    log_event(
        "availability_succeeded",
        call_id=ud.call_id,
        workspace_id=ud.workspace_id,
        agent_id=ud.agent_id,
        workflow=ud.workflow.value,
        extra={"count": len(ud.offered_slots)},
    )
    log_event(
        "slots_offered",
        call_id=ud.call_id,
        workspace_id=ud.workspace_id,
        agent_id=ud.agent_id,
        workflow=ud.workflow.value,
        extra={"count": len(ud.offered_slots)},
    )
    return True, (
        "Offer up to three of these times and ask which works:\n" + lines
    )
