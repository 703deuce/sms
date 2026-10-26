import os
from unittest.mock import MagicMock, patch

import pytest

from clips_worker.gpu import get_provider, transcribe_with_fallback
from clips_worker.gpu.base import TranscribeReq


def test_env_override_wins(monkeypatch):
    monkeypatch.setenv("GPU_PROVIDER", "local")
    monkeypatch.setenv("GPU_PROVIDER_TRANSCRIBE", "local")
    assert get_provider("transcribe").name == "local"


def test_runpod_raises(monkeypatch):
    monkeypatch.setenv("GPU_PROVIDER", "runpod")
    with pytest.raises(NotImplementedError, match="runpod"):
        get_provider("transcribe")


def test_modal_fallback_on_error(monkeypatch, tmp_path):
    monkeypatch.setenv("GPU_PROVIDER", "modal")
    monkeypatch.setenv("GPU_FALLBACK_LOCAL", "1")
    audio = tmp_path / "a.wav"
    audio.write_bytes(b"x")

    class Boom:
        name = "modal"

        def transcribe(self, req):
            raise RuntimeError("modal down")

    with patch("clips_worker.gpu.get_provider", return_value=Boom()):
        with patch("clips_worker.gpu.local.LocalProvider.transcribe") as loc:
            loc.return_value = MagicMock(words=[], language="en", duration_s=0, gpu_seconds=0, provider="local")
            res = transcribe_with_fallback(None, TranscribeReq(audio_path=str(audio)), "ws", "proj")
            assert res.provider == "local"


def test_no_fallback_when_disabled(monkeypatch):
    monkeypatch.setenv("GPU_PROVIDER", "modal")
    monkeypatch.setenv("GPU_FALLBACK_LOCAL", "0")

    class Boom:
        name = "modal"

        def transcribe(self, req):
            raise RuntimeError("modal down")

    with patch("clips_worker.gpu.get_provider", return_value=Boom()):
        with pytest.raises(RuntimeError):
            transcribe_with_fallback(None, TranscribeReq(audio_url="http://x"), "ws", "proj")
