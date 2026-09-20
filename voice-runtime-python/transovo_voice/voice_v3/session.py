from __future__ import annotations

import asyncio
import logging
from typing import Any

from livekit import rtc
from livekit.agents import Agent, AgentSession, JobContext, room_io
from livekit.plugins.openai.realtime import GPTLiveModel

from transovo_voice.integrations.backend_client import TransovoBackend
from transovo_voice.session.dispatch_resolver import extract_call_numbers
from transovo_voice.telemetry import log_event
from transovo_voice.voice_v3.tool_client import TransovoV3ToolClient, VoiceV3CallContext
from transovo_voice.voice_v3.end_call_tool import build_voice_v3_end_call_toolset
from transovo_voice.voice_v3.solicitor_outcome import (
    SolicitorOutcomeState,
    build_report_unwanted_solicitor_tool,
)
from transovo_voice.voice_v3.tools import LiveKitTelephonyBridge, build_livekit_tools

logger = logging.getLogger("transovo-voice.voice_v3")


def _attrs_dict(participant: rtc.RemoteParticipant) -> dict[str, str]:
    return {str(k): str(v) for k, v in (participant.attributes or {}).items()}


def _telnyx_screening_from_attrs(attrs: dict[str, str]) -> str | None:
    for key in (
        "transovo.telnyx.call_screening",
        "sip.h.X-Telnyx-Call-Screening",
        "X-Telnyx-Call-Screening",
    ):
        raw = (attrs.get(key) or "").strip()
        if raw:
            return raw
    return None


async def _wait_for_sip_participant(ctx: JobContext) -> rtc.RemoteParticipant:
    participant = await asyncio.wait_for(ctx.wait_for_participant(), timeout=20.0)
    return participant


async def _try_immediate_telnyx_screening_header(
    ctx: JobContext,
    sip_identity: str,
) -> str | None:
    """Best-effort SIP header read via participant RPC (no sleep)."""
    local = ctx.room.local_participant
    if local is None or not hasattr(local, "perform_rpc"):
        return None
    try:
        raw = await asyncio.wait_for(
            local.perform_rpc(
                destination_identity=sip_identity,
                method="lk.sip.GetRemoteHeaders",
                payload="",
                response_timeout=0.35,
            ),
            timeout=0.4,
        )
        if not raw:
            return None
        import json

        parsed = json.loads(raw) if isinstance(raw, str) else raw
        if isinstance(parsed, dict):
            for key in ("X-Telnyx-Call-Screening", "x-telnyx-call-screening"):
                val = parsed.get(key)
                if val:
                    return str(val).strip()
            headers = parsed.get("headers")
            if isinstance(headers, dict):
                for key in ("X-Telnyx-Call-Screening", "x-telnyx-call-screening"):
                    val = headers.get(key)
                    if val:
                        return str(val).strip()
    except Exception:
        logger.debug("voice_v3_get_remote_headers_unavailable", exc_info=True)
    return None


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
        telnyx_screening = _telnyx_screening_from_attrs(attrs)
        if not telnyx_screening:
            immediate = await _try_immediate_telnyx_screening_header(
                ctx, sip_participant.identity
            )
            if immediate:
                telnyx_screening = immediate
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
            telnyx_call_screening=telnyx_screening,
            live_session_id="",
            call_id="",
            workspace_id="",
            agent_id="",
        )
        client = TransovoV3ToolClient(backend, provisional_ctx)
        config = await client.resolve_session_config()

        if config.get("preCallReject") == "blocklist":
            log_event(
                "VOICE_V3_BLOCKLIST_CALL_REJECTED",
                room=ctx.room.name,
                extra={"callerE164": caller_e164},
            )
            await ctx.room.disconnect()
            return

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
            telnyx_call_screening=telnyx_screening,
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

        solicitor_policy = str(config.get("solicitorPolicy") or "ALLOW")
        solicitor_state = SolicitorOutcomeState()
        session_tools = list(lk_tools)
        if solicitor_policy == "DECLINE":
            session_tools.append(
                build_report_unwanted_solicitor_tool(client, solicitor_state)
            )

        async def _before_end_call() -> None:
            if not solicitor_state.recorded:
                return
            from transovo_voice.voice_v3.solicitor_outcome import _record_solicitor_outcome

            await _record_solicitor_outcome(client, solicitor_state)

        end_call_toolset = build_voice_v3_end_call_toolset(
            call_id=call_ctx.call_id,
            workspace_id=call_ctx.workspace_id,
            agent_id=call_ctx.agent_id,
            room=ctx.room.name,
            extra_hint=str(config.get("endCallToolHint") or "").strip(),
            before_end_call=_before_end_call,
        )
        session_tools = [*session_tools, *end_call_toolset.tools]

        def _on_participant_disconnected(participant: rtc.RemoteParticipant) -> None:
            if participant.identity != sip_participant.identity:
                return
            log_event(
                "VOICE_V3_CALLER_DISCONNECTED",
                call_id=call_ctx.call_id or None,
                workspace_id=call_ctx.workspace_id or None,
                agent_id=call_ctx.agent_id or None,
                room=ctx.room.name,
            )

        ctx.room.on("participant_disconnected", _on_participant_disconnected)

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
        agent = Agent(instructions=str(config.get("amyInstructions") or ""))

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

        amy_tool_names = [getattr(t, "name", None) or "" for t in session_tools]
        log_event(
            "voice_v3_session_starting",
            room=ctx.room.name,
            extra={
                "liveSessionId": live_session_id,
                "toolCount": len(session_tools),
                "workspaceId": call_ctx.workspace_id,
                "agentId": call_ctx.agent_id,
                "amyNativeTools": [
                    t
                    for t in (
                        "report_unwanted_solicitor" if solicitor_policy == "DECLINE" else None,
                        "end_call",
                    )
                    if t
                ],
                "amyToolNames": [n for n in amy_tool_names if n],
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
