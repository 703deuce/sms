from __future__ import annotations

import asyncio
import logging
from typing import Any

from livekit import rtc
from livekit.agents import Agent, AgentSession, JobContext, room_io
from livekit.agents.beta.tools import EndCallTool
from livekit.plugins.openai.realtime import GPTLiveModel

from transovo_voice.integrations.backend_client import TransovoBackend
from transovo_voice.session.dispatch_resolver import extract_call_numbers
from transovo_voice.telemetry import log_event
from transovo_voice.voice_v3.tool_client import TransovoV3ToolClient, VoiceV3CallContext
from transovo_voice.voice_v3.tools import LiveKitTelephonyBridge, build_livekit_tools

logger = logging.getLogger("transovo-voice.voice_v3")


class VoiceV3AmyAgent(Agent):
    """LiveKit V3 agent — proactive greeting on connect (GPT-Live waits for user audio otherwise)."""

    def __init__(self, instructions: str, initial_greeting: str | None = None) -> None:
        super().__init__(instructions=instructions)
        self._initial_greeting = (initial_greeting or "").strip()

    async def on_enter(self) -> None:
        if not self._initial_greeting:
            return
        log_event(
            "voice_v3_greeting_generate_reply_begin",
            extra={"greeting_chars": len(self._initial_greeting)},
        )
        await self.session.generate_reply(
            instructions=(
                "Say exactly this greeting to the caller (warm and natural): "
                f"{self._initial_greeting}"
            ),
        )
        log_event("voice_v3_greeting_generate_reply_complete")


def _attrs_dict(participant: rtc.RemoteParticipant) -> dict[str, str]:
    return {str(k): str(v) for k, v in (participant.attributes or {}).items()}


async def _wait_for_sip_participant(ctx: JobContext) -> rtc.RemoteParticipant:
    participant = await asyncio.wait_for(ctx.wait_for_participant(), timeout=20.0)
    return participant


def _openai_tool_to_dict(tool: dict[str, Any] | Any) -> dict[str, Any]:
    if isinstance(tool, dict):
        if "name" in tool:
            return tool
        fn = tool.get("function")
        if isinstance(fn, dict):
            return {
                "name": fn.get("name", ""),
                "description": fn.get("description", ""),
                "parameters": fn.get("parameters") or {},
            }
    name = getattr(tool, "name", None)
    if name:
        return {
            "name": str(name),
            "description": str(getattr(tool, "description", "") or ""),
            "parameters": getattr(tool, "parameters", None) or {},
        }
    return {"name": "", "description": "", "parameters": {}}


async def run_voice_v3_livekit_session(ctx: JobContext) -> None:
    backend = TransovoBackend()
    backend_closed = False

    async def shutdown_backend() -> None:
        nonlocal backend_closed
        if backend_closed:
            return
        backend_closed = True
        await backend.close()

    ctx.add_shutdown_callback(shutdown_backend)

    try:
        sip_participant = await _wait_for_sip_participant(ctx)
        attrs = _attrs_dict(sip_participant)
        caller_e164, dialed_e164 = extract_call_numbers(
            attrs,
            ctx.room.metadata,
            sip_participant.identity,
        )

        provisional_ctx = VoiceV3CallContext(
            room_name=ctx.room.name,
            sip_participant_identity=sip_participant.identity,
            caller_e164=caller_e164,
            dialed_e164=dialed_e164,
            sip_call_id=attrs.get("sip.callID"),
            provider_call_id=attrs.get("sip.callIDFull"),
            trunk_id=attrs.get("sip.trunkID"),
            rule_id=attrs.get("sip.ruleID"),
            live_session_id="",
            call_id="",
            workspace_id="",
            agent_id="",
        )
        client = TransovoV3ToolClient(backend, provisional_ctx)
        config = await client.resolve_session_config()

        live_session_id = str(config.get("liveSessionId") or "")
        call_ctx = VoiceV3CallContext(
            room_name=ctx.room.name,
            sip_participant_identity=sip_participant.identity,
            caller_e164=caller_e164,
            dialed_e164=dialed_e164,
            sip_call_id=attrs.get("sip.callID"),
            provider_call_id=attrs.get("sip.callIDFull"),
            trunk_id=attrs.get("sip.trunkID"),
            rule_id=attrs.get("sip.ruleID"),
            live_session_id=live_session_id,
            call_id=str(config.get("callId") or live_session_id),
            workspace_id=str(config.get("workspaceId") or ""),
            agent_id=str(config.get("agentId") or ""),
        )
        client = TransovoV3ToolClient(backend, call_ctx)

        raw_tools = config.get("toolSchemas") or []
        tool_dicts = [_openai_tool_to_dict(t) for t in raw_tools if _openai_tool_to_dict(t).get("name")]
        telephony = LiveKitTelephonyBridge(
            job_ctx=ctx,
            sip_participant_identity=sip_participant.identity,
        )
        intake_fields = config.get("intakeFields") or []
        lk_tools = build_livekit_tools(
            tool_dicts,
            client,
            telephony=telephony,
            intake_fields=intake_fields if isinstance(intake_fields, list) else [],
        )

        end_call_toolset = EndCallTool(
            ignore_on_enter=True,
            delete_room=True,
            extra_description=str(config.get("endCallToolHint") or "").strip(),
        )
        session_tools = [*lk_tools, *end_call_toolset.tools]

        responses_options: dict[str, Any] = {
            "model": config.get("astraModel") or "gpt-6-astra",
            "instructions": config.get("astraInstructions") or "",
            "tool_choice": "auto",
            "parallel_tool_calls": bool(config.get("parallelToolCalls", False)),
        }
        if config.get("reasoningEffort"):
            responses_options["reasoning"] = {"effort": config["reasoningEffort"]}
        if config.get("textVerbosity"):
            responses_options["text"] = {"verbosity": config["textVerbosity"]}

        gpt_live = GPTLiveModel(
            model="gpt-live-1",
            voice=str(config.get("liveVoiceId") or "marin"),
            delegation="responses",
            responses_options=responses_options,
        )

        max_tool_steps = int(config.get("maxToolSteps") or 5)
        session = AgentSession(llm=gpt_live, tools=session_tools, max_tool_steps=max_tool_steps)
        initial_greeting = str(config.get("initialGreetingText") or "").strip()
        speaks_first = str(config.get("speaksFirst") or "ai").strip().lower()
        if speaks_first == "caller":
            initial_greeting = ""
        agent = VoiceV3AmyAgent(
            instructions=str(config.get("amyInstructions") or ""),
            initial_greeting=initial_greeting or None,
        )

        @session.on("user_input_transcribed")
        def on_user_input_transcribed(ev: Any) -> None:
            try:
                is_final = bool(getattr(ev, "is_final", False) or getattr(ev, "final", False))
                transcript = str(getattr(ev, "transcript", "") or "").strip()
                if not is_final or not transcript:
                    return
                asyncio.create_task(_commit_utterance(client, transcript))
            except Exception:
                logger.exception("voice_v3_transcript_handler_failed")

        async def _commit_utterance(tool_client: TransovoV3ToolClient, utterance: str) -> None:
            result = await tool_client.commit_caller_utterance(utterance)
            log_event(
                "voice_v3_caller_utterance_committed",
                room=ctx.room.name,
                extra={"result": result, "utterance_chars": len(utterance)},
            )

        log_event(
            "voice_v3_session_starting",
            room=ctx.room.name,
            extra={
                "liveSessionId": live_session_id,
                "toolCount": len(session_tools),
                "workspaceId": call_ctx.workspace_id,
                "agentId": call_ctx.agent_id,
                "speaksFirst": speaks_first,
                "hasInitialGreeting": bool(initial_greeting),
            },
        )

        room_options = room_io.RoomOptions(
            audio_input=True,
            audio_output=True,
            video_input=False,
            close_on_disconnect=True,
            participant_identity=sip_participant.identity,
        )

        await session.start(
            agent=agent,
            room=ctx.room,
            room_options=room_options,
        )
    except Exception:
        await shutdown_backend()
        raise
