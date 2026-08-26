"""Capture SIP caller audio during MCTB voicemail terminal phase."""

from __future__ import annotations

import asyncio
import shutil
import time
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from livekit import rtc

from transovo_voice.session.sip_status import SIP_CALL_STATUS_HANGUP, read_sip_call_status

if TYPE_CHECKING:
    from transovo_voice.integrations.backend_client import TransovoBackend
    from transovo_voice.session.mctb_sip_e2e_trace import MctbSipE2eTrace

DEFAULT_SAMPLE_RATE = 24_000
NUM_CHANNELS = 1
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


def _find_remote_audio_track(
    participant: rtc.RemoteParticipant,
) -> rtc.Track | None:
    for publication in participant.track_publications.values():
        if publication.kind != rtc.TrackKind.KIND_AUDIO:
            continue
        track = publication.track
        if track is not None and track.kind == rtc.TrackKind.KIND_AUDIO:
            return track
    return None


def _subscribe_remote_audio_publications(participant: rtc.RemoteParticipant) -> int:
    subscribed = 0
    for publication in participant.track_publications.values():
        if publication.kind != rtc.TrackKind.KIND_AUDIO:
            continue
        if isinstance(publication, rtc.RemoteTrackPublication):
            publication.set_subscribed(True)
            subscribed += 1
    return subscribed


async def _wait_for_remote_audio_track(
    room: rtc.Room,
    participant: rtc.RemoteParticipant,
    *,
    timeout_s: float = 8.0,
) -> rtc.Track | None:
    track = _find_remote_audio_track(participant)
    if track is not None:
        return track

    subscribed_count = _subscribe_remote_audio_publications(participant)
    track = _find_remote_audio_track(participant)
    if track is not None:
        return track

    loop = asyncio.get_running_loop()
    resolved: asyncio.Future[rtc.Track] = loop.create_future()

    def _on_track_subscribed(
        subscribed_track: rtc.Track,
        _publication: rtc.RemoteTrackPublication,
        remote_participant: rtc.RemoteParticipant,
    ) -> None:
        if remote_participant.sid != participant.sid:
            return
        if subscribed_track.kind != rtc.TrackKind.KIND_AUDIO:
            return
        if not resolved.done():
            resolved.set_result(subscribed_track)

    room.on("track_subscribed", _on_track_subscribed)
    try:
        return await asyncio.wait_for(resolved, timeout=timeout_s)
    except asyncio.TimeoutError:
        return _find_remote_audio_track(participant)
    finally:
        room.off("track_subscribed", _on_track_subscribed)


def _pcm_duration_seconds(pcm: bytes) -> float:
    if not pcm:
        return 0.0
    return len(pcm) / (DEFAULT_SAMPLE_RATE * NUM_CHANNELS * 2)


async def _collect_remote_audio_pcm(
    track: rtc.Track,
    *,
    stop_event: asyncio.Event,
    max_seconds: float,
) -> tuple[bytes, int, float]:
    stream = rtc.AudioStream(track, sample_rate=DEFAULT_SAMPLE_RATE, num_channels=NUM_CHANNELS)
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
    room: rtc.Room,
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

    trace.log(
        "mctb_voicemail_record_started",
        messageId=message_id,
        workspaceId=workspace_id,
        maxSeconds=max_seconds,
        publicationCount=len(participant.track_publications),
    )

    track = await _wait_for_remote_audio_track(room, participant)
    if track is None:
        publications = []
        for publication in participant.track_publications.values():
            publications.append(
                {
                    "sid": publication.sid,
                    "kind": int(publication.kind),
                    "subscribed": getattr(publication, "subscribed", None),
                    "hasTrack": publication.track is not None,
                },
            )
        trace.log(
            "mctb_voicemail_record_no_audio_track",
            messageId=message_id,
            publications=publications,
        )
        return VoicemailRecordingResult(
            ok=False,
            message_id=message_id,
            error="remote_audio_track_missing",
        )

    trace.log(
        "mctb_voicemail_record_track_ready",
        messageId=message_id,
        trackSid=track.sid,
        trackKind=int(track.kind),
    )

    stop_event = asyncio.Event()
    hangup_seen_at: float | None = None

    async def _watch_hangup() -> None:
        nonlocal hangup_seen_at
        while not stop_event.is_set():
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

    watcher = asyncio.create_task(_watch_hangup(), name="mctb_voicemail_hangup_watch")
    try:
        pcm, frame_count, duration_seconds = await _collect_remote_audio_pcm(
            track,
            stop_event=stop_event,
            max_seconds=max_seconds,
        )
    finally:
        stop_event.set()
        watcher.cancel()
        try:
            await watcher
        except asyncio.CancelledError:
            pass

    if duration_seconds < MIN_RECORD_SECONDS or not pcm:
        trace.log(
            "mctb_voicemail_record_too_short",
            messageId=message_id,
            frameCount=frame_count,
            durationSeconds=duration_seconds,
            pcmBytes=len(pcm),
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
