"""C2 clipfind — beats, boundaries, John eval set (flags default OFF)."""
from __future__ import annotations

import json

import pytest

from clips_worker.clipfind.beats import (
    ClipBeats,
    apply_beats_to_bounds,
    build_variants,
    compute_beats_heuristic,
    reaction_end_ms,
)
from clips_worker.clipfind.c2_boundaries import trim_over_max_preserve_payoff, validate_render_window
from clips_worker.clipfind.context import bind_clipfind, unbind_clipfind
from clips_worker.clipfind.eval_john import FIXTURES, eval_summary, run_john_eval, score_case
from clips_worker.clipfind.flags import clipfind_flag, resolved_clipfind_flags
from clips_worker.visual_boundaries import resolve_boundaries_for_window

FIXTURE_NAMES = [
    "case1_badge_streak.json",
    "case2_plan_execution.json",
    "case3_answer_question.json",
    "case4_quiet_joke.json",
    "case5_quiet_visual.json",
    "case6_loud_false_alarm.json",
]


@pytest.fixture(autouse=True)
def _clipfind_env(monkeypatch):
    for name in resolved_clipfind_flags():
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("CLIPFIND_BEATS_SHADOW", "1")
    monkeypatch.setenv("CLIPFIND_DROP_LEDGER", "1")
    bind_clipfind(workspace_id="ws", job_type="STREAM_ANALYZE")
    yield
    unbind_clipfind()


def test_c2_flags_default_off():
    assert clipfind_flag("CLIPFIND_SETUP_LOOKBACK") is False
    assert clipfind_flag("CLIPFIND_BEATS_SHADOW") is True


def test_badge_streak_lookback_to_streak_start():
    raw = json.loads((FIXTURES / "case1_badge_streak.json").read_text(encoding="utf-8"))
    duration_s = int(raw["duration_s"])
    curve = [0.2] * duration_s
    for t in range(532, 605):
        curve[t] = 0.9
    beats = compute_beats_heuristic(
        start_ms=598_000,
        end_ms=610_000,
        range_start_ms=0,
        range_end_ms=duration_s * 1000,
        gemini_moment=raw["gemini_moment"],
        visual_curve=curve,
    )
    assert beats is not None
    assert beats.indicator == "badge"
    assert abs(beats.setup_start_ms - 572_000) <= 2500


def test_resolve_boundaries_flags_off_unchanged_span():
    s, e = 598_000, 610_000
    ns, ne, _, _ = resolve_boundaries_for_window(
        s,
        e,
        llm_row=None,
        video_moments=None,
        range_end_ms=900_000,
    )
    assert ns == s and ne == e


def test_resolve_boundaries_flags_on_expands_setup(monkeypatch):
    monkeypatch.setenv("CLIPFIND_SETUP_LOOKBACK", "1")
    monkeypatch.setenv("CLIPFIND_REACTION_TAIL", "1")
    raw = json.loads((FIXTURES / "case1_badge_streak.json").read_text(encoding="utf-8"))
    duration_s = int(raw["duration_s"])
    curve = [0.2] * duration_s
    for t in range(532, 605):
        curve[t] = 0.9
    s, e = 598_000, 610_000
    ns, ne, _, _ = resolve_boundaries_for_window(
        s,
        e,
        llm_row=None,
        video_moments=[{**raw["gemini_moment"], "_curve": curve}],
        range_end_ms=duration_s * 1000,
    )
    assert ns <= 572_000 + 2500
    assert ne >= e


def test_loud_false_alarm_no_lookback_inflation(monkeypatch):
    monkeypatch.setenv("CLIPFIND_SETUP_LOOKBACK", "1")
    raw = json.loads((FIXTURES / "case6_loud_false_alarm.json").read_text(encoding="utf-8"))
    duration_s = int(raw["duration_s"])
    s, e = 300_000, 330_000
    beats = compute_beats_heuristic(
        start_ms=s,
        end_ms=e,
        range_end_ms=duration_s * 1000,
        gemini_moment={"peak_s": 310, "what_happened": "chat emote spam no gameplay event"},
        visual_curve=[0.95] * duration_s,
        chat_energy=[0.95] * duration_s,
    )
    assert beats is not None
    assert beats.indicator == "none"
    ns, ne = apply_beats_to_bounds(s, e, beats, range_end_ms=duration_s * 1000)
    assert ns == s and ne == e


def test_trim_setup_first_never_cuts_payoff(monkeypatch):
    monkeypatch.setenv("CLIPFIND_TRIM_SETUP_FIRST", "1")
    beats = ClipBeats(
        setup_start_ms=100_000,
        event_ms=150_000,
        payoff_ms=200_000,
        reaction_end_ms=220_000,
        indicator="kill",
        source="heuristic",
        confidence=0.8,
    )
    s, e = trim_over_max_preserve_payoff(100_000, 250_000, 60_000, beats)
    assert e - s <= 60_000
    assert e >= beats.payoff_ms + 1000


def test_reaction_tail_capped_at_15s():
    end = reaction_end_ms(0, range_end_ms=600_000, audio_energy=[0.1] * 600, cap_s=15.0)
    assert end <= 15_000


def test_variants_clamp_stream_offset(monkeypatch):
    monkeypatch.setenv("CLIPFIND_VARIANTS", "1")
    beats = ClipBeats(
        setup_start_ms=10_000,
        event_ms=20_000,
        payoff_ms=25_000,
        reaction_end_ms=30_000,
        indicator="badge",
        source="heuristic",
        confidence=0.9,
    )
    v = build_variants(beats, start_ms=12_000, end_ms=28_000, range_start_ms=0, range_end_ms=120_000, time_offset_ms=5000)
    assert v["standard"]["startMs"] == 17_000
    assert v["tight"]["startMs"] >= 5_000


def test_john_eval_offline_shadow_scores():
    rows_off = run_john_eval(flags_on=False)
    assert len(rows_off) == 6
    summary_off = eval_summary(rows_off)
    assert summary_off["found"] == 6


def test_john_eval_flags_on_badge_case(monkeypatch):
    monkeypatch.setenv("CLIPFIND_SETUP_LOOKBACK", "1")
    raw = json.loads((FIXTURES / "case1_badge_streak.json").read_text(encoding="utf-8"))
    row = score_case(raw, flags_on=True)
    assert row["right_footage"] is True


def test_validate_aftermath_only_flags_on(monkeypatch):
    monkeypatch.setenv("CLIPFIND_VALIDATE_WINDOW", "1")
    beats = ClipBeats(
        setup_start_ms=100_000,
        event_ms=150_000,
        payoff_ms=200_000,
        reaction_end_ms=220_000,
        indicator="kill",
        source="heuristic",
        confidence=0.8,
    )
    out = validate_render_window(start_ms=205_000, end_ms=230_000, beats=beats)
    assert out.get("aftermath_only") is True
    assert out.get("valid") is False
