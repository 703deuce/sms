from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING

from livekit.agents import llm
from livekit.agents.llm.tool_context import function_tool

from transovo_voice.integrations.backend_client import TransovoBackend
from transovo_voice.telemetry import log_event
from transovo_voice.userdata import SessionUserData, WorkflowState
from transovo_voice.workflows.booking_intake import run_booking_intake_task_group

if TYPE_CHECKING:
    from livekit.agents.voice.agent_session import AgentSession


def build_amy_tools(session: AgentSession, ud: SessionUserData, backend: TransovoBackend) -> list:
    @function_tool(name="start_booking", description="Start booking intake when the caller wants an appointment.")
    async def start_booking() -> str:
        log_event(
            "intent_selected",
            call_id=ud.call_id,
            workspace_id=ud.workspace_id,
            agent_id=ud.agent_id,
            workflow="BOOKING",
        )
        result = await run_booking_intake_task_group(session, ud, backend, purpose="booking")
        if not result.complete:
            return "Intake incomplete — continue collecting required fields."
        ud.workflow = WorkflowState.BOOKING_AVAILABILITY
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
            return "I couldn't check the calendar right now. Offer to take a message."
        from transovo_voice.userdata import OfferedSlot

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
            "slots_offered",
            call_id=ud.call_id,
            workspace_id=ud.workspace_id,
            agent_id=ud.agent_id,
            workflow=ud.workflow.value,
            extra={"count": len(ud.offered_slots)},
        )
        return (
            "Required details collected. Offer up to three of these times and ask which works:\n"
            + lines
        )

    @function_tool(name="select_slot", description="Record the caller's chosen appointment slot id.")
    async def select_slot(slot_id: str) -> str:
        offered = {s.slot_id for s in ud.offered_slots}
        if slot_id not in offered:
            return "That time wasn't in the offered list. Ask them to pick from the times you offered."
        ud.selected_slot_id = slot_id
        ud.workflow = WorkflowState.BOOKING_CONFIRM
        label = next((s.spoken_label for s in ud.offered_slots if s.slot_id == slot_id), slot_id)
        return f"Confirm the exact time with the caller before booking: {label}"

    @function_tool(name="confirm_booking", description="Commit booking after explicit caller confirmation.")
    async def confirm_booking() -> str:
        if not ud.selected_slot_id:
            return "No slot selected yet."
        ud.workflow = WorkflowState.BOOKING_COMMIT
        log_event(
            "booking_write_started",
            call_id=ud.call_id,
            workspace_id=ud.workspace_id,
            agent_id=ud.agent_id,
            workflow=ud.workflow.value,
            extra={"slotId": ud.selected_slot_id},
        )
        commit = await backend.call(
            "commit_booking",
            {
                "workspaceId": ud.workspace_id,
                "agentId": ud.agent_id,
                "callId": ud.call_id,
                "slotId": ud.selected_slot_id,
                "timezone": ud.timezone,
                "businessName": ud.business_name,
                "callerE164": ud.caller_e164,
                "fields": ud.collected_fields,
                "eventTypeUri": ud.event_type_uri,
                "offeredSlotIds": [s.slot_id for s in ud.offered_slots],
            },
        )
        if not commit.get("ok"):
            ud.workflow = WorkflowState.BOOKING_FAILED
            log_event(
                "booking_write_failed",
                call_id=ud.call_id,
                workspace_id=ud.workspace_id,
                agent_id=ud.agent_id,
                workflow=ud.workflow.value,
                extra={"error": commit.get("error")},
            )
            return commit.get("error") or "Booking failed."
        ud.booking_confirmed = True
        ud.booked_time_label = commit.get("bookedTimeLabel")
        ud.workflow = WorkflowState.BOOKING_DONE
        speech = commit.get("confirmationSpeech") or "You're all set."
        log_event(
            "booking_write_succeeded",
            call_id=ud.call_id,
            workspace_id=ud.workspace_id,
            agent_id=ud.agent_id,
            workflow=ud.workflow.value,
        )
        await session.say(speech)
        return "Booking complete."

    @function_tool(name="get_business_answer", description="Look up business knowledge for FAQ questions.")
    async def get_business_answer(topic: str) -> str:
        ud.workflow = WorkflowState.FAQ
        result = await backend.call(
            "business_answer",
            {
                "workspaceId": ud.workspace_id,
                "agentId": ud.agent_id,
                "topic": topic,
            },
        )
        if not result.get("ok"):
            return result.get("error") or "I couldn't find that information."
        return result.get("speak") or ""

    @function_tool(name="take_message", description="Start message intake when caller wants to leave a message.")
    async def take_message() -> str:
        ud.workflow = WorkflowState.MESSAGE_INTAKE
        result = await run_booking_intake_task_group(session, ud, backend, purpose="message")
        if not result.complete:
            return "Still need callback details for the message."
        ud.workflow = WorkflowState.MESSAGE_COMMIT
        return "Message details collected. Summarize the reason and acknowledge the message will be passed along."

    return [start_booking, select_slot, confirm_booking, get_business_answer, take_message]
