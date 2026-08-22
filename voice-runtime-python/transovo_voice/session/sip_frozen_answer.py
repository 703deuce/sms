"""Frozen MCTB SIP answer sequence — do not modify without explicit approval."""

from __future__ import annotations

import traceback
from typing import TYPE_CHECKING

from transovo_voice.session.sip_answer_session import start_minimal_sip_answer_session
from transovo_voice.session.sip_status import (
    SipCallStatusTracer,
    read_sip_call_status,
    wait_for_sip_call_status_active,
)

if TYPE_CHECKING:
    import asyncio

    from livekit.agents import AgentSession, JobContext
    from livekit import rtc

    from transovo_voice.session.mctb_sip_e2e_trace import MctbSipE2eTrace

SIP_ANSWER_TIMEOUT_SECONDS = 15.0


async def run_frozen_sip_answer_sequence(
    ctx: "JobContext",
    *,
    trace: "MctbSipE2eTrace",
    participant: "rtc.RemoteParticipant",
    room_already_connected: bool,
) -> tuple["AgentSession", "asyncio.Task[None]", SipCallStatusTracer, str] | None:
    """
    Known-good sequence:
    ctx.connect → AgentSession.start + RoomIO → real sip.callStatus=active
    """
    status_tracer = SipCallStatusTracer(ctx.room, participant, trace=trace)

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
            return None
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
        return None

    observed_status = read_sip_call_status(participant)
    trace.log_participant_active(sip_call_status=observed_status)
    return answer_session, answer_task, status_tracer, observed_status or "active"
