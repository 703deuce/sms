"""Batch R regression tests (E1–E2, C1–C9)."""
from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from clips_worker.overlap_policy import (
    PICK_OVERLAP_RATIO,
    pick_spans_duplicate,
    spans_match_planned_render,
)
from clips_worker.video_picker import (
    _moment_overlaps_prior,
    _uncovered_section_labels,
    gemini_model_skipped_daily_quota,
    remember_gemini_daily_quota,
)


def test_e1_chat_overlay_gate_no_unbound_local():
    import clips_worker.edits_render as er

    src = Path(er.__file__).read_text(encoding="utf-8")
    assert "from clips_worker.chat_overlay_apply import try_apply_chat_overlay" in src
    assert "chat_overlay_enabled(edits)" not in src


def test_chat_overlay_fail_open_wrapper():
    from clips_worker import chat_overlay_apply as coa

    text = Path(coa.__file__).read_text(encoding="utf-8")
    assert "chat_overlay_skipped" in text
    assert "except Exception" in text


def test_c5_single_overlap_constant():
    assert PICK_OVERLAP_RATIO == 0.35
    assert pick_spans_duplicate(0, 100, 50, 150, ratio=PICK_OVERLAP_RATIO)


def test_c4_headstart_requires_exact_span():
    assert spans_match_planned_render(0, 45_500, 0, 16_700) is False
    assert spans_match_planned_render(0, 45_500, 0, 45_600) is True


def test_c1_reassess_overlap_guard():
    prior = {"start_s": 10.0, "end_s": 40.0}
    assert _moment_overlaps_prior({"start_s": 12, "end_s": 38}, 10.0, 40.0, min_frac=0.25)
    assert not _moment_overlaps_prior({"start_s": 121, "end_s": 133}, 10.0, 40.0, min_frac=0.25)


def test_c8_uncovered_sections_labels():
    sections = [{"start_s": 79, "end_s": 169, "activity": "gaming"}]
    moments = [{"start_s": 0, "end_s": 50, "peak_s": 25, "hook_s": 0}]
    gap = _uncovered_section_labels(sections, moments, 200.0)
    assert gap and "79" in gap[0]


def test_c8_daily_quota_remembered():
    remember_gemini_daily_quota("gemini-x", {"quotaId": "GenerateRequestsPerDayPerProject"})
    assert gemini_model_skipped_daily_quota("gemini-x")


def test_c7_combined_score_weights_and_apex_regression():
    from clips_worker.picker.final_score import (
        TRANSCRIPT_WEIGHT,
        VIDEO_WEIGHT,
        apply_combined_scores,
        combined_final_score,
        rank_sort_key,
    )

    assert VIDEO_WEIGHT == 1.5 and TRANSCRIPT_WEIGHT == 1.0
    assert combined_final_score(0.85, 0.0) == pytest.approx((1.5 * 0.85) / 2.5)
    assert combined_final_score(None, 0.67) == pytest.approx(0.67 / 2.5)

    apex = {
        "title": "Apex win",
        "gemini_score": 0.85,
        "from_visual_watch": True,
        "score_0_100": 0,
        "start_ms": 139_000,
        "end_ms": 163_000,
    }
    apply_combined_scores(apex, log=False)
    talk = {
        "title": "Talk clip",
        "score_0_100": 67,
        "start_ms": 0,
        "end_ms": 60_000,
    }
    apply_combined_scores(talk, log=False)
    assert apex["final_score"] > talk["final_score"]
    assert rank_sort_key(apex) < rank_sort_key(talk)


def test_c6_cleanup_does_not_call_plan_clips():
    import clips_worker.picker.cleanup as cleanup

    src = Path(cleanup.__file__).read_text(encoding="utf-8")
    assert "plan_clips(" not in src


def test_c6_picker_no_synthetic_fallback_spans():
    import clips_worker.picker as picker_mod

    src = Path(picker_mod.__file__).read_text(encoding="utf-8")
    assert "fallback_full_span" not in src
    assert "short_source_emergency" not in src
    assert "span_fallback" not in src
