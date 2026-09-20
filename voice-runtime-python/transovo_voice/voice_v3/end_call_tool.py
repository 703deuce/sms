from __future__ import annotations

from livekit.agents.beta.tools import EndCallTool
from livekit.agents.llm.tool_context import Toolset

from transovo_voice.telemetry import log_event

END_CALL_EXTRA_DESCRIPTION = """
End the phone call only when the conversation is genuinely complete, the caller clearly
wants to end the conversation, or there is no remaining action you should perform.
Do not end the call merely because one tool or objective completed (booking, callback,
link sent, FAQ answered, transfer attempted, etc.). A successful backend action does not
mean the caller is done — they may have another question or objective.
Do not end during an active workflow pause; wait for clear completion or goodbye.
Do not use this tool during the opening greeting.
""".strip()

END_CALL_END_INSTRUCTIONS = """
Give the caller a brief, natural closing appropriate to the conversation.
Do not introduce new information, ask another question, or restart the conversation.
Then end the call.
""".strip()


def build_voice_v3_end_call_toolset(
    *,
    call_id: str,
    workspace_id: str,
    agent_id: str,
    room: str,
    extra_hint: str = "",
) -> EndCallTool:
    extra = END_CALL_EXTRA_DESCRIPTION
    if extra_hint.strip():
        extra = f"{extra}\n{extra_hint.strip()}"

    async def on_tool_called(_ev: Toolset.ToolCalledEvent) -> None:
        log_event(
            "VOICE_V3_END_CALL_REQUESTED",
            call_id=call_id or None,
            workspace_id=workspace_id or None,
            agent_id=agent_id or None,
            room=room or None,
            extra={"endReasonCategory": "AGENT_ENDED_CALL"},
        )

    async def on_tool_completed(_ev: Toolset.ToolCompletedEvent) -> None:
        log_event(
            "VOICE_V3_END_CALL_COMPLETED",
            call_id=call_id or None,
            workspace_id=workspace_id or None,
            agent_id=agent_id or None,
            room=room or None,
        )

    return EndCallTool(
        extra_description=extra,
        end_instructions=END_CALL_END_INSTRUCTIONS,
        delete_room=True,
        ignore_on_enter=True,
        on_tool_called=on_tool_called,
        on_tool_completed=on_tool_completed,
    )
