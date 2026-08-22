"""Raw PCM diagnostic tone for MCTB 571 SIP — no TTS, no OpenAI."""

from __future__ import annotations

import array
import asyncio
import math
import time
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from livekit import rtc

if TYPE_CHECKING:
    from livekit.agents import AgentSession

    from transovo_voice.session.mctb_sip_e2e_trace import MctbSipE2eTrace

DEFAULT_SAMPLE_RATE = 24_000
NUM_CHANNELS = 1
TONE_FREQUENCY_HZ = 1_000
TONE_DURATION_S = 2.0
TONE_AMPLITUDE = 0.8


@dataclass
class SipDiagnosticAudioResult:
    ok: bool
    frames_written: int = 0
    first_frame_sent_ms: int | None = None
    playback_duration_ms: int = 0
    track_sid: str | None = None
    publication_sid: str | None = None
    sample_rate: int = DEFAULT_SAMPLE_RATE
    channels: int = NUM_CHANNELS
    frequency_hz: int = TONE_FREQUENCY_HZ
    error: str | None = None


@dataclass
class _ToneGenerator:
    sample_rate: int
    frequency_hz: int
    phase: float = 0.0

    def fill_frame(self, audio_data: memoryview, samples_per_channel: int) -> None:
        samples = [
            int(
                32767
                * TONE_AMPLITUDE
                * math.sin(
                    2 * math.pi * self.frequency_hz * (self.phase + i) / self.sample_rate,
                ),
            )
            for i in range(samples_per_channel)
        ]
        audio_data[:] = array.array("h", samples)
        self.phase += samples_per_channel


def _samples_per_frame(sample_rate: int) -> int:
    return max(1, sample_rate // 100)


def _common_log_fields(
    *,
    trace: "MctbSipE2eTrace",
    sip_participant: rtc.RemoteParticipant,
    sip_call_status: str | None,
    track_sid: str | None = None,
    sample_rate: int | None = None,
    channels: int | None = None,
    frame_count: int | None = None,
    duration_ms: int | None = None,
) -> dict[str, Any]:
    fields: dict[str, Any] = {
        "participantId": sip_participant.sid,
        "participantIdentity": sip_participant.identity,
        "roomSid": trace.room_sid,
        "roomName": trace.room_name,
        "sipCallStatus": sip_call_status,
    }
    if track_sid is not None:
        fields["trackSid"] = track_sid
    if sample_rate is not None:
        fields["sampleRate"] = sample_rate
    if channels is not None:
        fields["channels"] = channels
    if frame_count is not None:
        fields["frameCount"] = frame_count
    if duration_ms is not None:
        fields["durationMs"] = duration_ms
    return fields


def _find_local_audio_publication(room: rtc.Room) -> rtc.LocalTrackPublication | None:
    local = room.local_participant
    if local is None:
        return None
    for publication in local.track_publications.values():
        if publication.kind == rtc.TrackKind.KIND_AUDIO:
            return publication
    return None


async def play_diagnostic_tone(
    room: rtc.Room,
    answer_session: "AgentSession",
    *,
    trace: "MctbSipE2eTrace",
    sip_participant: rtc.RemoteParticipant,
    sip_call_status: str | None,
    duration_s: float = TONE_DURATION_S,
    frequency_hz: int = TONE_FREQUENCY_HZ,
) -> SipDiagnosticAudioResult:
    """
    Push a deterministic PCM tone through the existing RoomIO audio output.

    The answer path has already published the RoomIO audio track; this only
  captures frames into that track after sip.callStatus is active.
    """
    started = time.perf_counter()
    result = SipDiagnosticAudioResult(ok=False, frequency_hz=frequency_hz)
    audio_output = answer_session.output.audio
    if audio_output is None:
        result.error = "roomio_audio_output_missing"
        trace.log(
            "diagnostic_audio_publish_failed",
            error=result.error,
            **_common_log_fields(
                trace=trace,
                sip_participant=sip_participant,
                sip_call_status=sip_call_status,
            ),
        )
        return result

    sample_rate = audio_output.sample_rate or DEFAULT_SAMPLE_RATE
    result.sample_rate = sample_rate
    result.channels = NUM_CHANNELS
    samples_per_frame = _samples_per_frame(sample_rate)
    frame_count_target = max(1, int(duration_s * sample_rate / samples_per_frame))

    publication = _find_local_audio_publication(room)
    if publication is not None:
        result.publication_sid = publication.sid
        track = publication.track
        result.track_sid = track.sid if track is not None else None

    trace.log(
        "diagnostic_audio_source_created",
        playbackMethod="roomio_capture_frame",
        frequencyHz=frequency_hz,
        targetFrames=frame_count_target,
        samplesPerFrame=samples_per_frame,
        **_common_log_fields(
            trace=trace,
            sip_participant=sip_participant,
            sip_call_status=sip_call_status,
            track_sid=result.track_sid,
            sample_rate=sample_rate,
            channels=NUM_CHANNELS,
        ),
    )

    if publication is None or result.track_sid is None:
        result.error = "roomio_audio_track_not_published"
        trace.log(
            "diagnostic_audio_publish_failed",
            error=result.error,
            **_common_log_fields(
                trace=trace,
                sip_participant=sip_participant,
                sip_call_status=sip_call_status,
                sample_rate=sample_rate,
                channels=NUM_CHANNELS,
            ),
        )
        return result

    trace.log(
        "diagnostic_audio_track_published",
        publicationSid=result.publication_sid,
        publicationName=publication.name,
        publicationMuted=publication.muted,
        note="existing_roomio_track_from_answer_path",
        **_common_log_fields(
            trace=trace,
            sip_participant=sip_participant,
            sip_call_status=sip_call_status,
            track_sid=result.track_sid,
            sample_rate=sample_rate,
            channels=NUM_CHANNELS,
        ),
    )

    frame = rtc.AudioFrame.create(sample_rate, NUM_CHANNELS, samples_per_frame)
    audio_data = memoryview(frame.data)
    tone = _ToneGenerator(sample_rate, frequency_hz)

    try:
        for _frame_index in range(frame_count_target):
            tone.fill_frame(audio_data, samples_per_frame)
            await audio_output.capture_frame(frame)
            result.frames_written += 1
            if result.frames_written == 1:
                result.first_frame_sent_ms = int((time.perf_counter() - started) * 1000)
                trace.log(
                    "diagnostic_audio_first_frame_sent",
                    frameIndex=0,
                    samplesPerFrame=samples_per_frame,
                    **_common_log_fields(
                        trace=trace,
                        sip_participant=sip_participant,
                        sip_call_status=sip_call_status,
                        track_sid=result.track_sid,
                        sample_rate=sample_rate,
                        channels=NUM_CHANNELS,
                        duration_ms=result.first_frame_sent_ms,
                    ),
                )

        audio_output.flush()
        await asyncio.wait_for(audio_output.wait_for_playout(), timeout=duration_s + 5.0)
        result.playback_duration_ms = int((time.perf_counter() - started) * 1000)
        result.ok = result.frames_written > 0

        trace.log(
            "diagnostic_audio_frames_sent",
            framesWritten=result.frames_written,
            frequencyHz=frequency_hz,
            **_common_log_fields(
                trace=trace,
                sip_participant=sip_participant,
                sip_call_status=sip_call_status,
                track_sid=result.track_sid,
                sample_rate=sample_rate,
                channels=NUM_CHANNELS,
                frame_count=result.frames_written,
                duration_ms=result.playback_duration_ms,
            ),
        )

        if result.ok:
            trace.log(
                "diagnostic_audio_playback_complete",
                frequencyHz=frequency_hz,
                **_common_log_fields(
                    trace=trace,
                    sip_participant=sip_participant,
                    sip_call_status=sip_call_status,
                    track_sid=result.track_sid,
                    sample_rate=sample_rate,
                    channels=NUM_CHANNELS,
                    frame_count=result.frames_written,
                    duration_ms=result.playback_duration_ms,
                ),
            )
        return result

    except Exception as err:
        result.error = str(err)
        trace.log(
            "diagnostic_audio_publish_failed",
            error=result.error,
            framesWritten=result.frames_written,
            **_common_log_fields(
                trace=trace,
                sip_participant=sip_participant,
                sip_call_status=sip_call_status,
                track_sid=result.track_sid,
                sample_rate=sample_rate,
                channels=NUM_CHANNELS,
                frame_count=result.frames_written,
            ),
        )
        return result
