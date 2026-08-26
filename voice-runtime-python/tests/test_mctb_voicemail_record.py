"""Tests for MCTB SIP voicemail recording helpers."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
from livekit import rtc
from livekit.agents.voice import io as agents_io

from transovo_voice.session.mctb_voicemail_record import (
    VoicemailAudioTap,
    _pcm_duration_seconds,
)


class _FakeAudioInput(agents_io.AudioInput):
    def __init__(self, frames: list[rtc.AudioFrame]) -> None:
        super().__init__(label="FakeRoomIO", source=None)
        self._frames = list(frames)
        self._index = 0
        self.attached = False
        self.detached = False

    def on_attached(self) -> None:
        self.attached = True

    def on_detached(self) -> None:
        self.detached = True

    async def __anext__(self) -> rtc.AudioFrame:
        if self._index >= len(self._frames):
            raise StopAsyncIteration
        frame = self._frames[self._index]
        self._index += 1
        return frame


def _make_frame(sample_count: int = 240, sample_rate: int = 24_000) -> rtc.AudioFrame:
    frame = MagicMock(spec=rtc.AudioFrame)
    frame.sample_rate = sample_rate
    frame.num_channels = 1
    frame.data = bytes([1, 0] * sample_count)
    return frame


def test_pcm_duration_seconds_half_second():
    bytes_per_second = 24_000 * 2
    pcm = b"\x00" * (bytes_per_second // 2)
    assert _pcm_duration_seconds(pcm) == pytest.approx(0.5)


@pytest.mark.asyncio
async def test_voicemail_audio_tap_accumulates_frames():
    frames = [_make_frame(), _make_frame()]
    source = _FakeAudioInput(frames)
    tap = VoicemailAudioTap(source)

    await tap.__anext__()
    await tap.__anext__()

    pcm, frame_count, duration_seconds = tap.take_pcm()
    assert frame_count == 2
    assert len(pcm) > 0
    assert duration_seconds > 0


@pytest.mark.asyncio
async def test_voicemail_audio_tap_forwards_attach_lifecycle():
    source = _FakeAudioInput([_make_frame()])
    tap = VoicemailAudioTap(source)

    tap.on_attached()
    tap.on_detached()

    assert source.attached is True
    assert source.detached is True


@pytest.mark.asyncio
async def test_voicemail_audio_tap_passes_frames_through():
    frames = [_make_frame()]
    source = _FakeAudioInput(frames)
    tap = VoicemailAudioTap(source)

    frame = await tap.__anext__()

    assert frame.sample_rate == 24_000
    with pytest.raises(StopAsyncIteration):
        await tap.__anext__()
