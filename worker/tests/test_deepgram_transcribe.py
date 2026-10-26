import json
from unittest.mock import MagicMock, patch

import pytest

from clips_worker.deepgram_transcribe import (
    DeepgramTranscribeError,
    map_deepgram_words,
    resolve_transcribe_provider,
    transcribe_deepgram,
)
from clips_worker.gpu.base import TranscribeReq
from clips_worker.transcribe_provider import transcribe_audio_request


def test_map_deepgram_words_keeps_punctuation_and_speaker():
    raw = [
        {
            "word": "straightforward",
            "punctuated_word": "straightforward.",
            "start": 1.0,
            "end": 1.4,
            "confidence": 0.9,
            "speaker": 1,
        }
    ]
    words = map_deepgram_words(raw, offset_ms=500)
    assert words[0]["w"] == "straightforward."
    assert words[0]["spk"] == 1
    assert words[0]["s"] == 1.5
    assert words[0]["i"] == 0


def test_resolve_provider_defaults_to_deepgram_with_key(monkeypatch):
    monkeypatch.setenv("DEEPGRAM_API_KEY", "test-key")
    monkeypatch.delenv("TRANSCRIBE_PROVIDER", raising=False)
    assert resolve_transcribe_provider() == "deepgram"


def test_resolve_provider_force_local(monkeypatch):
    monkeypatch.setenv("DEEPGRAM_API_KEY", "test-key")
    monkeypatch.setenv("TRANSCRIBE_PROVIDER", "local")
    assert resolve_transcribe_provider() == "local"


def _dg_payload(words: list[dict]) -> bytes:
    body = {
        "metadata": {"detected_language": "en"},
        "results": {"channels": [{"alternatives": [{"words": words, "transcript": "hi"}]}]},
    }
    return json.dumps(body).encode()


def test_transcribe_deepgram_maps_response(monkeypatch, tmp_path):
    monkeypatch.setenv("DEEPGRAM_API_KEY", "k")
    audio = tmp_path / "a.opus"
    audio.write_bytes(b"fake")

    mock_resp = MagicMock()
    mock_resp.read.return_value = _dg_payload(
        [{"word": "hi", "punctuated_word": "Hi.", "start": 0.0, "end": 0.2, "confidence": 1, "speaker": 0}]
    )
    mock_resp.__enter__ = lambda s: s
    mock_resp.__exit__ = MagicMock(return_value=False)

    with patch("urllib.request.urlopen", return_value=mock_resp):
        res = transcribe_deepgram(TranscribeReq(audio_path=str(audio)))
    assert res.transcription_engine == "deepgram"
    assert res.words[0]["w"] == "Hi."


def test_fallback_on_http_402(monkeypatch, tmp_path):
    monkeypatch.setenv("DEEPGRAM_API_KEY", "k")
    monkeypatch.setenv("TRANSCRIBE_PROVIDER", "deepgram")
    audio = tmp_path / "a.opus"
    audio.write_bytes(b"x")

    import urllib.error

    err = urllib.error.HTTPError("https://api.deepgram.com", 402, "payment", None, None)
    err.read = lambda *a, **k: b"insufficient"

    with patch("urllib.request.urlopen", side_effect=err):
        with patch("clips_worker.transcribe_provider.transcribe_with_fallback") as fb:
            fb.return_value = MagicMock(
                words=[{"w": "a", "s": 0, "e": 1, "i": 0, "p": 1}],
                language="en",
                duration_s=1,
                gpu_seconds=0,
                provider="local",
            )
            res, meta = transcribe_audio_request(None, TranscribeReq(audio_path=str(audio)), "ws", "p")
    assert meta.transcription_engine == "local_whisper"
    assert meta.fallback_reason == "http_402"
    assert fb.called


def test_fallback_on_timeout(monkeypatch, tmp_path):
    monkeypatch.setenv("DEEPGRAM_API_KEY", "k")
    monkeypatch.setenv("TRANSCRIBE_PROVIDER", "deepgram")
    audio = tmp_path / "a.opus"
    audio.write_bytes(b"x")

    import urllib.error

    with patch(
        "urllib.request.urlopen",
        side_effect=urllib.error.URLError("timed out"),
    ):
        with patch("clips_worker.transcribe_provider.transcribe_with_fallback") as fb:
            fb.return_value = MagicMock(
                words=[],
                language="en",
                duration_s=0,
                gpu_seconds=0,
                provider="local",
            )
            _res, meta = transcribe_audio_request(None, TranscribeReq(audio_path=str(audio)), "ws", "p")
    assert meta.fallback_reason == "timeout"


def test_fallback_on_empty_transcript(monkeypatch, tmp_path):
    monkeypatch.setenv("DEEPGRAM_API_KEY", "k")
    monkeypatch.setenv("TRANSCRIBE_PROVIDER", "deepgram")
    audio = tmp_path / "a.opus"
    audio.write_bytes(b"x")

    mock_resp = MagicMock()
    body = {
        "metadata": {"detected_language": "en"},
        "results": {"channels": [{"alternatives": [{"words": [], "transcript": ""}]}]},
    }
    mock_resp.read.return_value = json.dumps(body).encode()
    mock_resp.__enter__ = lambda s: s
    mock_resp.__exit__ = MagicMock(return_value=False)

    with patch("urllib.request.urlopen", return_value=mock_resp):
        with patch("clips_worker.transcribe_provider.transcribe_with_fallback") as fb:
            fb.return_value = MagicMock(
                words=[{"w": "x", "s": 0, "e": 1, "i": 0, "p": 1}],
                language="en",
                duration_s=1,
                gpu_seconds=0,
                provider="local",
            )
            _res, meta = transcribe_audio_request(None, TranscribeReq(audio_path=str(audio)), "ws", "p")
    assert meta.fallback_reason == "empty_transcript"
