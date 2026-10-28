"""Y2: Modal transcribe hard timeout + Deepgram fallback; rolling stop guards."""
from __future__ import annotations

import threading
import time
from unittest.mock import MagicMock, patch

import pytest

from clips_worker.gpu.base import TranscribeReq, TranscribeRes
from clips_worker.streamer.modal_transcribe import (
    StreamModalTranscribeError,
    transcribe_stream_modal_with_meta,
)
from clips_worker.streamer.transcribe_stream import transcribe_stream_audio_request


def test_modal_hang_returns_within_timeout_and_deepgram_fallback(monkeypatch):
    hang_started = threading.Event()

    def _hang(*_a, **_k):
        hang_started.set()
        time.sleep(60)

    req = TranscribeReq(audio_url="https://example.com/a.wav", language="en")
    conn = MagicMock()

    dg_res = TranscribeRes(
        words=[],
        language="en",
        duration_s=1.0,
        gpu_seconds=0.0,
        provider="deepgram",
        transcription_engine="deepgram",
    )

    with patch("clips_worker.streamer.modal_transcribe.stream_modal_timeout_s", return_value=0.15):
        with patch("clips_worker.streamer.modal_transcribe._remote_transcribe", side_effect=_hang):
            with patch("clips_worker.streamer.transcribe_stream.deepgram_api_key", return_value="test-key"):
                with patch(
                    "clips_worker.streamer.transcribe_stream.transcribe_deepgram_with_logs",
                    return_value=dg_res,
                ) as dg_mock:
                    t0 = time.perf_counter()
                    res, meta = transcribe_stream_audio_request(conn, req, "ws_x", "proj_y")
                    elapsed = time.perf_counter() - t0

    assert hang_started.is_set()
    assert elapsed < 2.0, f"expected fast timeout+fallback, took {elapsed:.1f}s"
    assert res.transcription_engine == "deepgram"
    dg_mock.assert_called_once()
    assert meta.transcription_engine == "deepgram"


def test_modal_timeout_raises_without_deepgram():
    def _hang(*_a, **_k):
        time.sleep(60)

    req = TranscribeReq(audio_url="https://example.com/a.wav", language="en")
    with patch("clips_worker.streamer.modal_transcribe.stream_modal_timeout_s", return_value=0.1):
        with patch("clips_worker.streamer.modal_transcribe._remote_transcribe", side_effect=_hang):
            with patch("clips_worker.streamer.transcribe_stream.deepgram_api_key", return_value=None):
                t0 = time.perf_counter()
                with pytest.raises(StreamModalTranscribeError) as exc:
                    transcribe_stream_modal_with_meta(req, diarize=False)
                assert time.perf_counter() - t0 < 2.0
    assert "hard_timeout" in str(exc.value)


def test_rolling_autopull_stop_when_auto_process_off():
    from clips_worker.streamer.rolling_ingest import rolling_autopull_stop_reason

    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value.__enter__ = MagicMock(return_value=cursor)
    conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    cursor.fetchone.return_value = (
        {"rolling": {"live": True}, "autoProcess": False},
        "ch_1",
        "paste",
    )
    vod = {"id": "svod_1", "state": {"rolling": {"live": True}, "autoProcess": False}, "triggeredBy": "paste"}
    assert rolling_autopull_stop_reason(conn, vod) == "auto_process_off"
