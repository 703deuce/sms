from __future__ import annotations

import asyncio
import logging
import os
from typing import Any

from livekit.agents.beta.workflows import WarmTransferTask
from livekit.agents.llm.tool_context import ToolError, function_tool
from livekit.agents.voice.events import RunContext

from transovo_voice.integrations.backend_client import TransovoBackend
from transovo_voice.telemetry import log_event
from transovo_voice.userdata import SessionUserData, WorkflowState

logger = logging.getLogger("transovo-voice.transfer")

_TRANSFER_SUMMARY = (
    "Summarize who the caller is, why they called, and why a human is needed now. "
    "Keep it under 200 characters from the assistant's perspective."
)


def build_transfer_tool(
    ud: SessionUserData,
    backend: TransovoBackend,
) -> Any | None:
    if not ud.can_transfer():
        return None

    @function_tool(
        name="transfer_to_human",
        description=(
            "Transfer to a human after the caller confirms they want to speak with someone."
        ),
    )
    async def transfer_to_human(context: RunContext, reason: str = "") -> str:
        ud.workflow = WorkflowState.TRANSFER
        resolution = await backend.call(
            "resolve_transfer",
            {
                "workspaceId": ud.workspace_id,
                "agentId": ud.agent_id,
                "callId": ud.call_id,
                "reason": reason,
                "transferPolicy": ud.transfer_policy_dict(),
            },
        )
        if not resolution.get("ok"):
            return resolution.get("error") or "Transfer lookup failed."

        if not resolution.get("allowed") or not resolution.get("destinationE164"):
            take_message = resolution.get("takeMessageOnFailure", True)
            log_event(
                "transfer_failed",
                call_id=ud.call_id,
                workspace_id=ud.workspace_id,
                agent_id=ud.agent_id,
                workflow=ud.workflow.value,
                extra={"reason": "no_destination"},
            )
            if take_message:
                return "Transfer isn't available. Offer to take a message for the team."
            return "Transfer isn't available right now."

        if resolution.get("warmTransfer") is False:
            return (
                "Blind transfer is not implemented in the Python runtime yet. "
                "Offer to take a message or try again later."
            )

        sip_trunk_id = (
            (ud.sip_outbound_trunk_id or "").strip()
            or os.getenv("LIVEKIT_SIP_OUTBOUND_TRUNK", "").strip()
        )
        sip_number = (
            (ud.sip_caller_id_e164 or "").strip()
            or os.getenv("LIVEKIT_SIP_NUMBER", "").strip()
            or None
        )
        if not sip_trunk_id:
            log_event(
                "transfer_failed",
                call_id=ud.call_id,
                workspace_id=ud.workspace_id,
                agent_id=ud.agent_id,
                workflow=ud.workflow.value,
                extra={"reason": "missing_sip_trunk"},
            )
            return (
                "Transfer is not configured (missing SIP outbound trunk). "
                "Offer to take a message for the team."
            )

        destination = str(resolution["destinationE164"])
        log_event(
            "transfer_started",
            call_id=ud.call_id,
            workspace_id=ud.workspace_id,
            agent_id=ud.agent_id,
            workflow=ud.workflow.value,
            extra={"destination": destination},
        )

        await context.session.say(
            "Please hold while I connect you with someone who can help.",
            allow_interruptions=False,
        )

        try:
            result = await WarmTransferTask(
                sip_call_to=destination,
                sip_trunk_id=sip_trunk_id,
                sip_number=sip_number,
                chat_ctx=context.session.history,
                extra_instructions=_TRANSFER_SUMMARY,
            )
        except ToolError as err:
            log_event(
                "transfer_failed",
                call_id=ud.call_id,
                workspace_id=ud.workspace_id,
                agent_id=ud.agent_id,
                workflow=ud.workflow.value,
                extra={"error": str(err)},
            )
            take_message = resolution.get("takeMessageOnFailure", True)
            if take_message:
                return f"Transfer failed ({err}). Offer to take a message."
            raise

        log_event(
            "transfer_succeeded",
            call_id=ud.call_id,
            workspace_id=ud.workspace_id,
            agent_id=ud.agent_id,
            workflow=ud.workflow.value,
            extra={"supervisor": result.human_agent_identity},
        )
        await context.session.say(
            "You're now connected with my colleague. I'll hang up now.",
            allow_interruptions=False,
        )
        context.session.shutdown()
        return "Transfer complete — session ending."

    return transfer_to_human
