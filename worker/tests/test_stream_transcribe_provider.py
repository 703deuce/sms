"""Streamer VOD transcribe provider resolution."""
from __future__ import annotations

from clips_worker.streamer.transcribe_stream import (
    estimate_stream_transcribe_cost_usd,
    resolve_stream_transcribe_provider,
)


def test_resolve_defaults_deepgram_without_groq(monkeypatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    monkeypatch.delenv("STREAM_TRANSCRIBE_PROVIDER", raising=False)
    monkeypatch.setenv("DEEPGRAM_API_KEY", "dg-test")
    assert resolve_stream_transcribe_provider() == "deepgram"


def test_resolve_prefers_groq_when_key_set(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "gq-test")
    monkeypatch.setenv("DEEPGRAM_API_KEY", "dg-test")
    monkeypatch.delenv("STREAM_TRANSCRIBE_PROVIDER", raising=False)
    assert resolve_stream_transcribe_provider() == "groq"


def test_explicit_groq_without_key_falls_back_deepgram(monkeypatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    monkeypatch.setenv("DEEPGRAM_API_KEY", "dg-test")
    monkeypatch.setenv("STREAM_TRANSCRIBE_PROVIDER", "groq")
    assert resolve_stream_transcribe_provider() == "deepgram"


def test_groq_cost_estimate(monkeypatch):
    monkeypatch.setenv("GROQ_USD_PER_AUDIO_HOUR", "0.04")
    cost = estimate_stream_transcribe_cost_usd("groq", 60.0)
    assert abs(cost - 0.04) < 1e-6
