"""MCTB 571 SIP ingress — production session entrypoint."""

from __future__ import annotations

import re
from typing import TYPE_CHECKING

from transovo_voice.session.mctb_sip_e2e_trace import (
    MCTB_571_E164,
    MctbSipE2eTrace,
    is_correlation_already_handled,
    mark_correlation_handled,
)
from transovo_voice.session.mctb_sip_production import run_mctb_sip_production_session

if TYPE_CHECKING:
    from livekit.agents import JobContext
    from livekit import rtc
    from transovo_voice.integrations.backend_client import TransovoBackend


def _normalize_e164(value: str | None) -> str | None:
    if not value:
        return None
    digits = re.sub(r"\D", "", value)
    if len(digits) == 10:
        return f"+1{digits}"
    if len(digits) == 11 and digits.startswith("1"):
        return f"+{digits}"
    if value.startswith("+"):
        return value
    return value


def is_mctb_sip_ingress_target(to_e164: str | None) -> bool:
    """Fast sync check for platform demo DID — async resolver uses backend in inbound."""
    normalized = _normalize_e164(to_e164)
    return normalized == MCTB_571_E164


async def is_mctb_sip_route_target(
    backend: "TransovoBackend",
    to_e164: str | None,
) -> bool:
    if is_mctb_sip_ingress_target(to_e164):
        return True
    try:
        result = await backend.call("check_mctb_sip_ingress", {"toE164": to_e164})
        return bool(result.get("route"))
    except Exception:
        return is_mctb_sip_ingress_target(to_e164)


def is_mctb_571_sip_target(to_e164: str | None) -> bool:
    """Backward-compatible alias."""
    return is_mctb_sip_ingress_target(to_e164)


async def run_mctb_sip_diagnostic_session(
    ctx: "JobContext",
    backend: "TransovoBackend",
    *,
    trace: MctbSipE2eTrace,
    participant: "rtc.RemoteParticipant",
    agent_name: str,
    room_already_connected: bool = True,
) -> None:
    """571 SIP path — frozen answer/media, then MCTB product logic."""
    if is_correlation_already_handled(trace.correlation_id):
        trace.log_mctb_diagnostic_skipped("duplicate_correlation_id")
        await trace.finalize()
        return

    mark_correlation_handled(trace.correlation_id)
    trace.log("mctb_branch_selected", toE164=trace.to_e164, agentName=agent_name)
    trace.log_dispatch_evaluated(agent_name=agent_name)
    trace.log_participant_joined()
    trace.log_worker_job_received()
    trace.log_mctb_diagnostic_started()
    trace.start_standard_watchdogs()

    def _on_participant_disconnected(p: "rtc.RemoteParticipant") -> None:
        if p.sid == participant.sid:
            trace.log(
                "sip_participant_disconnected",
                participantId=p.sid,
                participantIdentity=p.identity,
                roomName=ctx.room.name,
                disconnectReason="participant_left",
            )

    ctx.room.on("participant_disconnected", _on_participant_disconnected)

    try:
        await run_mctb_sip_production_session(
            ctx,
            backend,
            trace=trace,
            participant=participant,
            agent_name=agent_name,
            room_already_connected=room_already_connected,
        )
    finally:
        await trace.finalize()
