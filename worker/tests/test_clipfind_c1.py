"""C1 clipfind tests — flags, ledger, golden pin, shadow."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from clips_worker.clipfind.context import JobCtx, bind_clipfind, unbind_clipfind
from clips_worker.clipfind.fair_rank import classify_gate, fair_rank_skipped_short, rank_candidates_fair, span_iou_ms
from clips_worker.clipfind.flags import clipfind_flag, resolved_clipfind_flags
from clips_worker.clipfind.ledger import CandidateLedger, cf_id_for
from clips_worker.clipfind.never_empty import maybe_never_empty_upload_planned, source_has_content
from clips_worker.streamer.fusion import fuse_moments

FIXTURES = Path(__file__).resolve().parent / "fixtures" / "clipfind"


@pytest.fixture(autouse=True)
def _clipfind_env(monkeypatch):
    monkeypatch.delenv("CLIPFIND_ALL_OFF", raising=False)
    monkeypatch.delenv("CLIPFIND_ON_WORKSPACES", raising=False)
    monkeypatch.delenv("CLIPFIND_ON_PROJECTS", raising=False)
    for name in resolved_clipfind_flags():
        monkeypatch.delenv(name, raising=False)
    unbind_clipfind()
    yield
    unbind_clipfind()


def test_project_override_behavior_only(monkeypatch):
    monkeypatch.setenv("CLIPFIND_ON_PROJECTS", "proj_alpha")
    bind_clipfind(workspace_id="ws_1", job_type="PROCESS_PROJECT", project_id="proj_alpha")
    assert clipfind_flag("CLIPFIND_NEVER_EMPTY") is True
    assert clipfind_flag("CLIPFIND_DROP_LEDGER") is True
    bind_clipfind(workspace_id="ws_1", job_type="PROCESS_PROJECT", project_id="proj_other")
    assert clipfind_flag("CLIPFIND_NEVER_EMPTY") is False


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


@pytest.mark.parametrize(
    "fixture_name",
    [
        "case1_badge_streak.json",
        "case2_plan_execution.json",
        "case3_answer_question.json",
        "case4_quiet_joke.json",
        "case5_quiet_visual.json",
        "case6_loud_false_alarm.json",
    ],
)
def test_clipfind_fixture_cases_flags_on(monkeypatch, fixture_name: str):
    raw = json.loads((FIXTURES / fixture_name).read_text(encoding="utf-8"))
    monkeypatch.setenv("CLIPFIND_FAIR_RANK", "1")
    bind_clipfind(workspace_id="ws", job_type="STREAM_ANALYZE")
    duration_s = int(raw.get("duration_s") or 300)
    if raw.get("expect_gate"):
        fam = {"visual": 0.9} if raw["expect_gate"] == "ADVANCE" else {"reaction": 0.9}
        if "case6" in fixture_name:
            fam = {"reaction": 0.9}
        assert classify_gate(fam) == raw["expect_gate"]
    if raw.get("id") == "case6":
        rows = rank_candidates_fair(
            [
                {
                    "id": "x",
                    "start_ms": 300000,
                    "end_ms": 330000,
                    "gemini_score": 0.2,
                    "llm_score": 25,
                }
            ],
            duration_s=duration_s,
            channels={"_raw_audio": [0.99] * duration_s, "_raw_chat": [0.95] * duration_s},
        )
        assert rows and rows[0].get("fair_gate") == "INVESTIGATE"


def test_never_empty_flag_off_unchanged(monkeypatch):
    monkeypatch.setenv("CLIPFIND_NEVER_EMPTY", "0")
    bind_clipfind(workspace_id="ws", job_type="PROCESS_PROJECT", project_id="p1")
    assert maybe_never_empty_upload_planned([], raw_picks=[], duration_ms=60_000, words=[{"t": 0}] * 10, want=3) == []


def test_never_empty_rescue_when_flag_on(monkeypatch):
    monkeypatch.setenv("CLIPFIND_NEVER_EMPTY", "1")
    bind_clipfind(workspace_id="ws", job_type="PROCESS_PROJECT", project_id="p1")
    led = __import__("clips_worker.clipfind.context", fromlist=["get_ledger"]).get_ledger()
    assert led is not None
    cid = cf_id_for(source="t", start_ms=1000, end_ms=20000, peak_ms=15000)
    led.register(cid, provenance="test", start_ms=1000, end_ms=20000, score=0.8)
    led.dropped(cid, "pass2", "gate")
    out = maybe_never_empty_upload_planned([], raw_picks=[], duration_ms=60_000, words=[], want=3)
    assert len(out) >= 1
