"""C3 seam tests — flags on via CLIPFIND_ON_PROJECTS=proj_x."""
from __future__ import annotations

import json
from pathlib import Path
from unittest import mock

import pytest

from clips_worker.clipfind.c3_seams import (
    gemini_dense_call,
    judge_total,
    log_job_cost,
    post_rank_stream,
)
from clips_worker.clipfind.context import bind_clipfind, unbind_clipfind
from clips_worker.clipfind.judge import JUDGE_BATCH_SCHEMA, JUDGE_SYSTEM_BATCH
from clips_worker.decision_log import bind_decision_log, decision_log_snapshot, unbind_decision_log
from clips_worker.streamer.fusion import FusionPick, fuse_moments
from clips_worker.streamer.llm_rank import rank_candidates_batch

from tests.test_clipfind_c3_golden import GOLDEN_RANK, _run_rank_golden

pytestmark = pytest.mark.usefixtures("_seams_env")


@pytest.fixture
def _seams_env(monkeypatch):
    for name in (
        "CLIPFIND_ALL_OFF",
        "CLIPFIND_ON_PROJECTS",
        "CLIPFIND_ON_WORKSPACES",
        "CLIPFIND_DENSE_FRAME_INTERVAL_S",
    ):
        monkeypatch.delenv(name, raising=False)
    unbind_clipfind()
    unbind_decision_log()
    bind_decision_log(None, None)
    yield
    unbind_clipfind()
    unbind_decision_log()


def test_judge_v2_uses_judge_prompt(monkeypatch):
    monkeypatch.setenv("CLIPFIND_ON_PROJECTS", "proj_x")
    bind_clipfind(workspace_id="ws_test", job_type="STREAM_ANALYZE", project_id="proj_x")
    captured = {}

    def fake_chat_json(system, user, schema, label):
        captured["system"] = system
        captured["schema"] = schema
        return {
            "candidates": [
                {
                    "id": "cand_0",
                    "archetype": "banter",
                    "event_present": True,
                    "setup_start_s": 115.0,
                    "payoff_s": 130.0,
                    "reaction_end_s": 140.0,
                    "hook_s": 118.0,
                    "beat_evidence": {"setup": "x", "payoff": "y", "reaction": "z"},
                    "criteria": {
                        "payoff": 8,
                        "standalone": 7,
                        "hook": 7,
                        "reaction": 8,
                        "rewatch": 7,
                    },
                    "penalties": {"context_needed": 0, "boundary": 0, "risk": 0},
                    "score": 7.5,
                    "quiet_moment": False,
                    "standalone_ok": True,
                    "risk_flags": [],
                    "observation_confidence": 0.8,
                    "why": "funny",
                    "title": "Moment",
                    "verdict": "advance",
                }
            ]
        }

    batch = [
        {
            "id": "cand_0",
            "start_ms": 120_000,
            "end_ms": 155_000,
            "peak_ms": 130_000,
            "signal_peak": 0.7,
        }
    ]
    import clips_worker.picker.llm as llm_mod
    import clips_worker.streamer.llm_rank as llm_rank_mod

    with mock.patch.object(llm_mod, "chat_json", fake_chat_json), mock.patch.object(
        llm_rank_mod, "chat_json", fake_chat_json
    ):
        rows = rank_candidates_batch(batch, [], {"audio": [0.1] * 200})
    assert captured["system"] == JUDGE_SYSTEM_BATCH
    assert captured["schema"] == JUDGE_BATCH_SCHEMA
    assert rows[0]["keep"] is True
    assert "_judge" in rows[0]


def test_judge_v2_fallback_on_error(monkeypatch):
    monkeypatch.setenv("CLIPFIND_ON_PROJECTS", "proj_x")
    bind_clipfind(workspace_id="ws_test", job_type="STREAM_ANALYZE", project_id="proj_x")
    import clips_worker.picker.llm as llm_mod
    import clips_worker.streamer.llm_rank as llm_rank_mod

    batch = [{"id": "cand_0", "start_ms": 0, "end_ms": 15_000, "peak_ms": 5000, "signal_peak": 0.5}]
    legacy_payload = {
        "candidates": [
            {
                "id": "cand_0",
                "score": 50,
                "keep": True,
                "title": "t",
                "hook": "h",
                "category": "funny",
                "suggestedCaption": None,
                "hashtags": [],
                "setup_start_s": None,
                "payoff_end_s": None,
            }
        ]
    }
    chat = mock.Mock(side_effect=[RuntimeError("judge fail"), legacy_payload])
    with mock.patch.object(llm_mod, "chat_json", chat), mock.patch.object(llm_rank_mod, "chat_json", chat):
        rows = rank_candidates_batch(batch, [], {"audio": [0.1] * 60})
    snap = decision_log_snapshot()
    assert any(e.get("event") == "fallback" and e.get("site") == "judge_v2" for e in snap)
    assert rows[0]["score"] == 50


def test_judge_total_quiet_beats_loud(monkeypatch):
    monkeypatch.setenv("CLIPFIND_ON_PROJECTS", "proj_x")
    bind_clipfind(workspace_id="ws_test", job_type="STREAM_ANALYZE", project_id="proj_x")
    meta_cf = {}
    quiet_llm = {
        "id": "quiet",
        "_judge": {
            "score": 8.5,
            "observation_confidence": 0.9,
            "verdict": "advance",
            "archetype": "funny_banter",
            "risk_flags": [],
        },
    }
    loud_llm = {
        "id": "loud",
        "_judge": {
            "score": 2.5,
            "observation_confidence": 0.9,
            "verdict": "advance",
            "archetype": "other",
            "risk_flags": [],
        },
    }
    quiet_score = judge_total(quiet_llm, 40, meta_cf)
    loud_score = judge_total(loud_llm, 95, meta_cf)
    assert quiet_score >= loud_score


def test_judge_floor_vp_id(monkeypatch):
    monkeypatch.setenv("CLIPFIND_ON_PROJECTS", "proj_x")
    bind_clipfind(workspace_id="ws_test", job_type="STREAM_ANALYZE", project_id="proj_x")
    meta = {}
    llm = {
        "id": "vp_0",
        "_judge": {
            "score": 5.0,
            "observation_confidence": 0.9,
            "verdict": "advance",
            "archetype": "skill",
            "risk_flags": [],
        },
    }
    assert judge_total(llm, 85, meta) == 85
    llm2 = {
        "id": "cand_loud",
        "_judge": {
            "score": 5.0,
            "observation_confidence": 0.9,
            "verdict": "demote",
            "archetype": "other",
            "risk_flags": ["minor"],
            "risk_action": "demote",
        },
    }
    assert judge_total(llm2, 85, {}) == 50


def test_rank_golden_off_matches_file(monkeypatch):
    actual = _run_rank_golden()
    expected = json.loads(GOLDEN_RANK.read_text(encoding="utf-8"))
    assert actual == expected


def test_log_job_cost_emits(monkeypatch):
    bind_clipfind(workspace_id="ws_test", job_type="STREAM_ANALYZE", project_id="proj_golden")
    log_job_cost(broad_usd=0.02, dense_usd=0.01, analysed_ms=600_000, judge_on=False, t0=0.0)
    snap = decision_log_snapshot()
    assert any(e.get("event") == "cost" and e.get("dense_usd") == 0.01 for e in snap)


def test_log_job_cost_all_off(monkeypatch):
    monkeypatch.setenv("CLIPFIND_ALL_OFF", "1")
    bind_clipfind(workspace_id="ws_test", job_type="STREAM_ANALYZE", project_id="proj_golden")
    log_job_cost(broad_usd=0.02, dense_usd=0.01, analysed_ms=600_000, judge_on=False, t0=0.0)
    snap = decision_log_snapshot()
    assert not any(e.get("event") == "cost" for e in snap)


def test_dense_skipped_no_source(monkeypatch):
    monkeypatch.setenv("CLIPFIND_ON_PROJECTS", "proj_x")
    bind_clipfind(workspace_id="ws_test", job_type="STREAM_ANALYZE", project_id="proj_x")
    picks = [
        FusionPick(
            start_ms=0,
            end_ms=15_000,
            peak_ms=5000,
            score=80,
            title="t",
            hook="h",
            scores={"total": 80},
            ai_meta={"streamer": {"tier": "primary", "render": True}},
        )
    ]
    out, usd = post_rank_stream(
        picks,
        words=[],
        signals_payload={},
        duration_ms=60_000,
        settings={},
        scratch=Path("/tmp/nonexistent_scratch_c3"),
        state={},
        chat_messages=None,
        time_offset_ms=0,
    )
    assert usd == 0.0
    assert out[0].start_ms == picks[0].start_ms
    snap = decision_log_snapshot()
    assert any(e.get("event") == "dense_skipped_no_source" for e in snap)


def test_dense_fps_clamped(monkeypatch):
    monkeypatch.setenv("CLIPFIND_ON_PROJECTS", "proj_x")
    monkeypatch.setenv("CLIPFIND_DENSE_FRAME_INTERVAL_S", "0.1")
    bind_clipfind(workspace_id="ws_test", job_type="STREAM_ANALYZE", project_id="proj_x")
    from clips_worker.clipfind import dense as D

    assert D.dense_frame_interval_s() >= 2.0
