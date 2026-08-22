"""MCTB 571 SIP ingress — room-answer hold test (no audio)."""

from __future__ import annotations

import asyncio
import re
import traceback
from typing import TYPE_CHECKING

from transovo_voice.session.mctb_sip_e2e_trace import (
    MCTB_571_E164,
    MctbSipE2eTrace,
    is_correlation_already_handled,
    mark_correlation_handled,
)
from transovo_voice.telemetry import log_event

if TYPE_CHECKING:
    from livekit.agents import JobContext
    from livekit import rtc
    from transovo_voice.integrations.backend_client import TransovoBackend

LOG_SOURCE = "mctb-sip-diagnostic"
HOLD_SECONDS = 3.0


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
    room_already_connected: bool = True,
) -> None:
    """
    SIP ingress for 571 — restore physical answer only:
    room already connected → confirm participant active → hold → disconnect.
    No audio publication in this step.
    """
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

    if not room_already_connected:
        import time

        connect_started = time.perf_counter()
        trace.log_worker_room_connect_start()
        trace.log("ctx_connect_invoked", roomName=ctx.room.name, jobId=trace.job_id)
        try:
            await ctx.connect()
            connect_ms = int((time.perf_counter() - connect_started) * 1000)
            trace.log("ctx_connect_completed", elapsedMs=connect_ms)
            trace.log_worker_room_connected(connect_ms)
        except Exception as err:
            connect_ms = int((time.perf_counter() - connect_started) * 1000)
            trace.log(
                "ctx_connect_failed",
                elapsedMs=connect_ms,
                error=str(err),
                traceback=traceback.format_exc(),
            )
            trace.log_worker_room_connect_failed(elapsed_ms=connect_ms, error=str(err))
            trace.log_sip_call_final_state(disconnect_reason="room_connect_failed")
            await trace.finalize()
            return
    else:
        trace.log(
            "ctx_connect_skipped_already_connected",
            roomName=ctx.room.name,
            jobId=trace.job_id,
        )
        trace.log_worker_room_connected(0)

    sip_status = (participant.attributes or {}).get("sip.callStatus")
    trace.log_participant_active()
    trace.log(
        "sip_participant_status_observed",
        sipCallStatus=sip_status,
        participantId=participant.sid,
        expectedActive=True,
    )

    participant_count = len(ctx.room.remote_participants) + 1
    trace.log_room_ready(created_new=False, participant_count=participant_count)

    trace.log(
        "mctb_hold_started",
        holdSeconds=HOLD_SECONDS,
        note="no_audio_room_answer_only_test",
    )
    await asyncio.sleep(HOLD_SECONDS)
    trace.log("mctb_hold_complete", holdSeconds=HOLD_SECONDS)

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
            "holdSeconds": HOLD_SECONDS,
            "audioEnabled": False,
        },
    )
    await trace.finalize()
