"""Capture SIP caller audio during MCTB voicemail terminal phase."""

from __future__ import annotations

import asyncio
import base64
import shutil
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Literal

from livekit import rtc
from livekit.agents.voice import io as agents_io

from transovo_voice.build_identity import get_voice_build_identity
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
FRAME_HEARTBEAT_SECONDS = 2.0

StopReason = Literal[
    "caller_hangup",
    "participant_disconnected",
    "room_disconnected",
    "max_duration",
    "manual_stop",
    "error",
    "unknown",
]


@dataclass
class VoicemailRecordingResult:
    ok: bool
    message_id: str | None = None
    duration_seconds: float = 0.0
    pcm_bytes: int = 0
    encoded_bytes: int = 0
    error: str | None = None
    stop_reason: str | None = None


@dataclass
class _FinalizeState:
    message_id: str
    workspace_id: str
    capture_mode: str
    pcm: bytes = b""
    frame_count: int = 0
    duration_seconds: float = 0.0
    encoded: bytes = b""
    stop_reason: StopReason = "unknown"
    finalize_started: bool = False
    finalize_completed: bool = False
    complete_called: bool = False
    error: str | None = None


class VoicemailAudioTap(agents_io.AudioInput):
    """Tee RoomIO participant audio frames for voicemail capture."""

    def __init__(self, source: agents_io.AudioInput) -> None:
        super().__init__(label="MctbVoicemailTap", source=source)
        self._audio_input = source
        self._frames: list[rtc.AudioFrame] = []
        self.first_frame_at: float | None = None
        self.last_frame_at: float | None = None

    @property
    def frame_count(self) -> int:
        return len(self._frames)

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
        now = time.perf_counter()
        if self.first_frame_at is None:
            self.first_frame_at = now
        self.last_frame_at = now
        self._frames.append(frame)
        return frame


class VoicemailLifecycle:
    def __init__(
        self,
        backend: "TransovoBackend",
        trace: "MctbSipE2eTrace",
        *,
        workspace_id: str,
        message_id: str,
        provider_call_id: str,
    ) -> None:
        self._backend = backend
        self._trace = trace
        self._workspace_id = workspace_id
        self._message_id = message_id
        self._provider_call_id = provider_call_id
        self._build = get_voice_build_identity()

    async def emit(self, event: str, **payload: Any) -> None:
        fields = {
            "messageId": self._message_id,
            "workspaceId": self._workspace_id,
            "providerCallId": self._provider_call_id,
            "buildSha": self._build.get("buildSha"),
            "imageTag": self._build.get("imageTag"),
            **payload,
        }
        self._trace.log(event, **fields)
        try:
            await self._backend.call(
                "persist_mctb_voicemail_lifecycle",
                {
                    "workspaceId": self._workspace_id,
                    "messageId": self._message_id,
                    "providerCallId": self._provider_call_id,
                    "buildSha": self._build.get("buildSha"),
                    "event": event,
                    "payload": payload,
                },
            )
        except Exception as err:
            self._trace.log(
                "mctb_voicemail_lifecycle_persist_failed",
                messageId=self._message_id,
                lifecycleEvent=event,
                error=str(err),
            )


def _pcm_duration_seconds(pcm: bytes, *, sample_rate: int = DEFAULT_SAMPLE_RATE) -> float:
    if not pcm:
        return 0.0
    return len(pcm) / (sample_rate * NUM_CHANNELS * 2)


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


async def _collect_remote_audio_pcm_fallback(
    participant: rtc.RemoteParticipant,
    *,
    stop_event: asyncio.Event,
    max_seconds: float,
    lifecycle: VoicemailLifecycle,
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
            if frame_count == 1:
                await lifecycle.emit("first_audio_frame", frameCount=1, captureMode="participant_stream")
            if frame_count % 50 == 0:
                await lifecycle.emit(
                    "frame_progress",
                    frameCount=frame_count,
                    elapsedSeconds=round(time.perf_counter() - started, 2),
                    captureMode="participant_stream",
                )
            if (time.perf_counter() - started) >= max_seconds:
                break
    finally:
        await stream.aclose()

    pcm = b"".join(chunks)
    return pcm, frame_count, _pcm_duration_seconds(pcm)


async def _wait_for_hangup(
    participant: rtc.RemoteParticipant,
    *,
    stop_event: asyncio.Event,
    max_seconds: float,
    lifecycle: VoicemailLifecycle,
    stop_reason_holder: dict[str, StopReason],
) -> None:
    hangup_seen_at: float | None = None
    started = time.perf_counter()

    while not stop_event.is_set():
        if (time.perf_counter() - started) >= max_seconds:
            stop_reason_holder["reason"] = "max_duration"
            stop_event.set()
            await lifecycle.emit("max_duration_reached", maxSeconds=max_seconds)
            return

        status = read_sip_call_status(participant)
        if status == SIP_CALL_STATUS_HANGUP:
            if hangup_seen_at is None:
                hangup_seen_at = time.perf_counter()
                await lifecycle.emit("caller_hangup_detected", sipCallStatus=status)
            elif (time.perf_counter() - hangup_seen_at) >= SILENCE_TAIL_SECONDS:
                stop_reason_holder["reason"] = "caller_hangup"
                stop_event.set()
                await lifecycle.emit(
                    "caller_hangup_tail_complete",
                    tailSeconds=SILENCE_TAIL_SECONDS,
                )
                return
        else:
            hangup_seen_at = None

        await asyncio.sleep(HANGUP_POLL_SECONDS)


async def _wait_for_recording_stop(
    room: rtc.Room,
    participant: rtc.RemoteParticipant,
    *,
    stop_event: asyncio.Event,
    max_seconds: float,
    lifecycle: VoicemailLifecycle,
) -> StopReason:
    stop_reason_holder: dict[str, StopReason] = {"reason": "unknown"}
    pending_events: list[tuple[str, dict[str, Any]]] = []

    def _mark(reason: StopReason, event: str, **fields: Any) -> None:
        if stop_event.is_set():
            return
        stop_reason_holder["reason"] = reason
        stop_event.set()
        pending_events.append((event, fields))

    def on_participant_disconnected(p: rtc.Participant) -> None:
        if p.sid != participant.sid:
            return
        _mark("participant_disconnected", "participant_disconnected", participantSid=p.sid)

    def on_connection_state_changed(state: rtc.ConnectionState) -> None:
        if state == rtc.ConnectionState.CONN_DISCONNECTED:
            _mark("room_disconnected", "room_disconnected", connectionState=str(state))

    room.on("participant_disconnected", on_participant_disconnected)
    room.on("connection_state_changed", on_connection_state_changed)

    hangup_task = asyncio.create_task(
        _wait_for_hangup(
            participant,
            stop_event=stop_event,
            max_seconds=max_seconds,
            lifecycle=lifecycle,
            stop_reason_holder=stop_reason_holder,
        ),
        name="mctb_voicemail_hangup_watch",
    )

    try:
        await stop_event.wait()
    finally:
        hangup_task.cancel()
        try:
            await hangup_task
        except asyncio.CancelledError:
            pass
        room.off("participant_disconnected", on_participant_disconnected)
        room.off("connection_state_changed", on_connection_state_changed)

    for event, fields in pending_events:
        await lifecycle.emit(event, stopReason=stop_reason_holder["reason"], **fields)

    return stop_reason_holder["reason"]


async def _frame_heartbeat(
    tap: VoicemailAudioTap,
    *,
    stop_event: asyncio.Event,
    lifecycle: VoicemailLifecycle,
) -> None:
    last_count = 0
    while not stop_event.is_set():
        await asyncio.sleep(FRAME_HEARTBEAT_SECONDS)
        if stop_event.is_set():
            break
        count = tap.frame_count
        if count == 0 and last_count == 0:
            await lifecycle.emit("frame_heartbeat", frameCount=0, note="no_frames_yet")
        elif count > last_count:
            if last_count == 0:
                await lifecycle.emit(
                    "first_audio_frame",
                    frameCount=count,
                    captureMode="roomio_tap",
                )
            await lifecycle.emit(
                "frame_progress",
                frameCount=count,
                captureMode="roomio_tap",
                firstFrameLagMs=int((tap.first_frame_at or 0) * 1000) if tap.first_frame_at else None,
            )
        last_count = count


async def _emergency_collect_pcm(
    participant: rtc.RemoteParticipant,
    *,
    lifecycle: VoicemailLifecycle,
) -> tuple[bytes, int, float]:
    stop_event = asyncio.Event()
    await lifecycle.emit("emergency_collect_started", note="tap_had_zero_frames")
    pcm, frame_count, duration = await _collect_remote_audio_pcm_fallback(
        participant,
        stop_event=stop_event,
        max_seconds=2.0,
        lifecycle=lifecycle,
    )
    await lifecycle.emit(
        "emergency_collect_complete",
        frameCount=frame_count,
        pcmBytes=len(pcm),
        durationSeconds=duration,
    )
    return pcm, frame_count, duration


async def _finalize_recording(
    backend: "TransovoBackend",
    trace: "MctbSipE2eTrace",
    lifecycle: VoicemailLifecycle,
    state: _FinalizeState,
) -> VoicemailRecordingResult:
    if state.finalize_started:
        return VoicemailRecordingResult(
            ok=False,
            message_id=state.message_id,
            error=state.error or "finalize_already_started",
            stop_reason=state.stop_reason,
        )

    state.finalize_started = True
    await lifecycle.emit(
        "finalize_started",
        stopReason=state.stop_reason,
        frameCount=state.frame_count,
        pcmBytes=len(state.pcm),
        captureMode=state.capture_mode,
    )

    try:
        if state.frame_count == 0 or not state.pcm:
            state.error = "recording_too_short"
            await lifecycle.emit(
                "recording_too_short",
                frameCount=state.frame_count,
                pcmBytes=len(state.pcm),
                durationSeconds=state.duration_seconds,
                stopReason=state.stop_reason,
            )
            return VoicemailRecordingResult(
                ok=False,
                message_id=state.message_id,
                duration_seconds=state.duration_seconds,
                pcm_bytes=len(state.pcm),
                error=state.error,
                stop_reason=state.stop_reason,
            )

        await lifecycle.emit("encode_started", pcmBytes=len(state.pcm))
        try:
            state.encoded = await _encode_pcm_to_mp3(state.pcm, sample_rate=DEFAULT_SAMPLE_RATE)
        except Exception as err:
            state.error = str(err)
            await lifecycle.emit("encode_failed", error=state.error)
            return VoicemailRecordingResult(
                ok=False,
                message_id=state.message_id,
                duration_seconds=state.duration_seconds,
                pcm_bytes=len(state.pcm),
                error=state.error,
                stop_reason=state.stop_reason,
            )
        await lifecycle.emit("encode_completed", encodedBytes=len(state.encoded))

        await lifecycle.emit("upload_started", encodedBytes=len(state.encoded))
        state.complete_called = True
        complete_payload = await backend.call(
            "complete_mctb_sip_voicemail",
            {
                "workspaceId": state.workspace_id,
                "messageId": state.message_id,
                "audioBase64": base64.b64encode(state.encoded).decode("ascii"),
                "mimeType": "audio/mpeg",
                "durationSeconds": int(round(state.duration_seconds)),
                "providerCallId": trace.correlation_id,
            },
        )
        if not complete_payload.get("ok"):
            state.error = str(complete_payload.get("error") or "complete_voicemail_failed")
            await lifecycle.emit("complete_rejected", error=state.error, response=complete_payload)
            return VoicemailRecordingResult(
                ok=False,
                message_id=state.message_id,
                duration_seconds=state.duration_seconds,
                pcm_bytes=len(state.pcm),
                encoded_bytes=len(state.encoded),
                error=state.error,
                stop_reason=state.stop_reason,
            )

        await lifecycle.emit(
            "upload_completed",
            recordingUrl=complete_payload.get("recordingUrl"),
            playbackUrl=complete_payload.get("playbackUrl"),
            transcriptStatus=complete_payload.get("transcriptStatus"),
        )
        state.finalize_completed = True
        trace.log(
            "mctb_voicemail_record_complete",
            messageId=state.message_id,
            durationSeconds=state.duration_seconds,
            frameCount=state.frame_count,
            encodedBytes=len(state.encoded),
            captureMode=state.capture_mode,
            stopReason=state.stop_reason,
            transcriptStatus=complete_payload.get("transcriptStatus"),
            playbackUrl=complete_payload.get("playbackUrl"),
        )
        return VoicemailRecordingResult(
            ok=True,
            message_id=state.message_id,
            duration_seconds=state.duration_seconds,
            pcm_bytes=len(state.pcm),
            encoded_bytes=len(state.encoded),
            stop_reason=state.stop_reason,
        )
    except Exception as err:
        state.error = str(err)
        await lifecycle.emit("finalize_failed", error=state.error)
        return VoicemailRecordingResult(
            ok=False,
            message_id=state.message_id,
            duration_seconds=state.duration_seconds,
            pcm_bytes=len(state.pcm),
            encoded_bytes=len(state.encoded),
            error=state.error,
            stop_reason=state.stop_reason,
        )
    finally:
        await lifecycle.emit(
            "finalize_complete",
            ok=state.finalize_completed,
            completeCalled=state.complete_called,
            error=state.error,
            frameCount=state.frame_count,
            pcmBytes=len(state.pcm),
            encodedBytes=len(state.encoded),
            stopReason=state.stop_reason,
        )


async def record_sip_voicemail_message(
    backend: "TransovoBackend",
    *,
    trace: "MctbSipE2eTrace",
    room: rtc.Room,
    answer_session: "AgentSession",
    participant: rtc.RemoteParticipant,
    session: dict[str, Any],
    max_seconds: float = MAX_RECORD_SECONDS,
) -> VoicemailRecordingResult:
    workspace_id = str(session.get("workspaceId") or "").strip()
    if not workspace_id:
        return VoicemailRecordingResult(ok=False, error="missing_workspace_id")

    build = get_voice_build_identity()
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

    lifecycle = VoicemailLifecycle(
        backend,
        trace,
        workspace_id=workspace_id,
        message_id=message_id,
        provider_call_id=trace.correlation_id,
    )

    room_input = answer_session.input.audio
    capture_mode = "roomio_tap" if room_input is not None else "participant_stream"
    tap: VoicemailAudioTap | None = None
    previous_input = room_input
    stop_event = asyncio.Event()
    heartbeat_task: asyncio.Task[None] | None = None
    state = _FinalizeState(
        message_id=message_id,
        workspace_id=workspace_id,
        capture_mode=capture_mode,
    )
    result = VoicemailRecordingResult(ok=False, message_id=message_id)

    await lifecycle.emit(
        "record_started",
        captureMode=capture_mode,
        inputAudioLabel=getattr(room_input, "label", None),
        maxSeconds=max_seconds,
        buildSha=build.get("buildSha"),
        imageTag=build.get("imageTag"),
    )

    try:
        if room_input is not None:
            tap = VoicemailAudioTap(room_input)
            answer_session.input.audio = tap
            await lifecycle.emit(
                "tap_installed",
                previousInputLabel=getattr(previous_input, "label", None),
            )
            await asyncio.sleep(0.15)
            heartbeat_task = asyncio.create_task(
                _frame_heartbeat(tap, stop_event=stop_event, lifecycle=lifecycle),
                name="mctb_voicemail_frame_heartbeat",
            )
            state.stop_reason = await _wait_for_recording_stop(
                room,
                participant,
                stop_event=stop_event,
                max_seconds=max_seconds,
                lifecycle=lifecycle,
            )
        else:
            await lifecycle.emit(
                "fallback_stream_started",
                note="roomio_audio_input_missing_using_from_participant",
            )
            hangup_task = asyncio.create_task(
                _wait_for_recording_stop(
                    room,
                    participant,
                    stop_event=stop_event,
                    max_seconds=max_seconds,
                    lifecycle=lifecycle,
                ),
                name="mctb_voicemail_hangup_watch",
            )
            state.pcm, state.frame_count, state.duration_seconds = await _collect_remote_audio_pcm_fallback(
                participant,
                stop_event=stop_event,
                max_seconds=max_seconds,
                lifecycle=lifecycle,
            )
            state.stop_reason = await hangup_task

    except Exception as err:
        state.stop_reason = "error"
        state.error = str(err)
        await lifecycle.emit("record_error", error=state.error)
        result = VoicemailRecordingResult(
            ok=False,
            message_id=message_id,
            error=state.error,
            stop_reason=state.stop_reason,
        )
    finally:
        stop_event.set()
        if heartbeat_task is not None:
            heartbeat_task.cancel()
            try:
                await heartbeat_task
            except asyncio.CancelledError:
                pass

        await lifecycle.emit("recorder_stop_requested", stopReason=state.stop_reason)

        if tap is not None:
            try:
                answer_session.input.audio = previous_input
            except Exception as err:
                await lifecycle.emit("tap_restore_failed", error=str(err))

            state.pcm, state.frame_count, state.duration_seconds = tap.take_pcm()
            await lifecycle.emit(
                "recorder_stop_completed",
                frameCount=state.frame_count,
                pcmBytes=len(state.pcm),
                durationSeconds=state.duration_seconds,
                firstFrameLagMs=(
                    int((tap.first_frame_at or 0) * 1000) if tap.first_frame_at else None
                ),
                captureMode=capture_mode,
            )

            if state.frame_count == 0:
                emergency_pcm, emergency_frames, emergency_duration = await _emergency_collect_pcm(
                    participant,
                    lifecycle=lifecycle,
                )
                if emergency_frames > 0:
                    state.pcm = emergency_pcm
                    state.frame_count = emergency_frames
                    state.duration_seconds = emergency_duration

        if capture_mode == "participant_stream" and not state.finalize_started:
            await lifecycle.emit(
                "recorder_stop_completed",
                frameCount=state.frame_count,
                pcmBytes=len(state.pcm),
                durationSeconds=state.duration_seconds,
                captureMode=capture_mode,
            )

        result = await _finalize_recording(backend, trace, lifecycle, state)

    return result
