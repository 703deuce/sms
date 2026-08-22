"""Raw PCM audio publication for MCTB 571 SIP diagnostic — no TTS, no AudioMixer."""

from __future__ import annotations

import asyncio
import math
import struct
import time
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from livekit import rtc

if TYPE_CHECKING:
    from transovo_voice.session.mctb_sip_e2e_trace import MctbSipE2eTrace

LOG_SOURCE = "mctb-sip-raw-audio"

SAMPLE_RATE = 48_000
NUM_CHANNELS = 1
SAMPLES_PER_FRAME = 480  # 10 ms @ 48 kHz
TONE_FREQUENCY_HZ = 1_000
TONE_DURATION_S = 2.0
TONE_AMPLITUDE = 0.8


@dataclass
class SipRawAudioResult:
    ok: bool
    frames_written: int = 0
    first_frame_written_ms: int | None = None
    playback_duration_ms: int = 0
    track_sid: str | None = None
    publication_sid: str | None = None
    sample_rate: int = SAMPLE_RATE
    num_channels: int = NUM_CHANNELS
    frequency_hz: int = TONE_FREQUENCY_HZ
    error: str | None = None
    sip_participant_track_count: int = 0
    local_publication_count: int = 0


@dataclass
class _ToneGenerator:
    sample_rate: int
    frequency_hz: int
    phase: float = 0.0

    def fill_frame(self, audio_data: memoryview, samples_per_channel: int) -> None:
        packed = struct.pack(
            f"<{samples_per_channel}h",
            *(
                int(
                    32767
                    * TONE_AMPLITUDE
                    * math.sin(
                        2 * math.pi * self.frequency_hz * (self.phase + i) / self.sample_rate,
                    ),
                )
                for i in range(samples_per_channel)
            ),
        )
        audio_data[:] = packed
        self.phase += samples_per_channel


def _describe_publications(participant: Any, *, label: str) -> list[dict[str, Any]]:
    pubs: list[dict[str, Any]] = []
    track_publications = getattr(participant, "track_publications", {}) or {}
    for pub_sid, pub in track_publications.items():
        subscribed = getattr(pub, "subscribed", None)
        pubs.append(
            {
                "label": label,
                "publicationSid": pub_sid,
                "trackSid": getattr(getattr(pub, "track", None), "sid", None),
                "trackName": getattr(pub, "name", None),
                "kind": str(getattr(pub, "kind", "")),
                "source": str(getattr(pub, "source", "")),
                "muted": getattr(pub, "muted", None),
                "subscribed": subscribed,
            },
        )
    return pubs


async def play_sip_raw_tone(
    room: rtc.Room,
    *,
    trace: "MctbSipE2eTrace",
    sip_participant: rtc.RemoteParticipant,
    duration_s: float = TONE_DURATION_S,
    frequency_hz: int = TONE_FREQUENCY_HZ,
) -> SipRawAudioResult:
    """
    Publish a mono PCM 1 kHz tone directly via AudioSource.capture_frame.
    Does not use BackgroundAudioPlayer, TTS, or AudioMixer.
    """
    started = time.perf_counter()
    result = SipRawAudioResult(ok=False, frequency_hz=frequency_hz)
    source: rtc.AudioSource | None = None
    publication: rtc.LocalTrackPublication | None = None
    frame_count_target = max(1, int(duration_s * SAMPLE_RATE / SAMPLES_PER_FRAME))

    trace.log(
        "audio_source_create_start",
        sampleRate=SAMPLE_RATE,
        numChannels=NUM_CHANNELS,
        samplesPerFrame=SAMPLES_PER_FRAME,
        frequencyHz=frequency_hz,
        durationS=duration_s,
        targetFrames=frame_count_target,
        playbackMethod="raw_pcm_audio_source",
    )

    try:
        source = rtc.AudioSource(SAMPLE_RATE, NUM_CHANNELS, queue_size_ms=200)
        trace.log(
            "audio_source_created",
            sampleRate=source.sample_rate,
            numChannels=source.num_channels,
            queueSizeMs=200,
        )

        track = rtc.LocalAudioTrack.create_audio_track("mctb-sip-diagnostic-tone", source)
        result.track_sid = track.sid
        trace.log(
            "audio_track_created",
            trackSid=track.sid,
            trackName=track.name,
            kind=str(track.kind),
        )

        options = rtc.TrackPublishOptions()
        options.source = rtc.TrackSource.SOURCE_MICROPHONE

        local = room.local_participant
        if local is None:
            raise RuntimeError("local_participant_missing_after_connect")

        publication = await local.publish_track(track, options)
        result.publication_sid = publication.sid
        result.local_publication_count = len(local.track_publications)

        trace.log(
            "audio_track_published",
            trackSid=track.sid,
            publicationSid=publication.sid,
            publicationName=publication.name,
            publicationMuted=publication.muted,
            publicationKind=str(publication.kind),
            publicationSource=str(publication.source),
            localPublicationCount=result.local_publication_count,
        )

        sip_pubs = _describe_publications(sip_participant, label="sip_participant")
        result.sip_participant_track_count = len(sip_pubs)
        trace.log(
            "sip_participant_publication_state",
            participantId=sip_participant.sid,
            participantIdentity=sip_participant.identity,
            publications=sip_pubs,
        )

        local_pubs = _describe_publications(local, label="local_participant")
        trace.log(
            "local_participant_publication_state",
            publications=local_pubs,
        )

        frame = rtc.AudioFrame.create(SAMPLE_RATE, NUM_CHANNELS, SAMPLES_PER_FRAME)
        audio_data = memoryview(frame.data)
        tone = _ToneGenerator(SAMPLE_RATE, frequency_hz)

        trace.log(
            "raw_audio_playback_start",
            sampleRate=SAMPLE_RATE,
            numChannels=NUM_CHANNELS,
            samplesPerFrame=SAMPLES_PER_FRAME,
            targetFrames=frame_count_target,
        )

        for frame_index in range(frame_count_target):
            tone.fill_frame(audio_data, SAMPLES_PER_FRAME)
            await source.capture_frame(frame)
            result.frames_written += 1
            if result.frames_written == 1:
                result.first_frame_written_ms = int((time.perf_counter() - started) * 1000)
                trace.log(
                    "first_audio_frame_written",
                    frameIndex=0,
                    samplesPerChannel=SAMPLES_PER_FRAME,
                    sampleRate=SAMPLE_RATE,
                    numChannels=NUM_CHANNELS,
                    elapsedMs=result.first_frame_written_ms,
                )

        await source.wait_for_playout()
        result.playback_duration_ms = int((time.perf_counter() - started) * 1000)

        trace.log(
            "raw_audio_frames_complete",
            framesWritten=result.frames_written,
            frameCount=result.frames_written,
            playbackDurationMs=result.playback_duration_ms,
            frequencyHz=frequency_hz,
            sampleRate=SAMPLE_RATE,
            numChannels=NUM_CHANNELS,
        )

        result.ok = result.frames_written > 0

    except Exception as err:
        result.error = str(err)
        trace.log(
            "audio_publication_failed",
            error=result.error,
            framesWritten=result.frames_written,
            trackSid=result.track_sid,
            publicationSid=result.publication_sid,
        )
        return result

    finally:
        try:
            if publication is not None and room.local_participant is not None:
                await room.local_participant.unpublish_track(publication.sid)
                trace.log(
                    "audio_track_unpublished",
                    publicationSid=publication.sid,
                    trackSid=result.track_sid,
                )
        except Exception as err:
            trace.log("audio_track_unpublish_failed", error=str(err))

        try:
            if source is not None:
                await source.aclose()
                trace.log("audio_source_disposed", trackSid=result.track_sid)
        except Exception as err:
            trace.log("audio_source_dispose_failed", error=str(err))

    return result
