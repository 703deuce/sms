from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

from livekit import rtc
from livekit.agents import Agent, AgentSession, JobContext, room_io
from livekit.plugins.openai.realtime import GPTLiveModel
from livekit.plugins.openai.tools import FileSearch

from transovo_voice.integrations.backend_client import TransovoBackend
from transovo_voice.session.dispatch_resolver import extract_call_numbers
from transovo_voice.telemetry import log_event
from transovo_voice.voice_v3.forensics import VoiceV3CallForensics
from transovo_voice.voice_v3.gpt_live_delegation_telemetry import attach_gpt_live_delegation_telemetry
from transovo_voice.voice_v3.tool_client import TransovoV3ToolClient, VoiceV3CallContext
from transovo_voice.voice_v3.end_call_tool import build_voice_v3_end_call_toolset
from transovo_voice.voice_v3.tools import LiveKitTelephonyBridge, build_livekit_tools

logger = logging.getLogger("transovo-voice.voice_v3")

TELNYX_CALL_SCREENING_ATTR = "transovo.telnyx.call_screening"


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
    forensics: VoiceV3CallForensics | None = None
    session: AgentSession | None = None
    client: TransovoV3ToolClient | None = None
    bootstrap_error: str | None = None

    async def shutdown_backend() -> None:
        nonlocal backend_closed
        if backend_closed:
            return
        backend_closed = True
        await backend.close()

    async def flush_forensics() -> None:
        if forensics is None or client is None:
            return
        try:
            await forensics.flush(
                client,
                ctx,
                session,
                error_message=bootstrap_error,
            )
        except Exception:
            logger.exception("voice_v3_forensics_shutdown_flush_failed")

    ctx.add_shutdown_callback(flush_forensics)
    ctx.add_shutdown_callback(shutdown_backend)

    try:
        forensics = VoiceV3CallForensics(
            ctx=VoiceV3CallContext(
                room_name=ctx.room.name,
                sip_participant_identity="",
                caller_e164=None,
                dialed_e164=None,
                sip_call_id=None,
                provider_call_id=None,
                trunk_id=None,
                rule_id=None,
                telnyx_call_screening_raw=None,
                live_session_id="",
                call_id="",
                workspace_id="",
                agent_id="",
            ),
            job_id=ctx.job.id,
            room_name=ctx.room.name,
        )
        forensics.append("VOICE_V3_SESSION_BOOTSTRAP_START", room=ctx.room.name)

        sip_participant = await _wait_for_sip_participant(ctx)
        attrs = _attrs_dict(sip_participant)
        caller_e164, dialed_e164 = extract_call_numbers(
            attrs,
            ctx.room.metadata,
            sip_participant.identity,
        )

        screening_raw = attrs.get(TELNYX_CALL_SCREENING_ATTR)
        provisional_ctx = VoiceV3CallContext(
            room_name=ctx.room.name,
            sip_participant_identity=sip_participant.identity,
            caller_e164=caller_e164,
            dialed_e164=dialed_e164,
            sip_call_id=attrs.get("sip.callID"),
            provider_call_id=attrs.get("sip.callIDFull"),
            trunk_id=attrs.get("sip.trunkID"),
            rule_id=attrs.get("sip.ruleID"),
            telnyx_call_screening_raw=screening_raw,
            live_session_id="",
            call_id="",
            workspace_id="",
            agent_id="",
        )
        client = TransovoV3ToolClient(backend, provisional_ctx)
        forensics.append("AGENTSESSION_START_REQUESTED")
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
            telnyx_call_screening_raw=screening_raw,
            live_session_id=live_session_id,
            call_id=str(config.get("callId") or live_session_id),
            workspace_id=str(config.get("workspaceId") or ""),
            agent_id=str(config.get("agentId") or ""),
        )
        client = TransovoV3ToolClient(backend, call_ctx)
        forensics.ctx = call_ctx

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
            forensics=forensics,
        )

        end_call_toolset = build_voice_v3_end_call_toolset(
            call_id=call_ctx.call_id,
            workspace_id=call_ctx.workspace_id,
            agent_id=call_ctx.agent_id,
            room=ctx.room.name,
            extra_hint=str(config.get("endCallToolHint") or "").strip(),
        )
        session_tools: list[Any] = list(lk_tools)
        vector_store_ids = config.get("openaiFileSearchVectorStoreIds") or []
        cleaned_vs: list[str] = []
        if isinstance(vector_store_ids, list):
            cleaned_vs = [str(v).strip() for v in vector_store_ids if str(v).strip()]
            if cleaned_vs:
                session_tools.append(FileSearch(vector_store_ids=cleaned_vs))
        session_tools.extend(end_call_toolset.tools)

        def _on_participant_disconnected(participant: rtc.RemoteParticipant) -> None:
            if participant.identity != sip_participant.identity:
                return
            if forensics:
                forensics.append("VOICE_V3_CALLER_DISCONNECTED")
            log_event(
                "VOICE_V3_CALLER_DISCONNECTED",
                call_id=call_ctx.call_id or None,
                workspace_id=call_ctx.workspace_id or None,
                agent_id=call_ctx.agent_id or None,
                room=ctx.room.name,
            )

        ctx.room.on("participant_disconnected", _on_participant_disconnected)

        responses_options: dict[str, Any] = {
            "model": config.get("astraModel") or "gpt-5.6-sol",
            "instructions": config.get("astraInstructions") or "",
            "tool_choice": "auto",
            "parallel_tool_calls": bool(config.get("parallelToolCalls", False)),
        }
        responses_options["reasoning"] = {
            "effort": str(config.get("reasoningEffort") or "none"),
        }
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
        agent = Agent(instructions=str(config.get("amyInstructions") or ""))

        if forensics:
            forensics.attach_session(session, agent)

        @session.on("user_input_transcribed")
        def on_user_input_transcribed(ev: Any) -> None:
            try:
                is_final = bool(getattr(ev, "is_final", False) or getattr(ev, "final", False))
                transcript = str(getattr(ev, "transcript", "") or "").strip()
                if not is_final or not transcript:
                    return
                if forensics:
                    forensics.append(
                        "CALLER_UTTERANCE_TRANSCRIBED",
                        utterance_chars=len(transcript),
                        item_id=getattr(ev, "item_id", None),
                    )
                asyncio.create_task(_commit_utterance(client, transcript))
            except Exception:
                logger.exception("voice_v3_transcript_handler_failed")

        async def _commit_utterance(tool_client: TransovoV3ToolClient, utterance: str) -> None:
            result = await tool_client.commit_caller_utterance(utterance)
            if forensics:
                forensics.append(
                    "CALLER_UTTERANCE_COMMITTED",
                    utterance_chars=len(utterance),
                    result=result,
                )
                asyncio.create_task(forensics.maybe_checkpoint(tool_client))
            log_event(
                "voice_v3_caller_utterance_committed",
                room=ctx.room.name,
                extra={"result": result, "utterance_chars": len(utterance)},
            )

        amy_tool_names = [getattr(t, "name", None) or "" for t in session_tools]
        log_event(
            "voice_v3_session_starting",
            room=ctx.room.name,
            extra={
                "liveSessionId": live_session_id,
                "toolCount": len(session_tools),
                "workspaceId": call_ctx.workspace_id,
                "agentId": call_ctx.agent_id,
                "amyNativeTools": ["end_call"],
                "amyToolNames": [n for n in amy_tool_names if n],
            },
        )
        if forensics:
            forensics.append("AGENTSESSION_STARTED")

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
        if forensics:
            forensics.append("AGENTSESSION_START_COMPLETED")
            try:
                attach_gpt_live_delegation_telemetry(forensics, agent.duplex_session)
            except Exception:
                logger.exception("voice_v3_gpt_live_delegation_telemetry_attach_failed")
    except Exception as err:
        bootstrap_error = str(err)[:500]
        if forensics:
            forensics.append("VOICE_V3_SESSION_BOOTSTRAP_FAILED", message=bootstrap_error)
        await flush_forensics()
        await shutdown_backend()
        raise
