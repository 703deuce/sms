from __future__ import annotations

import logging
from typing import Any

from livekit.agents import JobContext

from transovo_voice.integrations.backend_client import TransovoBackend
from transovo_voice.integrations.commit_client import drain_pending_provider_tasks
from transovo_voice.tasks.protocols import is_phone_field
from transovo_voice.observability.call_metrics import CallObservability
from transovo_voice.templates.registry import DEFAULT_ACTIVE_TEMPLATE, resolve_template_id
from transovo_voice.templates.router import run_template
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


async def run_inbound_session(ctx: JobContext) -> None:
    backend = TransovoBackend()
    ud: SessionUserData | None = None
    observability: CallObservability | None = None
    job_started_at = __import__("time").perf_counter()

    async def shutdown_backend() -> None:
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

    participant = await ctx.wait_for_participant()
    await ctx.connect()

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

    if bootstrap.get("apiVersion") != 1:
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
    )
    await observability.mark_bootstrap_complete()

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
        },
    )

    await backend.call(
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

    persisted = await backend.call(
        "persist_intake_fields",
        {
            "workspaceId": ud.workspace_id,
            "agentId": ud.agent_id,
            "callId": ud.call_id,
            "fields": ud.collected_fields,
            "purpose": "booking",
        },
    )
    if persisted.get("ok") and persisted.get("fields"):
        ud.collected_fields = dict(persisted["fields"])

    await run_template(ctx, ud, backend, template_id=template_id, observability=observability)
