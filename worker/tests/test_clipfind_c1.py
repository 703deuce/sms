"""C1 clipfind tests — flags, ledger, golden pin, shadow."""
from __future__ import annotations

import os

import pytest

from clips_worker.clipfind.context import JobCtx, bind_clipfind, unbind_clipfind
from clips_worker.clipfind.fair_rank import classify_gate, fair_rank_skipped_short, span_iou_ms
from clips_worker.clipfind.flags import clipfind_flag, resolved_clipfind_flags
from clips_worker.clipfind.ledger import CandidateLedger, cf_id_for
from clips_worker.streamer.fusion import fuse_moments


@pytest.fixture(autouse=True)
def _clipfind_env(monkeypatch):
    monkeypatch.delenv("CLIPFIND_ALL_OFF", raising=False)
    monkeypatch.delenv("CLIPFIND_ON_WORKSPACES", raising=False)
    for name in resolved_clipfind_flags():
        monkeypatch.delenv(name, raising=False)
    unbind_clipfind()
    yield
    unbind_clipfind()


def test_flag_precedence_all_off(monkeypatch):
    monkeypatch.setenv("CLIPFIND_DROP_LEDGER", "1")
    monkeypatch.setenv("CLIPFIND_ALL_OFF", "1")
    bind_clipfind(workspace_id="ws_test", job_type="PROCESS_PROJECT")
    assert clipfind_flag("CLIPFIND_DROP_LEDGER") is False
    assert clipfind_flag("CLIPFIND_NEVER_EMPTY") is False


def test_workspace_override_behavior_only(monkeypatch):
    monkeypatch.setenv("CLIPFIND_ON_WORKSPACES", "ws_alpha")
    bind_clipfind(workspace_id="ws_alpha", job_type="STREAM_ANALYZE")
    assert clipfind_flag("CLIPFIND_NEVER_EMPTY") is True
    assert clipfind_flag("CLIPFIND_DROP_LEDGER") is True
    bind_clipfind(workspace_id="ws_other", job_type="STREAM_ANALYZE")
    assert clipfind_flag("CLIPFIND_NEVER_EMPTY") is False


def test_ledger_terminal_orphan_free():
    led = CandidateLedger()
    a = cf_id_for(source="t", start_ms=0, end_ms=1000, peak_ms=500)
    b = cf_id_for(source="t", start_ms=2000, end_ms=3000, peak_ms=2500)
    led.register(a, provenance="gemini_chunk", start_ms=0, end_ms=1000)
    led.register(b, provenance="gemini_chunk", start_ms=2000, end_ms=3000)
    led.dropped(a, "test", "unit")
    led.returned(b, "primary")
    summary = led.summary()
    assert summary["orphanCount"] == 0


def test_fusion_golden_flags_off(monkeypatch):
    monkeypatch.setenv("CLIPFIND_ALL_OFF", "1")
    bind_clipfind(workspace_id="ws", job_type="STREAM_ANALYZE")
    duration_s = 120
    audio = [0.1] * 60 + [0.9] + [0.1] * 59
    signals = {"audio": audio, "transcript": [0.0] * duration_s, "chat": None, "viewerClips": None}
    picks, payload = fuse_moments(
        duration_s=duration_s,
        signals=signals,
        words=[],
        settings={"streamer": {"clipCount": 3, "minClipS": 10, "maxClipS": 60}},
    )
    assert picks
    assert picks[0].score >= picks[-1].score
    assert "clipfind_shadow" not in payload or payload.get("clipfind_shadow") is None


def test_shadow_does_not_change_picks(monkeypatch):
    monkeypatch.setenv("CLIPFIND_SHADOW_RANK", "0")
    bind_clipfind(workspace_id="ws", job_type="STREAM_ANALYZE")
    duration_s = 180
    curve = [0.05] * duration_s
    curve[90] = 0.9
    signals = {"audio": curve, "transcript": [0.1] * duration_s, "chat": None, "viewerClips": None}
    settings = {"streamer": {"clipCount": 5, "minClipS": 15, "maxClipS": 60}}
    picks_off, _ = fuse_moments(duration_s=duration_s, signals=signals, words=[], settings=settings)
    monkeypatch.setenv("CLIPFIND_SHADOW_RANK", "1")
    picks_on, payload = fuse_moments(duration_s=duration_s, signals=signals, words=[], settings=settings)
    assert [(p.start_ms, p.end_ms, p.score) for p in picks_off] == [
        (p.start_ms, p.end_ms, p.score) for p in picks_on
    ]
    assert payload.get("clipfind_shadow") is not None


def test_peak_iou_merge_mode():
    m1 = {"start_s": 0, "end_s": 30, "peak_s": 10, "score": 0.9}
    m2 = {"start_s": 5, "end_s": 35, "peak_s": 12, "score": 0.8}
    from clips_worker.video_picker import merge_stream_moments

    out = merge_stream_moments([m1, m2], 45, mode="peak_iou")
    assert len(out) == 1
    assert out[0].get("alternates")


def test_classify_gate_investigate_vs_advance():
    assert classify_gate({"visual": 0.9}) == "ADVANCE"
    assert classify_gate({"reaction": 0.9}) == "INVESTIGATE"
    assert classify_gate({"talk": 0.5, "visual": 0.5}) == "POOL"


def test_fair_rank_skipped_short_upload():
    assert fair_rank_skipped_short(31) is True
    assert fair_rank_skipped_short(300) is False


def test_span_iou():
    assert span_iou_ms(0, 1000, 500, 1500) > 0.3
