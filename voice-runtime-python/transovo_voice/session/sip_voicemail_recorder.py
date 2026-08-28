"""Capture caller audio from LiveKit SIP participant for MCTB voicemail fallback."""

from __future__ import annotations

import array
import asyncio
import base64
import io
import math
import struct
import time
import wave
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from livekit import rtc

if TYPE_CHECKING:
    from transovo_voice.session.mctb_sip_e2e_trace import MctbSipE2eTrace

DEFAULT_SAMPLE_RATE = 24_000
NUM_CHANNELS = 1
BEEP_FREQUENCY_HZ = 880
BEEP_DURATION_S = 0.35
BEEP_AMPLITUDE = 0.6
SILENCE_THRESHOLD_MS = 2500
MAX_RECORD_SECONDS = 120.0
MIN_RECORD_SECONDS = 1.0


@dataclass
class SipVoicemailRecordResult:
    ok: bool
    audio_base64: str | None = None
    duration_seconds: float = 0.0
    sample_rate: int = DEFAULT_SAMPLE_RATE
    mime_type: str = "audio/wav"
    frames_captured: int = 0
    error: str | None = None


def _find_remote_audio_track(participant: rtc.RemoteParticipant) -> rtc.Track | None:
    for publication in participant.track_publications.values():
        if publication.kind != rtc.TrackKind.KIND_AUDIO:
            continue
        track = publication.track
        if track is not None:
            return track
    return None


def _pcm16_to_wav_bytes(pcm: bytes, *, sample_rate: int, channels: int) -> bytes:
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm)
    return buffer.getvalue()


async def _play_beep(
    answer_session: Any,
    *,
    sample_rate: int,
    trace: "MctbSipE2eTrace",
) -> None:
    audio_output = getattr(getattr(answer_session, "output", None), "audio", None)
    if audio_output is None:
        trace.log("mctb_voicemail_beep_skipped", reason="roomio_audio_output_missing")
        return

    samples_per_frame = max(1, sample_rate // 100)
    frame_count_target = max(1, int(BEEP_DURATION_S * sample_rate / samples_per_frame))
    frame = rtc.AudioFrame.create(sample_rate, NUM_CHANNELS, samples_per_frame)
    audio_data = memoryview(frame.data)
    phase = 0.0

    for _ in range(frame_count_target):
        samples = [
            int(
                32767
                * BEEP_AMPLITUDE
                * math.sin(2 * math.pi * BEEP_FREQUENCY_HZ * (phase + i) / sample_rate),
            )
            for i in range(samples_per_frame)
        ]
        audio_data[:] = array.array("h", samples)
        phase += samples_per_frame
        await audio_output.capture_frame(frame)

    audio_output.flush()
    await asyncio.wait_for(audio_output.wait_for_playout(), timeout=BEEP_DURATION_S + 2.0)
    trace.log("mctb_voicemail_beep_played", durationMs=int(BEEP_DURATION_S * 1000))


async def record_sip_voicemail_audio(
    *,
    participant: rtc.RemoteParticipant,
    answer_session: Any,
    trace: "MctbSipE2eTrace",
    max_seconds: float = MAX_RECORD_SECONDS,
    silence_ms: int = SILENCE_THRESHOLD_MS,
) -> SipVoicemailRecordResult:
    track = _find_remote_audio_track(participant)
    if track is None:
        return SipVoicemailRecordResult(ok=False, error="remote_audio_track_missing")

    sample_rate = DEFAULT_SAMPLE_RATE
    stream = rtc.AudioStream(track, sample_rate=sample_rate, num_channels=NUM_CHANNELS)
    pcm_chunks: list[bytes] = []
    frames_captured = 0
    started = time.perf_counter()
    last_voice_at = started

    trace.log(
        "mctb_voicemail_record_started",
        maxSeconds=max_seconds,
        silenceMs=silence_ms,
        trackSid=getattr(track, "sid", None),
    )

    try:
        await _play_beep(answer_session, sample_rate=sample_rate, trace=trace)

        async def _capture() -> None:
            nonlocal frames_captured, last_voice_at
            async for event in stream:
                frame = event.frame
                frames_captured += 1
                raw = bytes(frame.data)
                pcm_chunks.append(raw)
                samples = struct.unpack(f"<{len(raw) // 2}h", raw)
                peak = max((abs(s) for s in samples), default=0)
                if peak > 800:
                    last_voice_at = time.perf_counter()

        capture_task = asyncio.create_task(_capture(), name="mctb_voicemail_capture")

        while True:
            elapsed = time.perf_counter() - started
            since_voice = time.perf_counter() - last_voice_at
            if elapsed >= max_seconds:
                break
            if elapsed >= MIN_RECORD_SECONDS and since_voice * 1000 >= silence_ms:
                break
            if participant.disconnect_reason is not None:
                break
            await asyncio.sleep(0.1)

        capture_task.cancel()
        try:
            await capture_task
        except asyncio.CancelledError:
            pass

        pcm = b"".join(pcm_chunks)
        if not pcm:
            return SipVoicemailRecordResult(ok=False, error="no_audio_captured", frames_captured=frames_captured)

        wav_bytes = _pcm16_to_wav_bytes(pcm, sample_rate=sample_rate, channels=NUM_CHANNELS)
        duration_seconds = len(pcm) / (sample_rate * NUM_CHANNELS * 2)

        trace.log(
            "mctb_voicemail_record_complete",
            framesCaptured=frames_captured,
            durationSeconds=round(duration_seconds, 2),
            wavBytes=len(wav_bytes),
        )

        return SipVoicemailRecordResult(
            ok=True,
            audio_base64=base64.b64encode(wav_bytes).decode("ascii"),
            duration_seconds=duration_seconds,
            sample_rate=sample_rate,
            mime_type="audio/wav",
            frames_captured=frames_captured,
        )
    except Exception as err:
        trace.log("mctb_voicemail_record_failed", error=str(err))
        return SipVoicemailRecordResult(ok=False, error=str(err), frames_captured=frames_captured)
    finally:
        await stream.aclose()
