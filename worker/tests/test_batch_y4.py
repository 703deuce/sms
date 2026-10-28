"""Y4: per-window transcript cache, lastPulledMs, min clip length, shared modal circuit."""
from __future__ import annotations

import json
import tempfile
import time
from pathlib import Path
from unittest.mock import MagicMock, patch

from clips_worker.streamer.analyze_window import analyze_window_tag
from clips_worker.streamer.fusion import FusionPick
from clips_worker.streamer.keys import stream_chunk_key
from clips_worker.streamer.min_clip_length import enforce_min_length_after_snap
from clips_worker.streamer.modal_circuit_store import (
    modal_transcribe_circuit_open,
    record_modal_transcribe_timeout,
)
from clips_worker.video_picker_cache import _cache_key


def test_analyze_window_tag_differs_by_audio_key():
    a = analyze_window_tag(range_start_ms=1, range_end_ms=2, audio_key="ws/a.opus")
    b = analyze_window_tag(range_start_ms=1, range_end_ms=2, audio_key="ws/b.opus")
    assert a != b


def test_stream_chunk_key_scoped_by_window():
    k1 = stream_chunk_key("ws", "svod", 0, "words.json", window_tag="abc")
    k2 = stream_chunk_key("ws", "svod", 0, "words.json", window_tag="def")
    assert k1 != k2
    assert "/windows/abc/" in k1


def test_video_picker_cache_scope():
    k1 = _cache_key("ws", "svod", 0, 180_000, scope="tag1")
    k2 = _cache_key("ws", "svod", 0, 180_000, scope="tag2")
    assert k1 != k2


def test_min_length_drop_when_unexpandable():
    pick = FusionPick(
        start_ms=1000,
        end_ms=4000,
        title="x",
        hook="x",
        score=50,
        scores={"total": 50},
        ai_meta={},
        peak_ms=2000,
    )
    words = [{"w": "hi", "s": 1.0, "e": 1.2}]
    out = enforce_min_length_after_snap(
        pick,
        words,
        range_start_ms=0,
        range_end_ms=5000,
        settings={"clipLenMode": "auto"},
        min_ms=15_000,
    )
    assert out is None


def test_modal_circuit_shared_file(tmp_path, monkeypatch):
    import clips_worker.streamer.modal_circuit_store as store

    path = tmp_path / "modal_transcribe_circuit.json"
    monkeypatch.setattr(store, "_cache_path", lambda: path)
    store._MODULE_UNTIL = 0.0
    assert not modal_transcribe_circuit_open()
    record_modal_transcribe_timeout()
    assert modal_transcribe_circuit_open()
    data = json.loads(path.read_text())
    assert float(data["open_until"]) > time.time()
