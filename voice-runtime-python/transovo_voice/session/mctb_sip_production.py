"""MCTB 571 SIP production flow — layered on frozen answer/media sequence."""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING, Any

from transovo_voice.session.sip_status import SIP_CALL_STATUS_ACTIVE
from transovo_voice.session.sip_consent_audio import (
    play_confirmation_audio_url,
    play_consent_audio_url,
)
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
            "transovoNumberE164": trace.to_e164,
            "providerCallId": trace.correlation_id,
            "livekitRoomName": trace.room_name,
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

    session_task: asyncio.Task[dict[str, Any]] | None = None
    try:
        session_task = asyncio.create_task(
            _resolve_session(backend, trace=trace, participant=participant),
            name="mctb_session_resolve",
        )

        frozen = await run_frozen_sip_answer_sequence(
            ctx,
            trace=trace,
            participant=participant,
            room_already_connected=room_already_connected,
        )
        if frozen is None:
            if session_task is not None and not session_task.done():
                session_task.cancel()
                try:
                    await session_task
                except asyncio.CancelledError:
                    pass
            return
        answer_session, answer_task, status_tracer, sip_status = frozen

        participant_count = len(ctx.room.remote_participants) + 1
        trace.log_room_ready(created_new=False, participant_count=participant_count)

        session = await session_task
        session_task = None
        if not session.get("ok"):
            trace.log("mctb_session_resolve_failed", error=session.get("error"))
            trace.log_sip_call_final_state(
                disconnect_reason="session_resolve_failed",
                sip_status=read_sip_call_status(participant),
            )
            return

        handling_mode = str(session.get("handlingMode") or "mctb")
        mctb_automation_active = bool(session.get("mctbAutomationActive", True))
        if not mctb_automation_active or handling_mode == "voicemail_fallback":
            from transovo_voice.session.mctb_voicemail_fallback import run_mctb_voicemail_fallback

            await run_mctb_voicemail_fallback(
                backend,
                ctx,
                trace=trace,
                participant=participant,
                answer_session=answer_session,
                session=session,
                sip_status=sip_status,
            )
            return

        direct_dial_forward = str(session.get("directDialForwardE164") or "").strip()
        if direct_dial_forward:
            from transovo_voice.session.mctb_direct_dial_forward import run_mctb_direct_dial_forward

            forwarded = await run_mctb_direct_dial_forward(
                backend,
                ctx=ctx,
                trace=trace,
                participant=participant,
                answer_session=answer_session,
                session=session,
            )
            trace.log_sip_call_final_state(
                disconnect_reason="direct_dial_forward_complete" if forwarded else "direct_dial_forward_failed",
                sip_status=read_sip_call_status(participant),
                directDialForwardE164=direct_dial_forward,
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

        press_1_completed = False
        if consent_mode == "existing_consent":
            capture_task = asyncio.create_task(
                _capture_existing_consent_event(
                    backend,
                    trace=trace,
                    participant=participant,
                    session=session,
                ),
                name="mctb_existing_consent_capture",
            )
            from transovo_voice.session.mctb_voicemail_fallback import run_mctb_voicemail_terminal

            await run_mctb_voicemail_terminal(
                backend,
                ctx,
                trace=trace,
                participant=participant,
                answer_session=answer_session,
                session=session,
                sip_status=sip_status,
                terminal_reason="existing_consent",
                hold_note="terminal_path_after_existing_consent_capture",
                disconnect_reason="existing_consent_voicemail_complete",
            )
            try:
                capture = await capture_task
            except Exception as err:
                trace.log("mctb_existing_consent_capture_failed", error=str(err))
                capture = {"ok": False, "error": str(err)}
            trace.log(
                "mctb_existing_consent_captured",
                captureOk=capture.get("ok"),
                missedCallEventId=capture.get("missedCallEventId"),
                eligible=capture.get("eligible"),
                deduped=capture.get("deduped"),
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
            return
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
                consent_digit = str(session.get("consentDigit") or "1")
                trace.log(
                    "mctb_dtmf_validated",
                    digit=consent_digit,
                    participantIdentity=participant.identity,
                    sipCallStatus=read_sip_call_status(participant),
                )

                trace.log("consent_persist_start", providerCallId=trace.correlation_id)
                persist_task = asyncio.create_task(
                    _record_press_1_consent(
                        backend,
                        trace=trace,
                        session=session,
                        digit=consent_digit,
                    ),
                    name="mctb_consent_persist",
                )

                confirmation_url = str(session.get("confirmationPlayUrl") or "").strip()
                confirmation_task: asyncio.Task[Any] | None = None
                if confirmation_url:
                    confirmation_task = asyncio.create_task(
                        play_confirmation_audio_url(
                            ctx.room,
                            answer_session,
                            trace=trace,
                            sip_participant=participant,
                            sip_call_status=read_sip_call_status(participant),
                            play_url=confirmation_url,
                        ),
                        name="mctb_confirmation_audio",
                    )

                confirmation_result = None
                if confirmation_task is not None:
                    confirmation_result = await confirmation_task

                consent_result = await persist_task
                trace.log(
                    "consent_persist_complete",
                    consentRecorded=consent_result.get("consentRecorded"),
                    duplicateConsent=consent_result.get("duplicateConsent"),
                    durationNote="backend_round_trip",
                )

                sms_payload = consent_result.get("sms")
                if isinstance(sms_payload, dict) and sms_payload.get("scheduled"):
                    trace.log(
                        "sms_schedule_confirmed",
                        eligible=sms_payload.get("eligible"),
                        scheduled=sms_payload.get("scheduled"),
                        ok=sms_payload.get("ok"),
                    )

                trace.log(
                    "mctb_press_1_consent_recorded",
                    consentRecorded=consent_result.get("consentRecorded"),
                    duplicateConsent=consent_result.get("duplicateConsent"),
                    smsTriggered=sms_payload,
                    confirmationPlayed=bool(
                        confirmation_result is not None and confirmation_result.ok,
                    ),
                )

                if confirmation_result is not None and not confirmation_result.ok:
                    trace.log(
                        "confirmation_audio_publish_failed",
                        error=confirmation_result.error,
                        playUrl=confirmation_url,
                    )
                press_1_completed = True
            else:
                trace.log(
                    "mctb_press_1_not_received",
                    consentDigit=session.get("consentDigit") or "1",
                )

        if not press_1_completed:
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
        if session_task is not None and not session_task.done():
            session_task.cancel()
            try:
                await session_task
            except asyncio.CancelledError:
                pass
            except Exception:
                pass
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
