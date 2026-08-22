"""Tests for SIP raw PCM audio diagnostic."""

from __future__ import annotations

import struct

from transovo_voice.session.sip_raw_audio import (
    SAMPLES_PER_FRAME,
    SAMPLE_RATE,
    TONE_FREQUENCY_HZ,
    _ToneGenerator,
)


def test_tone_generator_writes_int16_samples():
    tone = _ToneGenerator(SAMPLE_RATE, TONE_FREQUENCY_HZ)
    buf = bytearray(SAMPLES_PER_FRAME * 2)
    tone.fill_frame(memoryview(buf), SAMPLES_PER_FRAME)
    samples = struct.unpack(f"<{SAMPLES_PER_FRAME}h", buf)
    assert len(samples) == SAMPLES_PER_FRAME
    assert max(abs(s) for s in samples) > 1000


def test_tone_frame_count_for_two_seconds():
    frame_count = int(2.0 * SAMPLE_RATE / SAMPLES_PER_FRAME)
    assert frame_count == 200
