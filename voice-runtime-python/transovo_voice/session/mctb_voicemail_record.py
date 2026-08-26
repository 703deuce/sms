"""Capture SIP caller audio during MCTB voicemail terminal phase."""

from __future__ import annotations

import asyncio
import shutil
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from livekit import rtc
from livekit.agents.voice import io as agents_io

from transovo_voice.session.sip_status import SIP_CALL_STATUS_HANGUP, read_sip_call_status

if TYPE_CHECKING:
    from livekit.agents import AgentSession

    from transovo_voice.integrations.backend_client import TransovoBackend
    from transovo_voice.session.mctb_sip_e2e_trace import MctbSipE2eTrace

DEFAULT_SAMPLE_RATE = 24_000
NUM_CHANNELS = 1
FRAME_SIZE_MS = 50
MAX_RECORD_SECONDS = 180.0
MIN_RECORD_SECONDS = 0.5
SILENCE_TAIL_SECONDS = 3.0
HANGUP_POLL_SECONDS = 0.25


@dataclass
class VoicemailRecordingResult:
    ok: bool
    message_id: str | None = None
    duration_seconds: float = 0.0
    pcm_bytes: int = 0
    encoded_bytes: int = 0
    error: str | None = None


class VoicemailAudioTap(agents_io.AudioInput):
    """Tee RoomIO participant audio frames for voicemail capture.

    Mirrors livekit.agents.voice.recorder_io.RecorderAudioInput — the supported
    way to record when AgentSession RoomIO already owns the SIP mic stream.
    """

    def __init__(self, source: agents_io.AudioInput) -> None:
        super().__init__(label="MctbVoicemailTap", source=source)
        self._audio_input = source
        self._frames: list[rtc.AudioFrame] = []

    def take_pcm(self) -> tuple[bytes, int, float]:
        if not self._frames:
            return b"", 0, 0.0

        sample_rate = self._frames[0].sample_rate or DEFAULT_SAMPLE_RATE
        channels = self._frames[0].num_channels or NUM_CHANNELS
        pcm = b"".join(bytes(frame.data) for frame in self._frames)
        duration_seconds = len(pcm) / (sample_rate * channels * 2)
        return pcm, len(self._frames), duration_seconds

    def on_attached(self) -> None:
        self._audio_input.on_attached()

    def on_detached(self) -> None:
        self._audio_input.on_detached()

    def __aiter__(self) -> AsyncIterator[rtc.AudioFrame]:
        return self

    async def __anext__(self) -> rtc.AudioFrame:
        frame = await self._audio_input.__anext__()
        self._frames.append(frame)
        return frame


def _pcm_duration_seconds(pcm: bytes, *, sample_rate: int = DEFAULT_SAMPLE_RATE) -> float:
    if not pcm:
        return 0.0
    return len(pcm) / (sample_rate * NUM_CHANNELS * 2)


async def _wait_for_hangup(
    participant: rtc.RemoteParticipant,
    *,
    stop_event: asyncio.Event,
    max_seconds: float,
) -> None:
    hangup_seen_at: float | None = None
    started = time.perf_counter()

    while not stop_event.is_set():
        if (time.perf_counter() - started) >= max_seconds:
            stop_event.set()
            return

        status = read_sip_call_status(participant)
        if status == SIP_CALL_STATUS_HANGUP:
            if hangup_seen_at is None:
                hangup_seen_at = time.perf_counter()
            elif (time.perf_counter() - hangup_seen_at) >= SILENCE_TAIL_SECONDS:
                stop_event.set()
                return
        else:
            hangup_seen_at = None

        await asyncio.sleep(HANGUP_POLL_SECONDS)


async def _collect_remote_audio_pcm_fallback(
    participant: rtc.RemoteParticipant,
    *,
    stop_event: asyncio.Event,
    max_seconds: float,
) -> tuple[bytes, int, float]:
    stream = rtc.AudioStream.from_participant(
        participant=participant,
        track_source=rtc.TrackSource.SOURCE_MICROPHONE,
        sample_rate=DEFAULT_SAMPLE_RATE,
        num_channels=NUM_CHANNELS,
        frame_size_ms=FRAME_SIZE_MS,
    )
    chunks: list[bytes] = []
    frame_count = 0
    started = time.perf_counter()

    try:
        async for event in stream:
            if stop_event.is_set():
                break
            frame = event.frame
            chunks.append(bytes(frame.data))
            frame_count += 1
            if (time.perf_counter() - started) >= max_seconds:
                break
    finally:
        await stream.aclose()

    pcm = b"".join(chunks)
    return pcm, frame_count, _pcm_duration_seconds(pcm)


async def _encode_pcm_to_mp3(pcm: bytes, *, sample_rate: int) -> bytes:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("ffmpeg_not_available_for_voicemail_encode")

    proc = await asyncio.create_subprocess_exec(
        ffmpeg,
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "s16le",
        "-ar",
        str(sample_rate),
        "-ac",
        "1",
        "-i",
        "pipe:0",
        "-f",
        "mp3",
        "-codec:a",
        "libmp3lame",
        "-q:a",
        "4",
        "pipe:1",
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate(input=pcm)
    if proc.returncode != 0:
        message = stderr.decode("utf-8", errors="replace").strip() or "ffmpeg_encode_failed"
        raise RuntimeError(message)
    if not stdout:
        raise RuntimeError("encoded_mp3_empty")
    return stdout


async def record_sip_voicemail_message(
    backend: "TransovoBackend",
    *,
    trace: "MctbSipE2eTrace",
    answer_session: "AgentSession",
    participant: rtc.RemoteParticipant,
    session: dict[str, Any],
    max_seconds: float = MAX_RECORD_SECONDS,
) -> VoicemailRecordingResult:
    workspace_id = str(session.get("workspaceId") or "").strip()
    if not workspace_id:
        return VoicemailRecordingResult(ok=False, error="missing_workspace_id")

    start_payload = await backend.call(
        "start_mctb_sip_voicemail",
        {
            "workspaceId": workspace_id,
            "callerE164": trace.from_e164,
            "transovoNumberE164": trace.to_e164,
            "providerCallId": trace.correlation_id,
            "livekitRoomName": trace.room_name,
            "forwardedFromE164": session.get("forwardedFromE164") or trace.forwarded_from,
        },
    )
    if not start_payload.get("ok"):
        return VoicemailRecordingResult(
            ok=False,
            error=str(start_payload.get("error") or "start_voicemail_failed"),
        )

    message_id = str(start_payload.get("messageId") or "").strip()
    if not message_id:
        return VoicemailRecordingResult(ok=False, error="missing_message_id")

    room_input = answer_session.input.audio
    capture_mode = "roomio_tap" if room_input is not None else "participant_stream"
    tap: VoicemailAudioTap | None = None
    previous_input = room_input

    trace.log(
        "mctb_voicemail_record_started",
        messageId=message_id,
        workspaceId=workspace_id,
        maxSeconds=max_seconds,
        captureMode=capture_mode,
        inputAudioLabel=getattr(room_input, "label", None),
    )

    stop_event = asyncio.Event()
    if room_input is not None:
        tap = VoicemailAudioTap(room_input)
        answer_session.input.audio = tap
        trace.log(
            "mctb_voicemail_record_tap_installed",
            messageId=message_id,
            previousInputLabel=getattr(previous_input, "label", None),
        )
        await _wait_for_hangup(participant, stop_event=stop_event, max_seconds=max_seconds)
    else:
        trace.log(
            "mctb_voicemail_record_fallback_started",
            messageId=message_id,
            note="roomio_audio_input_missing_using_from_participant",
        )
        hangup_task = asyncio.create_task(
            _wait_for_hangup(participant, stop_event=stop_event, max_seconds=max_seconds),
            name="mctb_voicemail_hangup_watch",
        )
        pcm, frame_count, duration_seconds = await _collect_remote_audio_pcm_fallback(
            participant,
            stop_event=stop_event,
            max_seconds=max_seconds,
        )
        await hangup_task
        trace.log(
            "mctb_voicemail_record_fallback_complete",
            messageId=message_id,
            frameCount=frame_count,
            durationSeconds=duration_seconds,
            pcmBytes=len(pcm),
        )
        if duration_seconds < MIN_RECORD_SECONDS or not pcm:
            trace.log(
                "mctb_voicemail_record_too_short",
                messageId=message_id,
                frameCount=frame_count,
                durationSeconds=duration_seconds,
                pcmBytes=len(pcm),
                captureMode=capture_mode,
            )
            return VoicemailRecordingResult(
                ok=False,
                message_id=message_id,
                duration_seconds=float(duration_seconds),
                pcm_bytes=len(pcm),
                error="recording_too_short",
            )
        try:
            encoded = await _encode_pcm_to_mp3(pcm, sample_rate=DEFAULT_SAMPLE_RATE)
        except Exception as err:
            trace.log(
                "mctb_voicemail_record_encode_failed",
                messageId=message_id,
                error=str(err),
            )
            return VoicemailRecordingResult(
                ok=False,
                message_id=message_id,
                duration_seconds=float(duration_seconds),
                pcm_bytes=len(pcm),
                error=str(err),
            )
        import base64

        complete_payload = await backend.call(
            "complete_mctb_sip_voicemail",
            {
                "workspaceId": workspace_id,
                "messageId": message_id,
                "audioBase64": base64.b64encode(encoded).decode("ascii"),
                "mimeType": "audio/mpeg",
                "durationSeconds": int(round(duration_seconds)),
                "providerCallId": trace.correlation_id,
            },
        )
        if not complete_payload.get("ok"):
            return VoicemailRecordingResult(
                ok=False,
                message_id=message_id,
                duration_seconds=float(duration_seconds),
                pcm_bytes=len(pcm),
                encoded_bytes=len(encoded),
                error=str(complete_payload.get("error") or "complete_voicemail_failed"),
            )
        trace.log(
            "mctb_voicemail_record_complete",
            messageId=message_id,
            durationSeconds=duration_seconds,
            frameCount=frame_count,
            encodedBytes=len(encoded),
            captureMode=capture_mode,
            transcriptStatus=complete_payload.get("transcriptStatus"),
            playbackUrl=complete_payload.get("playbackUrl"),
        )
        return VoicemailRecordingResult(
            ok=True,
            message_id=message_id,
            duration_seconds=float(duration_seconds),
            pcm_bytes=len(pcm),
            encoded_bytes=len(encoded),
        )

    answer_session.input.audio = previous_input
    pcm, frame_count, duration_seconds = tap.take_pcm() if tap is not None else (b"", 0, 0.0)
    trace.log(
        "mctb_voicemail_record_tap_complete",
        messageId=message_id,
        frameCount=frame_count,
        durationSeconds=duration_seconds,
        pcmBytes=len(pcm),
    )

    if duration_seconds < MIN_RECORD_SECONDS or not pcm:
        trace.log(
            "mctb_voicemail_record_too_short",
            messageId=message_id,
            frameCount=frame_count,
            durationSeconds=duration_seconds,
            pcmBytes=len(pcm),
            captureMode=capture_mode,
        )
        return VoicemailRecordingResult(
            ok=False,
            message_id=message_id,
            duration_seconds=float(duration_seconds),
            pcm_bytes=len(pcm),
            error="recording_too_short",
        )

    try:
        encoded = await _encode_pcm_to_mp3(pcm, sample_rate=DEFAULT_SAMPLE_RATE)
    except Exception as err:
        trace.log(
            "mctb_voicemail_record_encode_failed",
            messageId=message_id,
            error=str(err),
        )
        return VoicemailRecordingResult(
            ok=False,
            message_id=message_id,
            duration_seconds=float(duration_seconds),
            pcm_bytes=len(pcm),
            error=str(err),
        )

    import base64

    complete_payload = await backend.call(
        "complete_mctb_sip_voicemail",
        {
            "workspaceId": workspace_id,
            "messageId": message_id,
            "audioBase64": base64.b64encode(encoded).decode("ascii"),
            "mimeType": "audio/mpeg",
            "durationSeconds": int(round(duration_seconds)),
            "providerCallId": trace.correlation_id,
        },
    )

    if not complete_payload.get("ok"):
        return VoicemailRecordingResult(
            ok=False,
            message_id=message_id,
            duration_seconds=float(duration_seconds),
            pcm_bytes=len(pcm),
            encoded_bytes=len(encoded),
            error=str(complete_payload.get("error") or "complete_voicemail_failed"),
        )

    trace.log(
        "mctb_voicemail_record_complete",
        messageId=message_id,
        durationSeconds=duration_seconds,
        frameCount=frame_count,
        encodedBytes=len(encoded),
        captureMode=capture_mode,
        transcriptStatus=complete_payload.get("transcriptStatus"),
        playbackUrl=complete_payload.get("playbackUrl"),
    )

    return VoicemailRecordingResult(
        ok=True,
        message_id=message_id,
        duration_seconds=float(duration_seconds),
        pcm_bytes=len(pcm),
        encoded_bytes=len(encoded),
    )
