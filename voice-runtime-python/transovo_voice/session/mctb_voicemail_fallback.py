"""Voicemail fallback when MCTB automation is paused or disabled."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from transovo_voice.session.sip_consent_audio import play_consent_audio_url
from transovo_voice.session.sip_status import read_sip_call_status
from transovo_voice.session.sip_voicemail_recorder import record_sip_voicemail_audio

if TYPE_CHECKING:
    from livekit.agents import JobContext
    from livekit import rtc
    from transovo_voice.integrations.backend_client import TransovoBackend
    from transovo_voice.session.mctb_sip_e2e_trace import MctbSipE2eTrace


async def run_mctb_voicemail_fallback(
    ctx: "JobContext",
    backend: "TransovoBackend",
    *,
    trace: "MctbSipE2eTrace",
    participant: "rtc.RemoteParticipant",
    answer_session: Any,
    session: dict[str, Any],
    sip_status: str | None,
) -> None:
    workspace_id = str(session.get("workspaceId") or "").strip()
    transovo_number = str(trace.to_e164 or session.get("transovoNumberE164") or "").strip()
    caller_e164 = str(trace.from_e164 or "").strip()
    customer_business = session.get("forwardedFromE164") or trace.forwarded_from

    begin = await backend.call(
        "begin_mctb_sip_voicemail",
        {
            "workspaceId": workspace_id,
            "transovoNumberE164": transovo_number,
            "callerE164": caller_e164,
            "providerCallId": trace.correlation_id,
            "livekitRoomName": trace.room_name,
            "customerBusinessE164": customer_business,
        },
    )

    if not begin.get("ok"):
        trace.log(
            "mctb_voicemail_begin_failed",
            error=begin.get("error"),
            workspaceId=workspace_id,
        )
        trace.log_sip_call_final_state(
            disconnect_reason="voicemail_begin_failed",
            sip_status=read_sip_call_status(participant),
            handlingMode=session.get("handlingMode"),
        )
        return

    message_id = str(begin.get("messageId") or "")
    play_url = str(begin.get("voicemailPlayUrl") or session.get("voicemailPlayUrl") or "").strip()
    say_text = str(begin.get("voicemailSayText") or session.get("voicemailSayText") or "").strip()

    trace.log(
        "mctb_voicemail_fallback_started",
        workspaceId=workspace_id,
        messageId=message_id,
        mctbAutomationActive=session.get("mctbAutomationActive"),
        handlingMode=session.get("handlingMode"),
        hasPlayUrl=bool(play_url),
        hasSayText=bool(say_text),
    )

    if play_url:
        audio_result = await play_consent_audio_url(
            ctx.room,
            answer_session,
            trace=trace,
            sip_participant=participant,
            sip_call_status=sip_status,
            play_url=play_url,
        )
        if audio_result.ok and audio_result.frames_written > 0:
            trace.log(
                "mctb_voicemail_greeting_played",
                framesWritten=audio_result.frames_written,
                durationMs=audio_result.playback_duration_ms,
            )
        else:
            trace.log(
                "mctb_voicemail_greeting_failed",
                error=audio_result.error or "no_frames_published",
            )
    elif say_text:
        trace.log(
            "mctb_voicemail_greeting_missing_audio",
            sayTextPreview=say_text[:80],
            note="no_play_url_available_for_voicemail_greeting",
        )

    record_result = await record_sip_voicemail_audio(
        participant=participant,
        answer_session=answer_session,
        trace=trace,
    )

    if not record_result.ok or not record_result.audio_base64:
        trace.log(
            "mctb_voicemail_record_failed",
            error=record_result.error or "empty_recording",
            framesCaptured=record_result.frames_captured,
        )
        trace.log_sip_call_final_state(
            disconnect_reason="voicemail_record_failed",
            sip_status=read_sip_call_status(participant),
            handlingMode=session.get("handlingMode"),
            messageId=message_id,
        )
        return

    finalize = await backend.call(
        "finalize_mctb_sip_voicemail",
        {
            "workspaceId": workspace_id,
            "messageId": message_id,
            "audioBase64": record_result.audio_base64,
            "mimeType": record_result.mime_type,
            "durationSeconds": round(record_result.duration_seconds, 2),
            "sampleRate": record_result.sample_rate,
        },
    )

    trace.log(
        "mctb_voicemail_finalize_complete",
        ok=finalize.get("ok"),
        messageId=message_id,
        durationSeconds=record_result.duration_seconds,
        transcribeQueued=finalize.get("transcribeQueued"),
        error=finalize.get("error"),
    )

    trace.log_sip_call_final_state(
        disconnect_reason="voicemail_fallback_complete",
        sip_status=read_sip_call_status(participant),
        handlingMode=session.get("handlingMode"),
        messageId=message_id,
        recordingPersisted=bool(finalize.get("ok")),
    )
