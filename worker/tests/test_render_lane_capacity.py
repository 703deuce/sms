"""RENDER_CLIP opt-in lane must not alter legacy default/stream worker slots."""
from clips_worker.render_concurrency import worker_concurrency
from clips_worker.streamer.lanes import lane_types


def test_legacy_defaults_preserved(monkeypatch):
    monkeypatch.delenv("WORKER_CONCURRENCY", raising=False)
    monkeypatch.delenv("RENDER_WORKER_CONCURRENCY", raising=False)
    monkeypatch.setenv("WORKER_LANE", "default")
    assert worker_concurrency() == 2
    assert "RENDER_CLIP" in lane_types()
    monkeypatch.setenv("WORKER_LANE", "stream")
    assert worker_concurrency() == 1
    assert "RENDER_CLIP" not in lane_types()


def test_dedicated_render_lane_bounded_by_cpu(monkeypatch):
    import os
    monkeypatch.setattr(os, "cpu_count", lambda: 8)
    monkeypatch.setenv("WORKER_LANE", "render")
    monkeypatch.delenv("RENDER_WORKER_CONCURRENCY", raising=False)
    assert worker_concurrency() == 4
    assert lane_types() == ("RENDER_CLIP",)
    monkeypatch.setenv("RENDER_WORKER_CONCURRENCY", "12")
    assert worker_concurrency() == 8


def test_render_exclusive_mode_excludes_default_lane(monkeypatch):
    monkeypatch.setenv("WORKER_LANE", "default")
    monkeypatch.setenv("RENDER_WORKER_EXCLUSIVE", "1")
    assert "RENDER_CLIP" not in lane_types()
    assert "PRODUCER_TRANSCRIBE" in lane_types()
