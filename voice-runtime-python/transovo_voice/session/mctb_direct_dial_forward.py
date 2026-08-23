"""MCTB direct dial forward — connect caller to configured business number."""

from __future__ import annotations

import os
from typing import TYPE_CHECKING, Any

from livekit.agents.beta.workflows import WarmTransferTask
from livekit.agents.llm.tool_context import ToolError

from transovo_voice.templates.template_context import deliver_scripted_speech
from transovo_voice.telemetry import log_event

if TYPE_CHECKING:
    from livekit.agents import AgentSession, JobContext
    from livekit import rtc
    from transovo_voice.integrations.backend_client import TransovoBackend
    from transovo_voice.session.mctb_sip_e2e_trace import MctbSipE2eTrace

LOG_SOURCE = "mctb-direct-dial-forward"


async def run_mctb_direct_dial_forward(
    backend: "TransovoBackend",
    *,
    ctx: "JobContext",
    trace: "MctbSipE2eTrace",
    participant: "rtc.RemoteParticipant",
    answer_session: "AgentSession",
    session: dict[str, Any],
) -> bool:
    destination = str(session.get("directDialForwardE164") or "").strip()
    workspace_id = str(session.get("workspaceId") or "").strip()
    if not destination or not workspace_id:
        trace.log("mctb_direct_dial_forward_skipped", reason="missing_destination_or_workspace")
        return False

    resolution = await backend.call(
        "resolve_mctb_direct_dial_transfer",
        {
            "workspaceId": workspace_id,
            "destinationE164": destination,
            "callerNumberE164": trace.to_e164,
        },
    )
    if not resolution.get("ok"):
        trace.log(
            "mctb_direct_dial_forward_failed",
            reason="resolve_failed",
            error=resolution.get("error"),
        )
        return False

    sip_trunk_id = (
        str(resolution.get("sipOutboundTrunkId") or "").strip()
        or os.getenv("LIVEKIT_SIP_OUTBOUND_TRUNK", "").strip()
    )
    sip_number = (
        str(resolution.get("sipCallerIdE164") or "").strip()
        or os.getenv("LIVEKIT_SIP_NUMBER", "").strip()
        or None
    )
    forward_to = str(resolution.get("destinationE164") or destination).strip()

    if not sip_trunk_id:
        trace.log("mctb_direct_dial_forward_failed", reason="missing_sip_trunk")
        return False

    prompt = str(session.get("directDialPromptText") or "").strip()
    if prompt:
        await deliver_scripted_speech(
            answer_session,
            prompt,
            allow_interruptions=False,
        )

    log_event(
        "mctb_direct_dial_forward_started",
        call_id=trace.correlation_id,
        workspace_id=workspace_id,
        extra={"destination": forward_to},
    )

    try:
        result = await WarmTransferTask(
            sip_call_to=forward_to,
            sip_trunk_id=sip_trunk_id,
            sip_number=sip_number,
            chat_ctx=answer_session.history,
            extra_instructions="Connect the caller to the business line.",
        )
    except ToolError as err:
        trace.log(
            "mctb_direct_dial_forward_failed",
            error=str(err),
            destination=forward_to,
        )
        return False

    trace.log(
        "mctb_direct_dial_forward_complete",
        destination=forward_to,
        supervisor=result.human_agent_identity,
        participantIdentity=participant.identity,
    )
    log_event(
        "mctb_direct_dial_forward_complete",
        call_id=trace.correlation_id,
        workspace_id=workspace_id,
        extra={"destination": forward_to, "supervisor": result.human_agent_identity},
    )
    return True
