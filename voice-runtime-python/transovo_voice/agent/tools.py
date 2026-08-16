from __future__ import annotations

from typing import TYPE_CHECKING

from livekit.agents import llm
from livekit.agents.beta.tools.end_call import EndCallTool
from livekit.agents.llm.tool_context import function_tool
from livekit.agents.voice.events import RunContext

from transovo_voice.integrations.backend_client import TransovoBackend
from transovo_voice.telemetry import log_event
from transovo_voice.userdata import SessionUserData, WorkflowState
from transovo_voice.workflows.booking_flow import fetch_availability_for_session
from transovo_voice.workflows.booking_intake_task import BookingIntakeTask

if TYPE_CHECKING:
    from transovo_voice.agent.amy import AmyAgent


def _end_call_toolset() -> EndCallTool:
    return EndCallTool(
        delete_room=True,
        end_instructions="Thank the caller warmly and say goodbye.",
    )


def _shared_conversation_tools(agent: AmyAgent, backend: TransovoBackend) -> list:
    ud = agent._ud

    @function_tool(name="take_message", description="Start message intake for a callback.")
    async def take_message(context: RunContext) -> str:
        ud.workflow = WorkflowState.MESSAGE_INTAKE
        result = await BookingIntakeTask(
            backend=backend,
            purpose="message",
            chat_ctx=context.session.history,
        )
        if not result.complete:
            return "Still need callback details for the message."
        ud.workflow = WorkflowState.MESSAGE_COMMIT
        return "Message details collected. Summarize the reason and acknowledge the message will be passed along."

    @function_tool(
        name="get_business_answer",
        description="Look up business knowledge for FAQ questions.",
    )
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

    return [take_message, get_business_answer, _end_call_toolset()]


def build_idle_tools(agent: AmyAgent, backend: TransovoBackend) -> list:
    """Tools available before booking intake begins."""
    ud = agent._ud

    @function_tool(
        name="start_booking",
        description="Start booking intake when the caller wants an appointment.",
    )
    async def start_booking(context: RunContext) -> str:
        log_event(
            "intent_selected",
            call_id=ud.call_id,
            workspace_id=ud.workspace_id,
            agent_id=ud.agent_id,
            workflow="BOOKING",
            extra={"intent": "booking"},
        )
        result = await BookingIntakeTask(
            backend=backend,
            purpose="booking",
            chat_ctx=context.session.history,
        )
        if not result.complete:
            return "Intake incomplete — continue collecting required fields."
        await agent.expose_booking_tools()
        return (
            "Required details collected. Call check_availability to load open appointment times."
        )

    return [start_booking, *_shared_conversation_tools(agent, backend)]


def build_booking_tools(agent: AmyAgent, backend: TransovoBackend) -> list:
    """Tools after booking intake is complete."""
    ud = agent._ud

    @function_tool(
        name="check_availability",
        description="Load open appointment times after intake is complete.",
    )
    async def check_availability() -> str:
        ok, message = await fetch_availability_for_session(backend, ud)
        return message if ok else message

    @function_tool(name="select_slot", description="Record the caller's chosen appointment slot id.")
    async def select_slot(slot_id: str) -> str:
        offered = {s.slot_id for s in ud.offered_slots}
        if slot_id not in offered:
            return "That time wasn't in the offered list. Ask them to pick from the times you offered."
        ud.selected_slot_id = slot_id
        ud.workflow = WorkflowState.BOOKING_CONFIRM
        label = next((s.spoken_label for s in ud.offered_slots if s.slot_id == slot_id), slot_id)
        log_event(
            "slot_selected",
            call_id=ud.call_id,
            workspace_id=ud.workspace_id,
            agent_id=ud.agent_id,
            workflow=ud.workflow.value,
            extra={"slotId": slot_id},
        )
        return f"Confirm the exact time with the caller before booking: {label}"

    @function_tool(
        name="confirm_booking",
        description="Commit booking after explicit caller confirmation.",
    )
    async def confirm_booking(context: RunContext) -> str:
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
        if commit.get("receiptPersisted"):
            log_event(
                "receipt_persisted",
                call_id=ud.call_id,
                workspace_id=ud.workspace_id,
                agent_id=ud.agent_id,
                workflow=ud.workflow.value,
                extra={"slotId": ud.selected_slot_id},
            )
        context.disallow_interruptions()
        await context.session.say(speech)
        await agent.expose_idle_tools()
        return (
            "BOOKING_CONFIRMED_ALREADY_SPOKEN: Confirmation was played to the caller. "
            "Do not speak again or add commentary."
        )

    return [
        check_availability,
        select_slot,
        confirm_booking,
        *_shared_conversation_tools(agent, backend),
    ]


def build_amy_tools(agent: AmyAgent, backend: TransovoBackend) -> list[llm.FunctionTool | llm.Toolset]:
    return build_idle_tools(agent, backend)
