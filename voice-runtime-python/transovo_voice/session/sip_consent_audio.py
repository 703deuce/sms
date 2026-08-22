"""Consent prompt playback over existing RoomIO audio output."""

from __future__ import annotations

import asyncio
import shutil
import time
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

import httpx
from livekit import rtc

from transovo_voice.session.sip_raw_audio import DEFAULT_SAMPLE_RATE, _samples_per_frame

if TYPE_CHECKING:
    from livekit.agents import AgentSession

    from transovo_voice.session.mctb_sip_e2e_trace import MctbSipE2eTrace


@dataclass
class ConsentAudioResult:
    ok: bool
    frames_written: int = 0
    first_frame_sent_ms: int | None = None
    playback_duration_ms: int = 0
    track_sid: str | None = None
    publication_sid: str | None = None
    sample_rate: int = DEFAULT_SAMPLE_RATE
    channels: int = 1
    error: str | None = None


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


async def _download_bytes(url: str) -> bytes:
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.content


async def _decode_audio_to_pcm(
    audio_bytes: bytes,
    *,
    sample_rate: int,
) -> bytes:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("ffmpeg_not_available_for_consent_audio_decode")

    proc = await asyncio.create_subprocess_exec(
        ffmpeg,
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        "pipe:0",
        "-f",
        "s16le",
        "-acodec",
        "pcm_s16le",
        "-ar",
        str(sample_rate),
        "-ac",
        "1",
        "pipe:1",
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate(input=audio_bytes)
    if proc.returncode != 0:
        message = stderr.decode("utf-8", errors="replace").strip() or "ffmpeg_decode_failed"
        raise RuntimeError(message)
    if not stdout:
        raise RuntimeError("decoded_pcm_empty")
    return stdout


def _pcm_to_frames(pcm: bytes, *, sample_rate: int, channels: int) -> list[rtc.AudioFrame]:
    samples_per_frame = _samples_per_frame(sample_rate)
    bytes_per_sample = 2 * channels
    frame_bytes = samples_per_frame * bytes_per_sample
    frames: list[rtc.AudioFrame] = []
    for offset in range(0, len(pcm) - frame_bytes + 1, frame_bytes):
        chunk = pcm[offset : offset + frame_bytes]
        frame = rtc.AudioFrame.create(sample_rate, channels, samples_per_frame)
        frame.data[:] = memoryview(chunk).cast("h")
        frames.append(frame)
    return frames


async def play_confirmation_audio_url(
    room: rtc.Room,
    answer_session: "AgentSession",
    *,
    trace: "MctbSipE2eTrace",
    sip_participant: rtc.RemoteParticipant,
    sip_call_status: str | None,
    play_url: str,
) -> ConsentAudioResult:
    """Play post-Press-1 confirmation MP3 through RoomIO."""
    return await _play_audio_url(
        room,
        answer_session,
        trace=trace,
        sip_participant=sip_participant,
        sip_call_status=sip_call_status,
        play_url=play_url,
        playback_method="confirmation_mp3_roomio",
        source_created_event="confirmation_audio_start",
        track_published_event="confirmation_audio_track_published",
        first_frame_event="confirmation_audio_first_frame",
        frames_sent_event="confirmation_audio_frames_sent",
        playback_complete_event="confirmation_audio_complete",
        publish_failed_event="confirmation_audio_publish_failed",
    )


async def play_consent_audio_url(
    room: rtc.Room,
    answer_session: "AgentSession",
    *,
    trace: "MctbSipE2eTrace",
    sip_participant: rtc.RemoteParticipant,
    sip_call_status: str | None,
    play_url: str,
) -> ConsentAudioResult:
    """Play hosted consent MP3 through the existing RoomIO audio output."""
    return await _play_audio_url(
        room,
        answer_session,
        trace=trace,
        sip_participant=sip_participant,
        sip_call_status=sip_call_status,
        play_url=play_url,
        playback_method="consent_mp3_roomio",
        source_created_event="diagnostic_audio_source_created",
        track_published_event="diagnostic_audio_track_published",
        first_frame_event="diagnostic_audio_first_frame_sent",
        frames_sent_event="diagnostic_audio_frames_sent",
        playback_complete_event="diagnostic_audio_playback_complete",
        publish_failed_event="diagnostic_audio_publish_failed",
    )


async def _play_audio_url(
    room: rtc.Room,
    answer_session: "AgentSession",
    *,
    trace: "MctbSipE2eTrace",
    sip_participant: rtc.RemoteParticipant,
    sip_call_status: str | None,
    play_url: str,
    playback_method: str,
    source_created_event: str,
    track_published_event: str,
    first_frame_event: str,
    frames_sent_event: str,
    playback_complete_event: str,
    publish_failed_event: str,
) -> ConsentAudioResult:
    started = time.perf_counter()
    result = ConsentAudioResult(ok=False)
    audio_output = answer_session.output.audio
    if audio_output is None:
        result.error = "roomio_audio_output_missing"
        trace.log(
            publish_failed_event,
            error=result.error,
            playUrl=play_url,
            **_common_log_fields(
                trace=trace,
                sip_participant=sip_participant,
                sip_call_status=sip_call_status,
            ),
        )
        return result

    sample_rate = audio_output.sample_rate or DEFAULT_SAMPLE_RATE
    channels = 1
    result.sample_rate = sample_rate
    result.channels = channels

    publication = _find_local_audio_publication(room)
    if publication is not None:
        result.publication_sid = publication.sid
        track = publication.track
        result.track_sid = track.sid if track is not None else None

    trace.log(
        source_created_event,
        playbackMethod=playback_method,
        playUrl=play_url,
        **_common_log_fields(
            trace=trace,
            sip_participant=sip_participant,
            sip_call_status=sip_call_status,
            track_sid=result.track_sid,
            sample_rate=sample_rate,
            channels=channels,
        ),
    )

    if publication is None or result.track_sid is None:
        result.error = "roomio_audio_track_not_published"
        trace.log(
            publish_failed_event,
            error=result.error,
            playUrl=play_url,
            **_common_log_fields(
                trace=trace,
                sip_participant=sip_participant,
                sip_call_status=sip_call_status,
                sample_rate=sample_rate,
                channels=channels,
            ),
        )
        return result

    trace.log(
        track_published_event,
        publicationSid=result.publication_sid,
        publicationName=publication.name,
        note="existing_roomio_track_from_answer_path",
        playUrl=play_url,
        **_common_log_fields(
            trace=trace,
            sip_participant=sip_participant,
            sip_call_status=sip_call_status,
            track_sid=result.track_sid,
            sample_rate=sample_rate,
            channels=channels,
        ),
    )

    try:
        audio_bytes = await _download_bytes(play_url)
        pcm = await _decode_audio_to_pcm(audio_bytes, sample_rate=sample_rate)
        frames = _pcm_to_frames(pcm, sample_rate=sample_rate, channels=channels)
        if not frames:
            raise RuntimeError("no_audio_frames_after_decode")

        for frame in frames:
            await audio_output.capture_frame(frame)
            result.frames_written += 1
            if result.frames_written == 1:
                result.first_frame_sent_ms = int((time.perf_counter() - started) * 1000)
                trace.log(
                    first_frame_event,
                    frameIndex=0,
                    playUrl=play_url,
                    **_common_log_fields(
                        trace=trace,
                        sip_participant=sip_participant,
                        sip_call_status=sip_call_status,
                        track_sid=result.track_sid,
                        sample_rate=sample_rate,
                        channels=channels,
                        duration_ms=result.first_frame_sent_ms,
                    ),
                )

        audio_output.flush()
        await asyncio.wait_for(audio_output.wait_for_playout(), timeout=30.0)
        result.playback_duration_ms = int((time.perf_counter() - started) * 1000)
        result.ok = result.frames_written > 0

        trace.log(
            frames_sent_event,
            playUrl=play_url,
            **_common_log_fields(
                trace=trace,
                sip_participant=sip_participant,
                sip_call_status=sip_call_status,
                track_sid=result.track_sid,
                sample_rate=sample_rate,
                channels=channels,
                frame_count=result.frames_written,
                duration_ms=result.playback_duration_ms,
            ),
        )
        if result.ok:
            trace.log(
                playback_complete_event,
                playUrl=play_url,
                **_common_log_fields(
                    trace=trace,
                    sip_participant=sip_participant,
                    sip_call_status=sip_call_status,
                    track_sid=result.track_sid,
                    sample_rate=sample_rate,
                    channels=channels,
                    frame_count=result.frames_written,
                    duration_ms=result.playback_duration_ms,
                ),
            )
        return result
    except Exception as err:
        result.error = str(err)
        trace.log(
            publish_failed_event,
            error=result.error,
            playUrl=play_url,
            framesWritten=result.frames_written,
            **_common_log_fields(
                trace=trace,
                sip_participant=sip_participant,
                sip_call_status=sip_call_status,
                track_sid=result.track_sid,
                sample_rate=sample_rate,
                channels=channels,
                frame_count=result.frames_written,
            ),
        )
        return result
