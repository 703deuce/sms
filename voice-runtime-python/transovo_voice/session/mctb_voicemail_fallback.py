"""Voicemail fallback when MCTB automation is paused or disabled."""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING, Any

from transovo_voice.session.sip_consent_audio import play_consent_audio_url
from transovo_voice.session.sip_status import read_sip_call_status

if TYPE_CHECKING:
    from livekit.agents import JobContext
    from livekit import rtc
    from transovo_voice.integrations.backend_client import TransovoBackend
    from transovo_voice.session.mctb_sip_e2e_trace import MctbSipE2eTrace

VOICEMAIL_RECORD_HOLD_SECONDS = 45.0


async def run_mctb_voicemail_terminal(
    ctx: "JobContext",
    *,
    trace: "MctbSipE2eTrace",
    participant: "rtc.RemoteParticipant",
    answer_session: Any,
    session: dict[str, Any],
    sip_status: str | None,
    terminal_reason: str,
    hold_note: str,
    disconnect_reason: str,
) -> None:
    play_url = str(session.get("voicemailPlayUrl") or "").strip()
    say_text = str(session.get("voicemailSayText") or "").strip()

    trace.log(
        "mctb_voicemail_terminal_started",
        terminalReason=terminal_reason,
        workspaceId=session.get("workspaceId"),
        mctbAutomationActive=session.get("mctbAutomationActive"),
        handlingMode=session.get("handlingMode"),
        consentMode=session.get("consentMode"),
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
                terminalReason=terminal_reason,
                framesWritten=audio_result.frames_written,
                durationMs=audio_result.playback_duration_ms,
            )
        else:
            trace.log(
                "mctb_voicemail_greeting_failed",
                terminalReason=terminal_reason,
                error=audio_result.error or "no_frames_published",
            )
    elif say_text:
        trace.log(
            "mctb_voicemail_greeting_missing_audio",
            terminalReason=terminal_reason,
            sayTextPreview=say_text[:80],
            note="no_play_url_available_for_voicemail_greeting",
        )

    trace.log(
        "mctb_voicemail_record_hold_started",
        terminalReason=terminal_reason,
        holdSeconds=VOICEMAIL_RECORD_HOLD_SECONDS,
        note=hold_note,
        sipCallStatus=read_sip_call_status(participant),
    )
    await asyncio.sleep(VOICEMAIL_RECORD_HOLD_SECONDS)
    trace.log(
        "mctb_voicemail_record_hold_complete",
        terminalReason=terminal_reason,
        holdSeconds=VOICEMAIL_RECORD_HOLD_SECONDS,
        sipCallStatus=read_sip_call_status(participant),
    )

    trace.log_sip_call_final_state(
        disconnect_reason=disconnect_reason,
        sip_status=read_sip_call_status(participant),
        handlingMode=session.get("handlingMode"),
        terminalReason=terminal_reason,
    )


async def run_mctb_voicemail_fallback(
    ctx: "JobContext",
    *,
    trace: "MctbSipE2eTrace",
    participant: "rtc.RemoteParticipant",
    answer_session: Any,
    session: dict[str, Any],
    sip_status: str | None,
) -> None:
    trace.log(
        "mctb_voicemail_fallback_started",
        workspaceId=session.get("workspaceId"),
        mctbAutomationActive=session.get("mctbAutomationActive"),
        handlingMode=session.get("handlingMode"),
        hasPlayUrl=bool(str(session.get("voicemailPlayUrl") or "").strip()),
        hasSayText=bool(str(session.get("voicemailSayText") or "").strip()),
    )
    await run_mctb_voicemail_terminal(
        ctx,
        trace=trace,
        participant=participant,
        answer_session=answer_session,
        session=session,
        sip_status=sip_status,
        terminal_reason="automation_suppressed",
        hold_note="terminal_path_while_mctb_automation_suppressed",
        disconnect_reason="voicemail_fallback_complete",
    )
