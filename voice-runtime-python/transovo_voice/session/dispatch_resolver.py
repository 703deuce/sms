from __future__ import annotations

import json
import logging
from typing import Any

from transovo_voice.integrations.backend_client import TransovoBackend

logger = logging.getLogger("transovo-voice.dispatch")

PYTHON_RUNTIME_BOOTSTRAP_SNAPSHOT_KEY = "pythonRuntimeBootstrapSnapshot"


def _parse_json_object(raw: str | dict[str, Any] | None) -> dict[str, Any] | None:
    if raw is None:
        return None
    if isinstance(raw, dict):
        return raw
    text = str(raw).strip()
    if not text:
        return None
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


def extract_call_numbers(
    attrs: dict[str, str],
    room_metadata: str | dict[str, Any] | None,
    participant_identity: str,
) -> tuple[str | None, str | None]:
    room_meta = _parse_json_object(room_metadata)
    from_e164 = (
        (room_meta or {}).get("fromE164")
        or attrs.get("sip.phoneNumber")
        or attrs.get("fromE164")
        or attrs.get("callerNumber")
        or participant_identity
    )
    trunk_number = (
        attrs.get("sip.trunkPhoneNumber")
        or attrs.get("sip.trunkNumber")
        or attrs.get("trunkPhoneNumber")
    )
    to_e164 = (
        (room_meta or {}).get("toE164")
        or trunk_number
        or attrs.get("sip.calledNumber")
        or attrs.get("calledNumber")
        or attrs.get("toE164")
    )
    from_clean = str(from_e164).strip() if from_e164 else None
    to_clean = str(to_e164).strip() if to_e164 else None
    return from_clean or None, to_clean or None


def _snapshot_from_value(raw: Any) -> dict[str, Any] | None:
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError:
            return None
    if not isinstance(raw, dict):
        return None
    if raw.get("snapshotVersion") != 1 or raw.get("apiVersion") != 1:
        return None
    if not raw.get("workspaceId") or not raw.get("agentId"):
        return None
    return raw


def _embedded_snapshot(
    job_meta: dict[str, Any] | None,
    room_meta: dict[str, Any] | None,
    attrs: dict[str, str],
) -> dict[str, Any] | None:
    for source in (
        (job_meta or {}).get(PYTHON_RUNTIME_BOOTSTRAP_SNAPSHOT_KEY),
        (room_meta or {}).get(PYTHON_RUNTIME_BOOTSTRAP_SNAPSHOT_KEY),
        attrs.get(PYTHON_RUNTIME_BOOTSTRAP_SNAPSHOT_KEY),
    ):
        snap = _snapshot_from_value(source)
        if snap:
            return snap
    return None


def _merge_dispatch_fields(
    job_meta: dict[str, Any] | None,
    room_meta: dict[str, Any] | None,
    attrs: dict[str, str],
) -> dict[str, Any]:
    merged: dict[str, Any] = {}
    for source in (room_meta, job_meta):
        if not source:
            continue
        for key in (
            "workspaceId",
            "agentId",
            "publishedVersionId",
            "agentTemplate",
            "livekitProfile",
            "fromE164",
            "toE164",
            "callId",
        ):
            value = source.get(key)
            if value:
                merged[key] = value
    for key, value in attrs.items():
        if key in {
            "workspaceId",
            "agentId",
            "publishedVersionId",
            "agentTemplate",
            "livekitProfile",
            "fromE164",
            "toE164",
            "callId",
        } and value.strip():
            merged[key] = value.strip()
    return merged


def build_bootstrap_from_snapshot(
    snapshot: dict[str, Any],
    *,
    call_id: str,
    from_e164: str | None,
    to_e164: str | None,
    agent_version_id: str | None = None,
    bootstrap_path: str = "dispatch_local",
) -> dict[str, Any]:
    return {
        "ok": True,
        "apiVersion": 1,
        "callId": call_id,
        "workspaceId": str(snapshot["workspaceId"]),
        "agentId": str(snapshot["agentId"]),
        "agentVersionId": agent_version_id or snapshot.get("agentVersionId"),
        "callerE164": from_e164,
        "toE164": to_e164,
        "timezone": snapshot.get("timezone") or "America/New_York",
        "businessName": snapshot.get("businessName") or "our office",
        "runtimeProfile": snapshot.get("runtimeProfile") or "generic_receptionist",
        "agentTemplate": snapshot.get("agentTemplate"),
        "agentTemplateVersion": snapshot.get("agentTemplateVersion") or "1",
        "runtime": snapshot.get("runtime") or "livekit_python",
        "receptionistCompiled": snapshot.get("receptionistCompiled"),
        "compiledPrompt": snapshot.get("compiledPrompt"),
        "greeting": snapshot.get("greeting"),
        "realtimeModel": snapshot.get("realtimeModel") or "gpt-realtime-2",
        "realtimeVoice": snapshot.get("realtimeVoice") or "marin",
        "realtimeSpeed": snapshot.get("realtimeSpeed"),
        "eventTypeUri": snapshot.get("eventTypeUri"),
        "sipOutboundTrunkId": None,
        "sipCallerIdE164": to_e164,
        "bootstrapPath": bootstrap_path,
    }


def try_local_dispatch_bootstrap(
    *,
    job_metadata: str | dict[str, Any] | None,
    room_metadata: str | dict[str, Any] | None,
    participant_attributes: dict[str, str],
    call_id: str,
    from_e164: str | None,
    to_e164: str | None,
) -> dict[str, Any] | None:
    job_meta = _parse_json_object(job_metadata)
    room_meta = _parse_json_object(room_metadata)
    snapshot = _embedded_snapshot(job_meta, room_meta, participant_attributes)
    if not snapshot:
        return None

    merged = _merge_dispatch_fields(job_meta, room_meta, participant_attributes)
    return build_bootstrap_from_snapshot(
        snapshot,
        call_id=call_id,
        from_e164=from_e164 or merged.get("fromE164"),
        to_e164=to_e164 or merged.get("toE164"),
        agent_version_id=merged.get("publishedVersionId"),
        bootstrap_path="dispatch_local",
    )


async def resolve_inbound_bootstrap(
    backend: TransovoBackend,
    *,
    room_name: str,
    participant_identity: str,
    participant_attributes: dict[str, str],
    job_metadata: str | dict[str, Any] | None,
    room_metadata: str | dict[str, Any] | None,
    call_id: str,
    from_e164: str | None,
    to_e164: str | None,
) -> tuple[dict[str, Any], str, int]:
    """Returns (bootstrap, bootstrap_path, http_requests). http_requests is 0 on dispatch_local."""
    local = try_local_dispatch_bootstrap(
        job_metadata=job_metadata,
        room_metadata=room_metadata,
        participant_attributes=participant_attributes,
        call_id=call_id,
        from_e164=from_e164,
        to_e164=to_e164,
    )
    if local and local.get("ok"):
        return local, "dispatch_local", 0

    dispatch = await backend.call(
        "resolve_dispatch_snapshot",
        {
            "participantIdentity": participant_identity,
            "participantAttributes": participant_attributes,
            "jobMetadata": job_metadata,
            "roomMetadata": room_metadata,
            "fromE164": from_e164,
            "toE164": to_e164,
        },
    )
    if dispatch.get("ok"):
        dispatch["callId"] = call_id
        path = str(dispatch.get("bootstrapPath") or "dispatch_snapshot")
        return dispatch, path, 1

    logger.warning(
        "resolve_dispatch_snapshot failed (%s, code=%s); falling back to bootstrap_inbound",
        dispatch.get("error"),
        dispatch.get("code"),
    )
    legacy = await backend.call(
        "bootstrap_inbound",
        {
            "roomName": room_name,
            "participantIdentity": participant_identity,
            "participantAttributes": participant_attributes,
            "jobMetadata": job_metadata,
            "roomMetadata": room_metadata,
            "predeterminedCallId": call_id,
        },
    )
    legacy["callId"] = call_id
    return legacy, str(legacy.get("bootstrapPath") or "bootstrap_inbound"), 2
