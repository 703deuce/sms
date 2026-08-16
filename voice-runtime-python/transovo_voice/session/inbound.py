from __future__ import annotations

import json
import logging
from typing import Any

from livekit.agents import AgentSession, JobContext, room_io
from livekit.agents.voice.events import UserInputTranscribedEvent

from transovo_voice.agent.amy import create_amy_agent
from transovo_voice.integrations.backend_client import TransovoBackend
from transovo_voice.session.realtime_config import build_realtime_model
from transovo_voice.telemetry import log_event
from transovo_voice.userdata import ManifestField, ReceptionistCompiled, SessionUserData
from transovo_voice.workflows.booking_intake import (
    opportunistic_prefill,
    should_run_opportunistic_prefill,
)

logger = logging.getLogger("transovo-voice.inbound")


def _parse_manifest(raw_manifest: list[dict[str, Any]]) -> list[ManifestField]:
    fields: list[ManifestField] = []
    for item in raw_manifest:
        fields.append(
            ManifestField(
                id=str(item.get("id", "")),
                label=str(item.get("label", "")),
                question=str(item.get("question", "")),
                type=str(item.get("type", "text")),
                required=bool(item.get("required", True)),
                ask_when=item.get("askWhen"),
                validation=item.get("validation"),
            ),
        )
    return fields


def _userdata_from_bootstrap(data: dict[str, Any]) -> SessionUserData:
    compiled_raw = data.get("receptionistCompiled") or {}
    manifest_raw = compiled_raw.get("fieldManifest") or []
    receptionist = ReceptionistCompiled(
        business_name=str(compiled_raw.get("businessName") or data.get("businessName") or ""),
        agent_display_name=str(compiled_raw.get("agentDisplayName") or "Amy"),
        greeting=str(compiled_raw.get("greeting") or data.get("greeting") or ""),
        timezone=str(compiled_raw.get("timezone") or data.get("timezone") or "America/New_York"),
        compiled_prompt=str(compiled_raw.get("compiledPrompt") or data.get("compiledPrompt") or ""),
        field_manifest=_parse_manifest(manifest_raw if isinstance(manifest_raw, list) else []),
        capabilities=list(compiled_raw.get("capabilities") or []),
    )
    return SessionUserData(
        workspace_id=str(data["workspaceId"]),
        agent_id=str(data["agentId"]),
        call_id=str(data["callId"]),
        business_name=str(data.get("businessName") or receptionist.business_name),
        timezone=str(data.get("timezone") or receptionist.timezone),
        caller_e164=data.get("callerE164"),
        to_e164=data.get("toE164"),
        agent_version_id=data.get("agentVersionId"),
        event_type_uri=data.get("eventTypeUri"),
        receptionist=receptionist,
        compiled_prompt=str(data.get("compiledPrompt") or receptionist.compiled_prompt),
        greeting=str(data.get("greeting") or receptionist.greeting),
        realtime_model=str(data.get("realtimeModel") or "gpt-realtime-2"),
        realtime_voice=str(data.get("realtimeVoice") or "marin"),
        realtime_speed=data.get("realtimeSpeed"),
        runtime_profile=str(data.get("runtimeProfile") or "generic_receptionist"),
    )


async def run_inbound_session(ctx: JobContext) -> None:
    backend = TransovoBackend()
    try:
        participant = await ctx.wait_for_participant()
        attrs = dict(participant.attributes or {})
        bootstrap = await backend.call(
            "bootstrap_inbound",
            {
                "roomName": ctx.room.name,
                "participantIdentity": participant.identity,
                "participantAttributes": attrs,
                "jobMetadata": ctx.job.metadata,
                "roomMetadata": ctx.room.metadata,
            },
        )
        if not bootstrap.get("ok"):
            logger.error("bootstrap failed: %s", bootstrap.get("error"))
            return

        api_version = bootstrap.get("apiVersion")
        if api_version != 1:
            log_event(
                "bootstrap_api_version_mismatch",
                room=ctx.room.name,
                extra={"apiVersion": api_version, "expected": 1},
            )
            logger.error(
                "Unsupported bootstrap apiVersion=%s (expected 1) — redeploy voice worker",
                api_version,
            )
            return

        ud = _userdata_from_bootstrap(bootstrap)
        log_event(
            "call_started",
            call_id=ud.call_id,
            workspace_id=ud.workspace_id,
            agent_id=ud.agent_id,
            room=ctx.room.name,
            extra={"runtimeProfile": ud.runtime_profile},
        )

        if ud.runtime_profile != "generic_receptionist":
            log_event(
                "python_voice_profile_unsupported",
                call_id=ud.call_id,
                workspace_id=ud.workspace_id,
                agent_id=ud.agent_id,
                extra={"runtimeProfile": ud.runtime_profile},
            )
            logger.warning(
                "Profile %s not supported by Python runtime — set VOICE_RUNTIME_IMPL=typescript",
                ud.runtime_profile,
            )
            return

        persisted = await backend.call(
            "persist_intake_fields",
            {
                "workspaceId": ud.workspace_id,
                "agentId": ud.agent_id,
                "callId": ud.call_id,
                "fields": {},
                "purpose": "booking",
            },
        )
        if persisted.get("ok") and persisted.get("fields"):
            ud.collected_fields = dict(persisted["fields"])

        realtime_llm = build_realtime_model(
            model=ud.realtime_model,
            voice=ud.realtime_voice,
            speed=ud.realtime_speed,
        )

        session = AgentSession(llm=realtime_llm, userdata=ud)
        agent = create_amy_agent(ud, session, backend)

        @session.on("user_input_transcribed")
        def on_transcript(ev: UserInputTranscribedEvent) -> None:
            if not ev.is_final:
                return
            if not should_run_opportunistic_prefill(ud):
                return
            import asyncio

            asyncio.create_task(opportunistic_prefill(backend, ud, ev.transcript))

        await session.start(
            agent=agent,
            room=ctx.room,
            room_options=room_io.RoomOptions(),
        )
        await ctx.connect()

        log_event(
            "worker_ready",
            call_id=ud.call_id,
            workspace_id=ud.workspace_id,
            agent_id=ud.agent_id,
            room=ctx.room.name,
        )

        greeting = ud.greeting.strip()
        if greeting:
            await session.generate_reply(
                instructions=f"Say this greeting warmly and naturally: {greeting}",
            )
        else:
            await session.generate_reply(
                instructions=(
                    f"Welcome the caller to {ud.business_name}. "
                    "Ask how you can help today. Keep it brief."
                ),
            )
    finally:
        await backend.close()
        log_event("call_ended")
