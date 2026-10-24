from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

from livekit.agents.beta.workflows import WarmTransferTask
from livekit.agents.llm.tool_context import ToolError
from livekit.agents.voice.events import RunContext

from transovo_voice.telemetry import log_event
from transovo_voice.voice_v3.livekit_bridge_transfer import (
    execute_livekit_bridge_transfer,
    finalize_transfer_handoff,
)
from transovo_voice.voice_v3.telephony_bridge import LiveKitTelephonyBridge
from transovo_voice.voice_v3.tool_client import TransovoV3ToolClient

logger = logging.getLogger("transovo-voice.voice_v3.transfer")


async def _report_transfer_outcome_to_backend(
    client: TransovoV3ToolClient | None,
    *,
    transfer_request_id: str,
    route_id: str,
    status: str,
    reason: str | None,
    attempts: list[dict[str, Any]],
    connected_destination_id: str | None,
) -> None:
    if client is None:
        return
    payload = {
        "workspaceId": client._ctx.workspace_id,
        "callId": client._ctx.call_id,
        "agentId": client._ctx.agent_id,
        "transferRequestId": transfer_request_id,
        "routeId": route_id,
        "status": status,
        "reason": reason,
        "attempts": attempts,
        "connectedDestinationId": connected_destination_id,
    }
    try:
        await client._backend.call("record_voice_v3_transfer_outcome", payload)
    except Exception:
        logger.exception("voice_v3_transfer_outcome_report_failed")


def _strip_execution_payload(result: dict[str, Any]) -> dict[str, Any]:
    out = dict(result)
    data = out.get("data")
    if isinstance(data, dict) and "execution" in data:
        data = {k: v for k, v in data.items() if k != "execution"}
        out["data"] = data
    return out


async def _phone_foundation_handoff(
    client: TransovoV3ToolClient | None,
    *,
    target: dict[str, Any],
    transfer_request_id: str,
    route_id: str,
) -> str:
    if client is None:
        return "CONFIGURATION_ERROR"
    human_call_id = str(target.get("human_call_id") or "").strip()
    inbound_cc = str(target.get("inbound_call_control_id") or "").strip()
    forwarding_group_id = str(target.get("forwarding_group_id") or "").strip()
    destination_id = str(target.get("destination_id") or "").strip()
    if not human_call_id or not inbound_cc:
        return "CONFIGURATION_ERROR"
    payload = {
        "workspaceId": client._ctx.workspace_id,
        "callId": client._ctx.call_id,
        "agentId": client._ctx.agent_id,
        "transferRequestId": transfer_request_id,
        "routeId": route_id,
        "humanCallId": human_call_id,
        "inboundCallControlId": inbound_cc,
        "forwardingGroupId": forwarding_group_id or None,
        "destinationId": destination_id or None,
    }
    try:
        await client._backend.call("execute_phone_foundation_transfer", payload)
        return "PHONE_HANDOFF_STARTED"
    except Exception:
        logger.exception("voice_v3_phone_foundation_transfer_failed")
        return "PROVIDER_ERROR"


async def _warm_transfer(
    telephony: LiveKitTelephonyBridge,
    context: RunContext | None,
    *,
    dial_target: str,
    ringing_timeout_seconds: float,
    handoff_instructions: str,
    sip_trunk_id: str | None,
    sip_number: str | None,
    transfer_request_id: str,
) -> str:
    if context is None:
        raise ToolError("Warm transfer requires an active voice session context.")
    if not (sip_trunk_id or "").strip():
        return "CONFIGURATION_ERROR"
    if not (sip_number or "").strip():
        return "CONFIGURATION_ERROR"

    sip_call_to = dial_target.strip()
    if sip_call_to.startswith("tel:"):
        sip_call_to = sip_call_to[4:]

    task = WarmTransferTask(
        sip_call_to=sip_call_to,
        sip_trunk_id=sip_trunk_id,
        sip_number=sip_number or "",
        ringing_timeout=float(ringing_timeout_seconds),
        extra_instructions=handoff_instructions,
        chat_ctx=context.session.history,
    )

    log_event(
        "voice_v3_transfer_warm_starting",
        extra={
            "transfer_request_id": transfer_request_id,
            "ringing_timeout_seconds": ringing_timeout_seconds,
            "executor": "livekit_warm_transfer_task",
        },
    )
    try:
        async with context.foreground():
            await task
    except ToolError as exc:
        msg = str(exc).lower()
        if "declined" in msg:
            return "DECLINED"
        if "voicemail" in msg:
            return "VOICEMAIL"
        if "dial" in msg or "could not" in msg:
            return "PROVIDER_ERROR"
        return "TIMEOUT"
    except asyncio.TimeoutError:
        return "TIMEOUT"
    except Exception:
        logger.exception("voice_v3_transfer_warm_failed")
        return "PROVIDER_ERROR"

    await finalize_transfer_handoff(context)
    return "CONNECTED"


async def _direct_bridge_transfer(
    telephony: LiveKitTelephonyBridge,
    context: RunContext | None,
    *,
    transfer_request_id: str,
    destination_id: str,
    dial_target: str,
    ringing_timeout_seconds: float,
    sip_trunk_id: str | None,
    sip_number: str | None,
) -> str:
    log_event(
        "voice_v3_transfer_bridge_starting",
        extra={
            "transfer_request_id": transfer_request_id,
            "destination_id": destination_id,
            "ringing_timeout_seconds": ringing_timeout_seconds,
            "executor": "livekit_bridge",
        },
    )
    return await execute_livekit_bridge_transfer(
        telephony,
        context,
        transfer_request_id=transfer_request_id,
        destination_id=destination_id,
        dial_target=dial_target,
        ringing_timeout_seconds=ringing_timeout_seconds,
        sip_trunk_id=sip_trunk_id,
        sip_number=sip_number,
    )


async def execute_authorized_transfer_plan(
    result: dict[str, Any],
    telephony: LiveKitTelephonyBridge,
    context: RunContext | None,
    client: TransovoV3ToolClient | None = None,
) -> dict[str, Any]:
    if not result.get("ok"):
        return result

    data = result.get("data")
    if not isinstance(data, dict):
        return result

    plan = data.get("execution")
    if not isinstance(plan, dict):
        return _strip_execution_payload(result)

    targets = plan.get("targets")
    if not isinstance(targets, list) or not targets:
        return _strip_execution_payload(result)

    transfer_request_id = str(plan.get("transfer_request_id") or "")
    route_id = str(plan.get("route_id") or "")
    fallback = plan.get("fallback")
    handoff = str(plan.get("handoff_instructions") or "")
    transfer_reason: str | None = None
    surface = data.get("surface")
    if isinstance(surface, dict):
        raw_reason = surface.get("reason")
        if isinstance(raw_reason, str) and raw_reason.strip():
            transfer_reason = raw_reason.strip()
    trunk_id = plan.get("outbound_sip_trunk_id")
    caller_id = plan.get("outbound_caller_id_e164")

    attempts: list[dict[str, Any]] = []
    started = time.monotonic()

    for index, target in enumerate(targets):
        if not isinstance(target, dict):
            continue
        dest_id = str(target.get("destination_id") or "")
        mode = str(target.get("mode") or "DIRECT").upper()
        executor = str(target.get("executor") or "livekit_sip").lower()
        dial_target = str(target.get("dial_target") or "")
        timeout = float(target.get("ringing_timeout_seconds") or 30)
        if not dial_target and executor != "phone_call_control":
            continue

        log_event(
            "VOICE_V3_TRANSFER_ATTEMPT_STARTED",
            extra={
                "transfer_request_id": transfer_request_id,
                "route_id": route_id,
                "destination_id": dest_id,
                "mode": mode,
                "attempt_index": index,
                "executor": executor,
                "room": telephony.job_ctx.room.name,
                "caller_identity": telephony.sip_participant_identity,
            },
        )
        attempt_started = time.monotonic()
        outcome = "PROVIDER_ERROR"
        try:
            if executor == "phone_call_control":
                outcome = await _phone_foundation_handoff(
                    client,
                    target=target,
                    transfer_request_id=transfer_request_id,
                    route_id=route_id,
                )
            elif mode == "WARM":
                outcome = await _warm_transfer(
                    telephony,
                    context,
                    dial_target=dial_target,
                    ringing_timeout_seconds=timeout,
                    handoff_instructions=handoff,
                    sip_trunk_id=str(trunk_id) if trunk_id else None,
                    sip_number=str(caller_id) if caller_id else None,
                    transfer_request_id=transfer_request_id,
                )
            else:
                outcome = await _direct_bridge_transfer(
                    telephony,
                    context,
                    transfer_request_id=transfer_request_id,
                    destination_id=dest_id,
                    dial_target=dial_target,
                    ringing_timeout_seconds=timeout,
                    sip_trunk_id=str(trunk_id) if trunk_id else None,
                    sip_number=str(caller_id) if caller_id else None,
                )
        except asyncio.TimeoutError:
            outcome = "TIMEOUT"
        except Exception:
            logger.exception("voice_v3_transfer_attempt_failed")
            outcome = "PROVIDER_ERROR"

        duration_ms = int((time.monotonic() - attempt_started) * 1000)
        attempts.append(
            {
                "destination_id": dest_id,
                "mode": mode,
                "outcome": outcome,
                "duration_ms": duration_ms,
                "attempt_index": index,
                "executor": executor,
            },
        )
        log_event(
            "VOICE_V3_TRANSFER_ATTEMPT_FINISHED",
            extra={
                "transfer_request_id": transfer_request_id,
                "destination_id": dest_id,
                "outcome": outcome,
                "duration_ms": duration_ms,
                "attempt_index": index,
            },
        )

        if outcome in ("CONNECTED", "PHONE_HANDOFF_STARTED"):
            total_ms = int((time.monotonic() - started) * 1000)
            connected = outcome == "CONNECTED"
            log_event(
                "VOICE_V3_TRANSFER_CONNECTED" if connected else "VOICE_V3_TRANSFER_PHONE_HANDOFF_STARTED",
                extra={
                    "transfer_request_id": transfer_request_id,
                    "route_id": route_id,
                    "destination_id": dest_id,
                    "mode": mode,
                    "waterfall_attempt_count": index + 1,
                    "total_duration_ms": total_ms,
                    "human_answered": connected,
                },
            )
            log_event(
                "VOICE_V3_TRANSFER_BILLING_USAGE",
                extra={
                    "transfer_request_id": transfer_request_id,
                    "route_id": route_id,
                    "provider": "livekit",
                    "outcome": outcome,
                    "waterfall_attempt_count": index + 1,
                    "destination_ids": [a["destination_id"] for a in attempts],
                    "modes": [a["mode"] for a in attempts],
                    "ringing_duration_ms": duration_ms,
                    "warm_consult_duration_ms": duration_ms if mode == "WARM" else None,
                },
            )
            sanitized = _strip_execution_payload(result)
            status = "transfer_connected" if connected else "transfer_phone_handoff_started"
            if isinstance(sanitized.get("data"), dict):
                sanitized["data"] = {
                    **sanitized["data"],
                    "status": status,
                    "attempts": attempts,
                    "human_answered": connected,
                }
                sanitized["status"] = status
            asyncio.create_task(
                _report_transfer_outcome_to_backend(
                    client,
                    transfer_request_id=transfer_request_id,
                    route_id=route_id,
                    status=status,
                    reason=transfer_reason,
                    attempts=attempts,
                    connected_destination_id=dest_id if connected else None,
                ),
            )
            return sanitized

        log_event(
            "VOICE_V3_TRANSFER_WATERFALL_ADVANCED",
            extra={
                "transfer_request_id": transfer_request_id,
                "from_destination_id": dest_id,
                "next_index": index + 1,
            },
        )

    log_event(
        "VOICE_V3_TRANSFER_EXHAUSTED",
        extra={
            "transfer_request_id": transfer_request_id,
            "route_id": route_id,
            "fallback": fallback,
            "attempt_count": len(attempts),
        },
    )
    log_event(
        "VOICE_V3_TRANSFER_BILLING_USAGE",
        extra={
            "transfer_request_id": transfer_request_id,
            "route_id": route_id,
            "provider": "livekit",
            "outcome": "EXHAUSTED",
            "waterfall_attempt_count": len(attempts),
            "destination_ids": [a["destination_id"] for a in attempts],
            "modes": [a["mode"] for a in attempts],
        },
    )
    sanitized = _strip_execution_payload(result)
    if isinstance(sanitized.get("data"), dict):
        sanitized["data"] = {
            **sanitized["data"],
            "status": "transfer_exhausted",
            "fallback": fallback,
            "attempts": attempts,
        }
        sanitized["status"] = "transfer_exhausted"
    asyncio.create_task(
        _report_transfer_outcome_to_backend(
            client,
            transfer_request_id=transfer_request_id,
            route_id=route_id,
            status="transfer_exhausted",
            reason=transfer_reason,
            attempts=attempts,
            connected_destination_id=None,
        ),
    )
    return sanitized
