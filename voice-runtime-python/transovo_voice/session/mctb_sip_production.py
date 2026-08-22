"""MCTB 571 SIP production flow — layered on frozen answer/media sequence."""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING, Any

from transovo_voice.session.sip_status import SIP_CALL_STATUS_ACTIVE
from transovo_voice.session.sip_consent_audio import play_consent_audio_url
from transovo_voice.session.sip_dtmf import wait_for_sip_dtmf_digit
from transovo_voice.session.sip_forwarded_from import extract_forwarded_from_sip_attributes
from transovo_voice.session.sip_frozen_answer import run_frozen_sip_answer_sequence
from transovo_voice.session.sip_status import read_sip_call_status
from transovo_voice.telemetry import log_event

if TYPE_CHECKING:
    from livekit.agents import JobContext
    from livekit import rtc
    from transovo_voice.integrations.backend_client import TransovoBackend

LOG_SOURCE = "mctb-sip-production"
POST_FLOW_HOLD_SECONDS = 1.0
DTMF_GATHER_TIMEOUT_SECONDS = 12.0


async def _resolve_session(
    backend: "TransovoBackend",
    *,
    trace: MctbSipE2eTrace,
    participant: "rtc.RemoteParticipant",
) -> dict[str, Any]:
    attrs = dict(participant.attributes or {})
    forwarded_from_attrs, diversion_header = extract_forwarded_from_sip_attributes(attrs)
    forwarded_from = forwarded_from_attrs or trace.forwarded_from
    if forwarded_from and not trace.forwarded_from:
        trace.forwarded_from = forwarded_from

    trace.log(
        "mctb_forwarded_from_resolved",
        forwardedFromE164=forwarded_from,
        diversionHeader=diversion_header,
        sipAttributeKeys=sorted(attrs.keys()),
    )

    return await backend.call(
        "resolve_mctb_sip_session",
        {
            "callerE164": trace.from_e164,
            "transovoNumberE164": trace.to_e164,
            "forwardedFromE164": forwarded_from,
            "diversionHeader": diversion_header,
            "sipAttributes": attrs,
        },
    )


async def _capture_existing_consent_event(
    backend: "TransovoBackend",
    *,
    trace: MctbSipE2eTrace,
    participant: "rtc.RemoteParticipant",
    session: dict[str, Any],
) -> dict[str, Any]:
    attrs = dict(participant.attributes or {})
    return await backend.call(
        "capture_mctb_sip_inbound",
        {
            "providerCallId": trace.correlation_id,
            "callerE164": trace.from_e164,
            "transovoNumberE164": trace.to_e164,
            "forwardedFromE164": session.get("forwardedFromE164") or trace.forwarded_from,
            "diversionHeader": session.get("diversionHeader"),
            "livekitRoomName": trace.room_name,
            "participantIdentity": participant.identity,
            "sipAttributes": attrs,
        },
    )


async def _record_press_1_consent(
    backend: "TransovoBackend",
    *,
    trace: MctbSipE2eTrace,
    session: dict[str, Any],
    digit: str,
) -> dict[str, Any]:
    return await backend.call(
        "record_mctb_sip_press_1_consent",
        {
            "workspaceId": session.get("workspaceId"),
            "callerNumber": trace.from_e164,
            "businessNumber": session.get("businessE164") or trace.to_e164,
            "providerCallId": trace.correlation_id,
            "forwardedFrom": session.get("forwardedFromE164") or trace.forwarded_from,
            "audioAssetId": session.get("audioAssetId"),
            "dtmfDigit": digit,
        },
    )


async def run_mctb_sip_production_session(
    ctx: "JobContext",
    backend: "TransovoBackend",
    *,
    trace: MctbSipE2eTrace,
    participant: "rtc.RemoteParticipant",
    agent_name: str,
    room_already_connected: bool = True,
) -> None:
    trace.log("mctb_production_started", agentName=agent_name)

    answer_session = None
    answer_task: asyncio.Task[None] | None = None
    status_tracer = None

    try:
        frozen = await run_frozen_sip_answer_sequence(
            ctx,
            trace=trace,
            participant=participant,
            room_already_connected=room_already_connected,
        )
        if frozen is None:
            return
        answer_session, answer_task, status_tracer, sip_status = frozen

        participant_count = len(ctx.room.remote_participants) + 1
        trace.log_room_ready(created_new=False, participant_count=participant_count)

        session = await _resolve_session(backend, trace=trace, participant=participant)
        if not session.get("ok"):
            trace.log("mctb_session_resolve_failed", error=session.get("error"))
            trace.log_sip_call_final_state(
                disconnect_reason="session_resolve_failed",
                sip_status=read_sip_call_status(participant),
            )
            return

        consent_mode = str(session.get("consentMode") or "press_1")
        trace.log(
            "mctb_consent_mode_selected",
            consentMode=consent_mode,
            workspaceId=session.get("workspaceId"),
            demoMode=session.get("demoMode"),
            playUrl=session.get("playUrl"),
            failClosed=session.get("failClosed"),
            forwardedFromE164=session.get("forwardedFromE164"),
        )

        if consent_mode == "existing_consent":
            capture = await _capture_existing_consent_event(
                backend,
                trace=trace,
                participant=participant,
                session=session,
            )
            trace.log(
                "mctb_existing_consent_captured",
                captureOk=capture.get("ok"),
                missedCallEventId=capture.get("missedCallEventId"),
                eligible=capture.get("eligible"),
                deduped=capture.get("deduped"),
            )
        else:
            if session.get("failClosed"):
                trace.log("mctb_consent_audio_fail_closed", workspaceId=session.get("workspaceId"))
                trace.log_sip_call_final_state(
                    disconnect_reason="consent_audio_fail_closed",
                    sip_status=read_sip_call_status(participant),
                )
                return

            play_url = str(session.get("playUrl") or "").strip()
            if not play_url:
                trace.log("mctb_consent_audio_missing", workspaceId=session.get("workspaceId"))
                trace.log_sip_call_final_state(
                    disconnect_reason="consent_audio_missing",
                    sip_status=read_sip_call_status(participant),
                )
                return

            dtmf_task = asyncio.create_task(
                wait_for_sip_dtmf_digit(
                    ctx.room,
                    participant_identity=participant.identity,
                    digit=str(session.get("consentDigit") or "1"),
                    timeout_s=DTMF_GATHER_TIMEOUT_SECONDS,
                    trace=trace,
                ),
                name="mctb_dtmf_wait",
            )

            trace.log_diagnostic_audio_start()
            audio_result = await play_consent_audio_url(
                ctx.room,
                answer_session,
                trace=trace,
                sip_participant=participant,
                sip_call_status=sip_status,
                play_url=play_url,
            )
            if audio_result.ok and audio_result.frames_written > 0:
                trace.log_diagnostic_audio_complete()
            else:
                trace.log_diagnostic_audio_failed(audio_result.error or "no_frames_published")
                dtmf_task.cancel()
                trace.log_sip_call_final_state(
                    disconnect_reason="consent_audio_failed",
                    sip_status=read_sip_call_status(participant),
                )
                return

            pressed = False
            try:
                pressed = await dtmf_task
            except asyncio.CancelledError:
                pressed = False

            if pressed:
                consent_result = await _record_press_1_consent(
                    backend,
                    trace=trace,
                    session=session,
                    digit=str(session.get("consentDigit") or "1"),
                )
                trace.log(
                    "mctb_press_1_consent_recorded",
                    consentRecorded=consent_result.get("consentRecorded"),
                    duplicateConsent=consent_result.get("duplicateConsent"),
                    smsTriggered=consent_result.get("sms"),
                )
            else:
                trace.log(
                    "mctb_press_1_not_received",
                    consentDigit=session.get("consentDigit") or "1",
                )

        trace.log(
            "mctb_hold_started",
            holdSeconds=POST_FLOW_HOLD_SECONDS,
            note="post_flow_hold_before_disconnect",
            sipCallStatus=read_sip_call_status(participant),
            consentMode=consent_mode,
        )
        await asyncio.sleep(POST_FLOW_HOLD_SECONDS)
        trace.log(
            "mctb_hold_complete",
            holdSeconds=POST_FLOW_HOLD_SECONDS,
            sipCallStatus=read_sip_call_status(participant),
        )

        trace.log_sip_call_final_state(
            disconnect_reason="production_complete",
            sip_status=read_sip_call_status(participant) or SIP_CALL_STATUS_ACTIVE,
        )
        log_event(
            "mctb_sip_production_complete",
            call_id=trace.correlation_id,
            room=ctx.room.name,
            extra={
                "toE164": trace.to_e164,
                "fromE164": trace.from_e164,
                "forwardedFrom": session.get("forwardedFromE164") or trace.forwarded_from,
                "consentMode": consent_mode,
                "workspaceId": session.get("workspaceId"),
                "source": LOG_SOURCE,
            },
        )
    finally:
        if status_tracer is not None:
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
