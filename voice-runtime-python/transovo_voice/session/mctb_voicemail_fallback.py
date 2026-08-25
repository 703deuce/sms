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


async def run_mctb_voicemail_fallback(
    ctx: "JobContext",
    *,
    trace: "MctbSipE2eTrace",
    participant: "rtc.RemoteParticipant",
    answer_session: Any,
    session: dict[str, Any],
    sip_status: str | None,
) -> None:
    play_url = str(session.get("voicemailPlayUrl") or "").strip()
    say_text = str(session.get("voicemailSayText") or "").strip()

    trace.log(
        "mctb_voicemail_fallback_started",
        workspaceId=session.get("workspaceId"),
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

    trace.log(
        "mctb_voicemail_record_hold_started",
        holdSeconds=VOICEMAIL_RECORD_HOLD_SECONDS,
        note="terminal_path_while_mctb_automation_suppressed",
        sipCallStatus=read_sip_call_status(participant),
    )
    await asyncio.sleep(VOICEMAIL_RECORD_HOLD_SECONDS)
    trace.log(
        "mctb_voicemail_record_hold_complete",
        holdSeconds=VOICEMAIL_RECORD_HOLD_SECONDS,
        sipCallStatus=read_sip_call_status(participant),
    )

    trace.log_sip_call_final_state(
        disconnect_reason="voicemail_fallback_complete",
        sip_status=read_sip_call_status(participant),
        handlingMode=session.get("handlingMode"),
    )
