"""MCTB 571 SIP ingress — answer + raw PCM audio diagnostic (no AI/TTS)."""

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
from transovo_voice.session.sip_answer_session import start_minimal_sip_answer_session
from transovo_voice.session.sip_raw_audio import TONE_DURATION_S, play_diagnostic_tone
from transovo_voice.session.sip_status import (
    SIP_CALL_STATUS_ACTIVE,
    SipCallStatusTracer,
    read_sip_call_status,
    wait_for_sip_call_status_active,
)
from transovo_voice.telemetry import log_event

if TYPE_CHECKING:
    from livekit.agents import JobContext
    from livekit import rtc
    from transovo_voice.integrations.backend_client import TransovoBackend

LOG_SOURCE = "mctb-sip-diagnostic"
POST_TONE_HOLD_SECONDS = 1.0
SIP_ANSWER_TIMEOUT_SECONDS = 15.0


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
    SIP ingress for 571:
    connect → locate SIP participant (ringing) → minimum RoomIO answer →
    wait for real sip.callStatus=active → play PCM tone → brief hold → disconnect.
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

    status_tracer = SipCallStatusTracer(ctx.room, participant, trace=trace)

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

    answer_session = None
    answer_task: asyncio.Task[None] | None = None

    try:
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
                return
        else:
            trace.log(
                "ctx_connect_skipped_already_connected",
                roomName=ctx.room.name,
                jobId=trace.job_id,
            )
            trace.log_worker_room_connected(0)

        status_tracer.start()
        status_tracer.log_initial()

        answer_session, answer_task = await start_minimal_sip_answer_session(
            ctx,
            trace=trace,
            delete_room_on_close=True,
        )

        active = await wait_for_sip_call_status_active(
            ctx.room,
            participant,
            trace=trace,
            timeout_s=SIP_ANSWER_TIMEOUT_SECONDS,
            status_tracer=status_tracer,
        )
        if not active:
            trace.log_sip_call_final_state(
                disconnect_reason="sip_answer_timeout",
                sip_status=read_sip_call_status(participant),
            )
            return

        observed_status = read_sip_call_status(participant)
        trace.log_participant_active(sip_call_status=observed_status)

        participant_count = len(ctx.room.remote_participants) + 1
        trace.log_room_ready(created_new=False, participant_count=participant_count)

        trace.log_diagnostic_audio_start()
        audio_result = await play_diagnostic_tone(
            ctx.room,
            answer_session,
            trace=trace,
            sip_participant=participant,
            sip_call_status=observed_status,
            duration_s=TONE_DURATION_S,
        )
        if audio_result.ok and audio_result.frames_written > 0:
            trace.log_diagnostic_audio_complete()
        else:
            trace.log_diagnostic_audio_failed(audio_result.error or "no_frames_published")
            trace.log_sip_call_final_state(
                disconnect_reason="diagnostic_audio_failed",
                sip_status=read_sip_call_status(participant),
            )
            return

        trace.log(
            "mctb_hold_started",
            holdSeconds=POST_TONE_HOLD_SECONDS,
            note="post_tone_hold_before_disconnect",
            sipCallStatus=read_sip_call_status(participant),
            toneDurationSeconds=TONE_DURATION_S,
        )
        await asyncio.sleep(POST_TONE_HOLD_SECONDS)
        trace.log(
            "mctb_hold_complete",
            holdSeconds=POST_TONE_HOLD_SECONDS,
            sipCallStatus=read_sip_call_status(participant),
        )

        trace.log_sip_call_final_state(
            disconnect_reason="diagnostic_complete",
            sip_status=read_sip_call_status(participant) or SIP_CALL_STATUS_ACTIVE,
        )
        log_event(
            "mctb_sip_diagnostic_complete",
            call_id=trace.correlation_id,
            room=ctx.room.name,
            extra={
                "toE164": trace.to_e164,
                "fromE164": trace.from_e164,
                "source": LOG_SOURCE,
                "toneDurationSeconds": TONE_DURATION_S,
                "postToneHoldSeconds": POST_TONE_HOLD_SECONDS,
                "audioEnabled": True,
                "audioFramesWritten": audio_result.frames_written,
                "sipCallStatus": read_sip_call_status(participant),
            },
        )
    finally:
        status_tracer.stop()
        if answer_session is not None:
            try:
                await answer_session.aclose()
            except Exception:
                pass
        if answer_task is not None and not answer_task.done():
            answer_task.cancel()
            try:
                await answer_task
            except asyncio.CancelledError:
                pass
            except Exception:
                pass
        await trace.finalize()
