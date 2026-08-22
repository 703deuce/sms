"""MCTB 571 SIP ingress — end-to-end diagnostic trace only (no SMS, no AI)."""

from __future__ import annotations

import asyncio
import re
import time
from typing import TYPE_CHECKING, Any

from transovo_voice.session.mctb_sip_e2e_trace import (
    DIAGNOSTIC_PHRASE,
    MCTB_571_E164,
    MctbSipE2eTrace,
    is_correlation_already_handled,
    make_backend_reporter,
    mark_correlation_handled,
)
from transovo_voice.session.startup_audio import play_immediate_answer
from transovo_voice.telemetry import log_event

if TYPE_CHECKING:
    from livekit.agents import JobContext
    from livekit import rtc
    from transovo_voice.integrations.backend_client import TransovoBackend

LOG_SOURCE = "mctb-sip-diagnostic"


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


def is_mctb_571_sip_target(to_e164: str | None) -> bool:
    normalized = _normalize_e164(to_e164)
    return normalized == MCTB_571_E164


async def run_mctb_sip_diagnostic_session(
    ctx: "JobContext",
    backend: "TransovoBackend",
    *,
    trace: MctbSipE2eTrace,
    participant: "rtc.RemoteParticipant",
    agent_name: str,
) -> None:
    """
    SIP ingress for 571 — minimal media diagnostic only:
    connect → play one test phrase → hang up.
    """
    if is_correlation_already_handled(trace.correlation_id):
        trace.log_mctb_diagnostic_skipped("duplicate_correlation_id")
        await trace.finalize()
        return

    mark_correlation_handled(trace.correlation_id)
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

    connect_started = time.perf_counter()
    trace.log_worker_room_connect_start()
    try:
        await ctx.connect()
        connect_ms = int((time.perf_counter() - connect_started) * 1000)
        trace.log_worker_room_connected(connect_ms)
        trace.log_participant_active()
    except Exception as err:
        connect_ms = int((time.perf_counter() - connect_started) * 1000)
        trace.log_worker_room_connect_failed(elapsed_ms=connect_ms, error=str(err))
        trace.log_sip_call_final_state(disconnect_reason="room_connect_failed")
        await trace.finalize()
        return

    participant_count = len(ctx.room.remote_participants) + 1
    trace.log_room_ready(created_new=False, participant_count=participant_count)

    trace.log_diagnostic_audio_start()
    played_ms = await play_immediate_answer(
        ctx.room,
        phrase=DIAGNOSTIC_PHRASE,
        call_id=trace.correlation_id,
        temporary=False,
    )
    if played_ms is None:
        trace.log_diagnostic_audio_failed("playback_failed")
    else:
        trace.log_diagnostic_audio_complete()

    await asyncio.sleep(0.5)

    trace.log_sip_call_final_state(
        disconnect_reason="diagnostic_complete",
        sip_status="hangup",
    )
    log_event(
        "mctb_sip_diagnostic_complete",
        call_id=trace.correlation_id,
        room=ctx.room.name,
        extra={
            "toE164": trace.to_e164,
            "fromE164": trace.from_e164,
            "source": LOG_SOURCE,
            "playedMs": played_ms,
        },
    )
    await trace.finalize()
