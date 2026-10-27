"""Streamer VOD transcribe provider resolution."""
from __future__ import annotations

from clips_worker.streamer.collab_detect import resolve_vod_transcribe_provider
from clips_worker.streamer.transcribe_stream import (
    estimate_stream_transcribe_cost_usd,
    resolve_stream_transcribe_provider,
    stream_whisper_model,
)
from clips_worker.streamer.modal_transcribe import estimate_modal_cost_usd


def test_resolve_defaults_modal(monkeypatch):
    monkeypatch.delenv("STREAM_TRANSCRIBE_PROVIDER", raising=False)
    assert resolve_stream_transcribe_provider() == "modal"


def test_stream_whisper_model_env(monkeypatch):
    monkeypatch.setenv("STREAM_WHISPER_GPU_MODEL", "large-v3-turbo")
    assert stream_whisper_model() == "large-v3-turbo"


def test_collab_routes_modal_diarize():
    assert resolve_vod_transcribe_provider(True, {}) == "modal_diarize"


def test_modal_cost_estimate(monkeypatch):
    monkeypatch.setenv("MODAL_L4_USD_PER_GPU_S", "0.001")
    cost = estimate_stream_transcribe_cost_usd("modal", 60.0, gpu_seconds=100.0)
    assert abs(cost - 0.1) < 1e-6
    assert abs(estimate_modal_cost_usd(10.0) - 0.01) < 1e-6
