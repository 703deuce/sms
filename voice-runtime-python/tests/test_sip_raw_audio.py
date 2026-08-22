"""Tests for SIP raw PCM audio diagnostic."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from livekit import rtc

from transovo_voice.session.mctb_sip_e2e_trace import MctbSipE2eTrace, _active_traces, _handled_correlation_ids
from transovo_voice.session.sip_raw_audio import (
    DEFAULT_SAMPLE_RATE,
    TONE_FREQUENCY_HZ,
    _ToneGenerator,
    _samples_per_frame,
    play_diagnostic_tone,
)


@pytest.fixture(autouse=True)
def reset_trace_state():
    _handled_correlation_ids.clear()
    _active_traces.clear()
    yield
    _handled_correlation_ids.clear()
    _active_traces.clear()


def test_tone_generator_writes_int16_samples():
    tone = _ToneGenerator(DEFAULT_SAMPLE_RATE, TONE_FREQUENCY_HZ)
    samples_per_frame = _samples_per_frame(DEFAULT_SAMPLE_RATE)
    buf = bytearray(samples_per_frame * 2)
    tone.fill_frame(memoryview(buf).cast("h"), samples_per_frame)
    samples = list(memoryview(buf).cast("h"))
    assert len(samples) == samples_per_frame
    assert max(abs(s) for s in samples) > 1000


def test_tone_frame_count_for_two_seconds():
    samples_per_frame = _samples_per_frame(DEFAULT_SAMPLE_RATE)
    frame_count = int(2.0 * DEFAULT_SAMPLE_RATE / samples_per_frame)
    assert frame_count == 200


@pytest.mark.asyncio
async def test_play_diagnostic_tone_publishes_frames_via_roomio(capsys):
    trace = MctbSipE2eTrace.create(
        correlation_id="cid@telnyx",
        job_id="job-1",
        room_name="room-1",
        room_sid="RM_123",
    )
    sip_participant = MagicMock()
    sip_participant.sid = "PA_SIP"
    sip_participant.identity = "sip-caller"

    publication = MagicMock()
    publication.sid = "PUB_1"
    publication.name = "roomio_audio"
    publication.muted = False
    publication.kind = rtc.TrackKind.KIND_AUDIO
    track = MagicMock()
    track.sid = "TR_1"
    publication.track = track

    local = MagicMock()
    local.track_publications = {publication.sid: publication}
    room = MagicMock()
    room.local_participant = local

    audio_output = MagicMock()
    audio_output.sample_rate = DEFAULT_SAMPLE_RATE
    audio_output.capture_frame = AsyncMock()
    audio_output.flush = MagicMock()
    playout_event = MagicMock()
    audio_output.wait_for_playout = AsyncMock(return_value=playout_event)

    answer_session = MagicMock()
    answer_session.output.audio = audio_output

    result = await play_diagnostic_tone(
        room,
        answer_session,
        trace=trace,
        sip_participant=sip_participant,
        sip_call_status="active",
        duration_s=0.02,
    )

    assert result.ok is True
    assert result.frames_written == 2
    assert audio_output.capture_frame.await_count == 2
    audio_output.flush.assert_called_once()
    audio_output.wait_for_playout.assert_awaited_once()

    output = capsys.readouterr().out
    assert "diagnostic_audio_source_created" in output
    assert "diagnostic_audio_track_published" in output
    assert "diagnostic_audio_first_frame_sent" in output
    assert "diagnostic_audio_frames_sent" in output
    assert "diagnostic_audio_playback_complete" in output
