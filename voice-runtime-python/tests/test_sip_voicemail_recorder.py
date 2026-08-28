"""Unit tests for SIP voicemail WAV encoding."""

from __future__ import annotations

import struct
import wave
import io

from transovo_voice.session.sip_voicemail_recorder import _pcm16_to_wav_bytes


def test_pcm16_to_wav_bytes_roundtrip() -> None:
    sample_rate = 24000
    pcm = struct.pack("<4h", 100, -100, 200, -200)
    wav_bytes = _pcm16_to_wav_bytes(pcm, sample_rate=sample_rate, channels=1)
    with wave.open(io.BytesIO(wav_bytes), "rb") as wf:
        assert wf.getnchannels() == 1
        assert wf.getframerate() == sample_rate
        assert wf.getsampwidth() == 2
        assert wf.readframes(wf.getnframes()) == pcm
