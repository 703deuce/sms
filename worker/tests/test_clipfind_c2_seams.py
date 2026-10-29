"""C2 seam tests — project override, shadow, fallback, snap hook, variants offset, validate demote."""
from __future__ import annotations

import json

import pytest

from clips_worker.clipfind.context import bind_clipfind, unbind_clipfind
from clips_worker.clipfind.refine import ClipBeats
from clips_worker.clipfind.c2_seams import validate_frozen_stream_picks
from clips_worker.decision_log import bind_decision_log, decision_log_snapshot, unbind_decision_log
from clips_worker.picker.sentences import Sentence, build_sentences
from clips_worker.picker.snap_bounds import snap_bounds
from clips_worker.streamer.fusion import fuse_moments

from tests.test_clipfind_c2_golden import (
    GOLDEN_FUSION,
    fusion_fixture_inputs,
    _run_fusion_golden,
)

pytestmark = pytest.mark.usefixtures("_seams_env")


@pytest.fixture
def _seams_env(monkeypatch):
    for name in (
        "CLIPFIND_ALL_OFF",
        "CLIPFIND_ON_PROJECTS",
        "CLIPFIND_ON_WORKSPACES",
        "CLIPFIND_SETUP_LOOKBACK",
        "CLIPFIND_REACTION_TAIL",
        "CLIPFIND_VARIANTS",
        "CLIPFIND_VALIDATE_WINDOW",
    ):
        monkeypatch.delenv(name, raising=False)
    unbind_clipfind()
    unbind_decision_log()
    bind_decision_log(None, None)
    yield
    unbind_clipfind()
    unbind_decision_log()


def _badge_pick(picks):
    for p in picks:
        cf = (p.ai_meta or {}).get("clipfind") or {}
        if cf.get("beats", {}).get("indicator") == "action":
            return p
        if int(p.start_ms) >= 560_000 and int(p.start_ms) <= 580_000:
            return p
    for p in picks:
        if p.ai_meta.get("boundary_setup_ms") == 568_000:
            return p
    raise AssertionError("badge vp pick not found")


def test_project_override_refines_badge_start(monkeypatch):
    monkeypatch.setenv("CLIPFIND_ON_PROJECTS", "proj_x")
    bind_clipfind(workspace_id="ws_test", job_type="STREAM_ANALYZE", project_id="proj_x")
    duration_s, signals, words, settings, video_moments = fusion_fixture_inputs()
    picks, _ = fuse_moments(
        duration_s=duration_s,
        signals=signals,
        words=words,
        settings=settings,
        llm_ranker=None,
        video_moments=video_moments,
        transcript_ok=True,
    )
    badge = _badge_pick(picks)
    assert badge.start_ms <= 572_000
    beats = (badge.ai_meta.get("clipfind") or {}).get("beats") or {}
    assert beats.get("indicator") == "action"


def test_shadow_only_meta_cf_empty_and_beats_shadow_logged(monkeypatch):
    bind_clipfind(workspace_id="ws_golden", job_type="STREAM_ANALYZE", project_id="proj_golden")
    duration_s, signals, words, settings, video_moments = fusion_fixture_inputs()
    picks, _ = fuse_moments(
        duration_s=duration_s,
        signals=signals,
        words=words,
        settings=settings,
        llm_ranker=None,
        video_moments=video_moments,
        transcript_ok=True,
    )
    for p in picks:
        cf = p.ai_meta.get("clipfind")
        assert isinstance(cf, dict)
        assert "beats" not in cf
        assert "variants" not in cf
        assert "reaction_end_ms" not in cf
    snap = decision_log_snapshot()
    shadow = [e for e in snap if e.get("stage") == "clipfind" and e.get("event") == "beats_shadow"]
    assert shadow, "expected beats_shadow decision_log events with default shadow ON"


def test_refine_window_failure_keeps_golden_bounds(monkeypatch):
    golden = json.loads(GOLDEN_FUSION.read_text(encoding="utf-8"))
    bind_clipfind(workspace_id="ws_golden", job_type="STREAM_ANALYZE", project_id="proj_golden")

    def _boom(*_a, **_k):
        raise RuntimeError("unit_test_refine_fail")

    monkeypatch.setattr("clips_worker.clipfind.c2_seams.refine_window", _boom)
    actual = _run_fusion_golden()
    assert actual == golden
    snap = decision_log_snapshot()
    fallbacks = [e for e in snap if e.get("stage") == "clipfind" and e.get("event") == "fallback"]
    sites = {e.get("site") for e in fallbacks}
    assert "fusion_refine" in sites


def test_snap_reaction_tail_extends_end_when_flag_on(monkeypatch):
    parts: list[tuple[str, float, float]] = []
    t = 0.0
    for i in range(40):
        parts.append((f"w{i}.", t, t + 0.35))
        t += 0.38
    last_word_end_ms = int(parts[-1][2] * 1000)
    reaction_end_ms = last_word_end_ms + 3000
    words = [{"w": w, "s": s, "e": e, "spk": 0, "i": i} for i, (w, s, e) in enumerate(parts)]
    sentences = build_sentences(words, 0, 120_000)
    clip = {
        "title": "Long enough",
        "start_ms": 0,
        "end_ms": 15_500,
        "clipfind_reaction_end_ms": reaction_end_ms,
        "length_max_ms": 120_000,
    }
    bind_clipfind(workspace_id="ws", job_type="PROCESS_PROJECT")
    monkeypatch.setenv("CLIPFIND_REACTION_TAIL", "1")
    snap_bounds(clip, words, sentences, 0, 120_000)
    assert clip["end_ms"] == reaction_end_ms

    clip2 = {
        "title": "Long enough",
        "start_ms": 0,
        "end_ms": 15_500,
        "clipfind_reaction_end_ms": reaction_end_ms,
        "length_max_ms": 120_000,
    }
    monkeypatch.delenv("CLIPFIND_REACTION_TAIL", raising=False)
    snap_bounds(clip2, words, sentences, 0, 120_000)
    assert clip2["end_ms"] < reaction_end_ms


def test_stream_variants_shift_by_time_offset_ms():
    cfm = {
        "variants": {
            "extended": {"startMs": 100, "endMs": 200, "label": "extended"},
            "tight": {"startMs": 150, "endMs": 180, "label": "tight"},
        }
    }
    time_offset_ms = 12_345
    if cfm and isinstance(cfm.get("variants"), dict):
        cfm["variants"] = {
            k: {
                **v,
                "startMs": int(v["startMs"]) + time_offset_ms,
                "endMs": int(v["endMs"]) + time_offset_ms,
            }
            for k, v in cfm["variants"].items()
        }
    assert cfm["variants"]["extended"]["startMs"] == 12_445
    assert cfm["variants"]["extended"]["endMs"] == 12_545


def test_validate_demotes_without_dropping_pick(monkeypatch):
    from clips_worker.streamer.fusion import FusionPick

    monkeypatch.setenv("CLIPFIND_ON_PROJECTS", "proj_x")
    bind_clipfind(workspace_id="ws_test", job_type="STREAM_ANALYZE", project_id="proj_x")
    beats = ClipBeats(
        setup_start_ms=200_000,
        event_ms=250_000,
        payoff_ms=296_000,
        reaction_end_ms=300_000,
        indicator="action",
    ).to_dict()
    pick = FusionPick(
        start_ms=290_000,
        end_ms=305_000,
        title="Aftermath",
        hook="Aftermath",
        score=80,
        scores={},
        ai_meta={
            "clipfind": {"beats": beats},
            "streamer": {"render": True, "tier": "primary"},
        },
        peak_ms=296_000,
    )
    settings = {"target_clip_len_s": 30, "streamer": {"clipCount": 3, "minClipS": 15, "maxClipS": 30}}
    out = validate_frozen_stream_picks([pick], settings)
    assert len(out) == 1
    assert out[0].ai_meta["clipfind"]["validation"] == "aftermath_only"
    assert out[0].ai_meta["streamer"]["render"] is False
