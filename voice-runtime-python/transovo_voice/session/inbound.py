from __future__ import annotations

import asyncio
import logging
import os
import time
from typing import Any
from uuid import uuid4

from livekit.agents import JobContext

from transovo_voice.integrations.backend_client import TransovoBackend
from transovo_voice.integrations.commit_client import drain_pending_provider_tasks
from transovo_voice.tasks.protocols import is_phone_field
from transovo_voice.observability.call_metrics import CallObservability
from transovo_voice.observability.startup_timeline import StartupTimeline, startup_masking_audio_enabled
from transovo_voice.session.dispatch_resolver import extract_call_numbers, resolve_inbound_bootstrap
from transovo_voice.templates.registry import DEFAULT_ACTIVE_TEMPLATE, resolve_template_id
from transovo_voice.templates.router import run_template
from transovo_voice.session.startup_audio import DEFAULT_IMMEDIATE_ANSWER, play_immediate_answer
from transovo_voice.telemetry import log_event
from transovo_voice.userdata import ManifestField, ReceptionistCompiled, SessionUserData, TransferPolicy

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


def _parse_transfer_policy(raw: dict[str, Any] | None) -> TransferPolicy | None:
    if not raw:
        return None
    dest = str(raw.get("destinationE164") or raw.get("transferNumber") or "").strip() or None
    emergency = str(raw.get("emergencyDestinationE164") or "").strip() or None
    if not dest and not emergency:
        return TransferPolicy(
            warm_transfer=raw.get("warmTransfer") is not False,
            take_message_on_failure=raw.get("takeMessageOnFailure") is not False,
        )
    return TransferPolicy(
        destination_e164=dest,
        emergency_destination_e164=emergency,
        warm_transfer=raw.get("warmTransfer") is not False,
        take_message_on_failure=raw.get("takeMessageOnFailure") is not False,
    )


def _userdata_from_bootstrap(data: dict[str, Any]) -> SessionUserData:
    compiled_raw = data.get("receptionistCompiled") or {}
    manifest_raw = compiled_raw.get("fieldManifest") or []
    capabilities = list(compiled_raw.get("capabilities") or [])
    enabled_builtin_tools = list(compiled_raw.get("enabledBuiltinTools") or [])
    transfer_raw = compiled_raw.get("transferPolicy")
    transfer_policy = _parse_transfer_policy(
        transfer_raw if isinstance(transfer_raw, dict) else None,
    )
    receptionist = ReceptionistCompiled(
        business_name=str(compiled_raw.get("businessName") or data.get("businessName") or ""),
        agent_display_name=str(compiled_raw.get("agentDisplayName") or "Receptionist"),
        greeting=str(compiled_raw.get("greeting") or data.get("greeting") or ""),
        timezone=str(compiled_raw.get("timezone") or data.get("timezone") or "America/New_York"),
        compiled_prompt=str(compiled_raw.get("compiledPrompt") or data.get("compiledPrompt") or ""),
        field_manifest=_parse_manifest(manifest_raw if isinstance(manifest_raw, list) else []),
        capabilities=capabilities,
        transfer_policy=transfer_policy,
        agent_job_instructions=str(compiled_raw.get("agentJobInstructions") or ""),
        business_description=str(compiled_raw.get("businessDescription") or ""),
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
        sip_outbound_trunk_id=(str(data.get("sipOutboundTrunkId") or "").strip() or None),
        sip_caller_id_e164=(str(data.get("sipCallerIdE164") or "").strip() or None),
        capabilities=capabilities,
        transfer_policy=transfer_policy,
        receptionist=receptionist,
        compiled_prompt=str(data.get("compiledPrompt") or receptionist.compiled_prompt),
        greeting=str(data.get("greeting") or receptionist.greeting),
        realtime_model=str(data.get("realtimeModel") or "gpt-realtime-2"),
        realtime_voice=str(data.get("realtimeVoice") or "marin"),
        realtime_speed=data.get("realtimeSpeed"),
        runtime_profile=str(data.get("runtimeProfile") or "generic_receptionist"),
        enabled_builtin_tools=enabled_builtin_tools,
        agent_template=str(data.get("agentTemplate") or DEFAULT_ACTIVE_TEMPLATE),
    )


def _prefill_caller_phone(ud: SessionUserData) -> None:
    if not ud.caller_e164 or not ud.receptionist:
        return
    for field in ud.receptionist.field_manifest:
        manifest = {"id": field.id, "label": field.label, "type": field.type}
        if is_phone_field(manifest) and not ud.collected_fields.get(field.id, "").strip():
            ud.collected_fields[field.id] = ud.caller_e164


def _fire_backend_call(backend: TransovoBackend, action: str, payload: dict[str, Any]) -> None:
    async def _send() -> None:
        try:
            await backend.call(action, payload)
        except Exception as err:
            logger.warning("background backend action=%s failed: %s", action, err)

    asyncio.create_task(_send())


async def run_inbound_session(ctx: JobContext) -> None:
    from transovo_voice.session.mctb_sip_diagnostic import is_mctb_571_sip_target
    from transovo_voice.session.mctb_sip_e2e_trace import (
        MctbSipE2eTrace,
        derive_correlation_id,
        extract_job_id,
        make_backend_reporter,
    )

    agent_name = os.getenv("LIVEKIT_AGENT_NAME", "transovo-voice-runtime")

    backend = TransovoBackend()
    ud: SessionUserData | None = None
    observability: CallObservability | None = None
    job_started_at = time.perf_counter()
    startup_timeline = StartupTimeline(job_started_at)
    startup_timeline.mark("job_received")

    job_id = extract_job_id(ctx)
    room_sid = getattr(ctx.room, "sid", None)
    trace: MctbSipE2eTrace | None = None

    async def shutdown_backend() -> None:
        if trace is not None and not trace.finalized:
            trace.log_sip_call_final_state(disconnect_reason="worker_shutdown")
            await trace.finalize()
        if observability is not None:
            await observability.finalize()
        if ud is not None:
            await drain_pending_provider_tasks(ud)
        await backend.close()
        log_event(
            "call_ended",
            call_id=ud.call_id if ud else None,
            workspace_id=ud.workspace_id if ud else None,
            agent_id=ud.agent_id if ud else None,
            room=ctx.room.name,
        )

    ctx.add_shutdown_callback(shutdown_backend)

    participant_watchdog = asyncio.create_task(asyncio.sleep(15.0))

    try:
        participant = await asyncio.wait_for(ctx.wait_for_participant(), timeout=15.0)
    except asyncio.TimeoutError:
        participant_watchdog.cancel()
        log_event(
            "mctb_sip_watchdog_timeout",
            room=ctx.room.name,
            extra={
                "source": "mctb-sip-e2e",
                "failureReason": "SIP_PARTICIPANT_NOT_CREATED",
                "jobId": job_id,
            },
        )
        await backend.close()
        return
    finally:
        if not participant_watchdog.done():
            participant_watchdog.cancel()

    startup_timeline.mark("participant_joined")

    attrs = dict(participant.attributes or {})
    call_id = str(uuid4())
    from_e164, to_e164 = extract_call_numbers(attrs, ctx.room.metadata, participant.identity)

    reporter = await make_backend_reporter(backend)
    correlation_id = derive_correlation_id(attrs, room_name=ctx.room.name, job_id=job_id)
    trace = MctbSipE2eTrace.create(
        correlation_id=correlation_id,
        job_id=job_id,
        room_name=ctx.room.name,
        room_sid=str(room_sid) if room_sid else None,
        attrs=attrs,
        from_e164=from_e164,
        to_e164=to_e164,
        backend_report=reporter,
    )
    trace.log_telnyx_sip_inbound_seen()
    trace.log_telnyx_to_livekit_invite_attempted()
    trace.log_livekit_sip_session_received(participant)

    if is_mctb_571_sip_target(to_e164):
        from transovo_voice.session.mctb_sip_diagnostic import run_mctb_sip_diagnostic_session

        try:
            await run_mctb_sip_diagnostic_session(
                ctx,
                backend,
                trace=trace,
                participant=participant,
                agent_name=agent_name,
            )
        finally:
            await backend.close()
        return

    connect_task = asyncio.create_task(ctx.connect())
    try:
        from livekit.plugins.openai.realtime import RealtimeModel  # noqa: F401
    except ImportError:
        pass

    async def _connect_and_optional_masking_audio() -> None:
        await connect_task
        startup_timeline.mark("room_connected")
        if not startup_masking_audio_enabled():
            return
        startup_timeline.mark("masking_audio_begin", extra={"temporary": True})
        masking_ms = await play_immediate_answer(
            ctx.room,
            phrase=DEFAULT_IMMEDIATE_ANSWER,
            temporary=True,
        )
        if masking_ms is not None:
            startup_timeline.set_masking_audio_ms(masking_ms)
            startup_timeline.mark("masking_audio_complete", extra={"temporary": True, "maskingAudioMs": masking_ms})

    masking_task = asyncio.create_task(_connect_and_optional_masking_audio())

    dispatch_resolve_started = time.perf_counter()
    bootstrap, bootstrap_path, bootstrap_http_requests = await resolve_inbound_bootstrap(
        backend,
        room_name=ctx.room.name,
        participant_identity=participant.identity,
        participant_attributes=attrs,
        job_metadata=ctx.job.metadata,
        room_metadata=ctx.room.metadata,
        call_id=call_id,
        from_e164=from_e164,
        to_e164=to_e164,
    )
    dispatch_resolve_ms = int((time.perf_counter() - dispatch_resolve_started) * 1000)
    bootstrap["callId"] = call_id
    startup_timeline.set_dispatch_resolve_ms(dispatch_resolve_ms, path=bootstrap_path)
    if bootstrap_path == "dispatch_local":
        startup_timeline.mark(
            "snapshot_parsed",
            extra={"bootstrapPath": bootstrap_path, "httpRequests": 0},
        )
    log_event(
        "dispatch_bootstrap_resolved",
        call_id=call_id,
        extra={
            "bootstrapPath": bootstrap_path,
            "dispatchResolveMs": dispatch_resolve_ms,
            "bootstrapHttpRequests": bootstrap_http_requests,
            "toE164": to_e164,
            "fromE164": from_e164,
        },
    )
    startup_timeline.mark(
        "routing_metadata_parsed",
        extra={
            "dispatchResolveMs": dispatch_resolve_ms,
            "bootstrapPath": bootstrap_path,
            "bootstrapHttpRequests": bootstrap_http_requests,
        },
    )
    startup_timeline.mark(
        "config_ready",
        extra={
            "dispatchResolveMs": dispatch_resolve_ms,
            "bootstrapPath": bootstrap_path,
            "bootstrapHttpRequests": bootstrap_http_requests,
        },
    )

    if bootstrap_path in {"compiled", "bootstrap_inbound", "unknown"}:
        log_event(
            "slow_bootstrap_path_active",
            call_id=call_id,
            extra={
                "bootstrapPath": bootstrap_path,
                "dispatchResolveMs": dispatch_resolve_ms,
                "bootstrapHttpRequests": bootstrap_http_requests,
                "message": (
                    "Legacy bootstrap path active — republish agent and verify LiveKit "
                    "did dispatch snapshot for zero-HTTP startup (bootstrapPath=dispatch_local)"
                ),
                "toE164": to_e164,
            },
        )
        logger.error(
            "SLOW BOOTSTRAP PATH: bootstrapPath=%s dispatchResolveMs=%s httpRequests=%s — "
            "stamp runtime snapshot into LiveKit did dispatch rule metadata",
            bootstrap_path,
            dispatch_resolve_ms,
            bootstrap_http_requests,
        )
    elif bootstrap_path == "dispatch_snapshot":
        logger.warning(
            "HTTP dispatch snapshot fallback active: bootstrapPath=%s dispatchResolveMs=%s — "
            "sync LiveKit did dispatch rule to reach dispatch_local",
            bootstrap_path,
            dispatch_resolve_ms,
        )

    await connect_task
    if not bootstrap.get("ok"):
        masking_task.cancel()
        logger.error("inbound bootstrap failed: %s", bootstrap.get("error"))
        return

    if bootstrap.get("apiVersion") != 1:
        masking_task.cancel()
        logger.error("Unsupported bootstrap apiVersion=%s", bootstrap.get("apiVersion"))
        return

    ud = _userdata_from_bootstrap(bootstrap)
    template_id = resolve_template_id(
        str(bootstrap.get("agentTemplate") or ud.agent_template),
    )
    observability = CallObservability(
        ud=ud,
        backend=backend,
        template_id=template_id,
        job_started_at=job_started_at,
        startup_timeline=startup_timeline,
    )
    await observability.mark_bootstrap_complete()

    _fire_backend_call(
        backend,
        "persist_inbound_call",
        {
            "callId": ud.call_id,
            "workspaceId": ud.workspace_id,
            "agentId": ud.agent_id,
            "agentVersionId": ud.agent_version_id,
            "fromE164": ud.caller_e164,
            "toE164": ud.to_e164,
            "livekitRoomName": ctx.room.name,
            "livekitParticipantId": participant.identity,
        },
    )

    log_event(
        "call_started",
        call_id=ud.call_id,
        workspace_id=ud.workspace_id,
        agent_id=ud.agent_id,
        room=ctx.room.name,
        extra={
            "runtime": "livekit_python",
            "agent_template": template_id,
            "runtimeProfile": ud.runtime_profile,
            "dispatchResolveMs": dispatch_resolve_ms,
            "bootstrapPath": bootstrap_path,
            "bootstrapHttpRequests": bootstrap_http_requests,
            "startupPhases": startup_timeline.snapshot(),
        },
    )

    _fire_backend_call(
        backend,
        "emit_event",
        {
            "workspaceId": ud.workspace_id,
            "callId": ud.call_id,
            "eventType": "runtime_template_selected",
            "payload": {
                "runtime": "livekit_python",
                "agent_template": template_id,
                "agent_template_version": "1",
                "receptionist_id": ud.agent_id,
            },
        },
    )

    _prefill_caller_phone(ud)

    _fire_backend_call(
        backend,
        "persist_intake_fields",
        {
            "workspaceId": ud.workspace_id,
            "agentId": ud.agent_id,
            "callId": ud.call_id,
            "fields": ud.collected_fields,
            "purpose": "booking",
        },
    )

    await run_template(ctx, ud, backend, template_id=template_id, observability=observability)
