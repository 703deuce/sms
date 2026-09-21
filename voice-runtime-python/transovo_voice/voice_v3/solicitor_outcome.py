from __future__ import annotations

import logging
from dataclasses import dataclass, field

from livekit.agents import function_tool
from livekit.agents.llm.tool_context import ToolFlag

from transovo_voice.telemetry import log_event
from transovo_voice.voice_v3.tool_client import TransovoV3ToolClient

logger = logging.getLogger("transovo-voice.voice_v3.solicitor")


@dataclass
class SolicitorOutcomeState:
    recorded: bool = field(default=False)


async def _record_solicitor_outcome(client: TransovoV3ToolClient, state: SolicitorOutcomeState) -> dict:
    if state.recorded:
        return {"ok": True, "alreadyRecorded": True}
    payload = {
        "liveSessionId": client._ctx.live_session_id,
        "workspaceId": client._ctx.workspace_id,
        "callId": client._ctx.call_id,
    }
    try:
        result = await client._backend.call("record_voice_v3_solicitor_outcome", payload)
        state.recorded = True
        log_event(
            "VOICE_V3_SOLICITOR_OUTCOME_RECORDED",
            call_id=client._ctx.call_id or None,
            workspace_id=client._ctx.workspace_id or None,
            extra={"result": result},
        )
        return result if isinstance(result, dict) else {"ok": True}
    except Exception:
        logger.exception("voice_v3_solicitor_outcome_record_failed")
        raise


def build_report_unwanted_solicitor_tool(
    client: TransovoV3ToolClient,
    state: SolicitorOutcomeState,
):
    @function_tool(
        name="report_unwanted_solicitor",
        description=(
            "Record that this call is a confirmed unsolicited sales solicitation. "
            "Call this once before end_call when politely declining a solicitor."
        ),
        flags=ToolFlag.IGNORE_ON_ENTER,
    )
    async def report_unwanted_solicitor() -> str:
        result = await _record_solicitor_outcome(client, state)
        import json

        return json.dumps(result, separators=(",", ":"))

    return report_unwanted_solicitor

