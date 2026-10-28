"""Batch S worker regression tests."""
from __future__ import annotations

from pathlib import Path

from clips_worker.clip_keep_segments import keep_segments
from clips_worker.clip_layout_policy import resolve_content_layout_mode
from clips_worker.picker.public_copy import headline_text_from_pick, is_internal_picker_note


def test_a2_keep_segments_ignores_cut_past_trim_end():
    segs = keep_segments(38_650, 72_735, [[80_000, 90_000]])
    assert segs == [(38_650, 72_735)]


def test_a2_keep_segments_ignores_cut_before_trim():
    segs = keep_segments(139_300, 163_200, [[121_000, 133_000]])
    assert segs == [(139_300, 163_200)]


def test_a3_gameplay_layout_policy():
    mode, reason = resolve_content_layout_mode(archetype="gameplay_action", headline_on=False)
    assert mode == "fit_blur" and reason == "gameplay_archetype"
    mode2, _ = resolve_content_layout_mode(archetype="gameplay_action", headline_on=True)
    assert mode2 == "fit_top"
    mode3, reason3 = resolve_content_layout_mode(archetype="podcast_interview", headline_on=False)
    assert mode3 == "speaker_follow" and reason3 == "talking_head_archetype"


def test_a6_no_pass1_why_as_headline():
    assert is_internal_picker_note("coverage_span fallback")
    pick = {"title": "Real clip title", "pass1_why": "coverage_span seed", "hook": "internal"}
    assert headline_text_from_pick(pick) == "Real clip title"


def test_a1_pipeline_awaits_before_prune():
    src = Path(__file__).resolve().parents[1].joinpath("clips_worker/pipeline.py").read_text(encoding="utf-8")
    await_i = src.index("await_headstart_render(")
    prune_i = src.index("prune_headstart_to_planned(", await_i)
    assert await_i < prune_i


def test_a7_shortfall_retry_includes_duration():
    src = Path(__file__).resolve().parents[1].joinpath("clips_worker/video_picker.py").read_text(encoding="utf-8")
    assert "shortfall_vs_min_moments" in src
    assert "The video is exactly" in src and "shortfall_retries" in src


def test_a4_modal_render_timeout():
    src = Path(__file__).resolve().parents[1].joinpath("clips_worker/gpu/modal_provider.py").read_text(encoding="utf-8")
    assert "MODAL_RENDER_TIMEOUT_SEC" in src
    assert "FuturesTimeoutError" in src


def test_a5_export_decision_log():
    src = Path(__file__).resolve().parents[1].joinpath("clips_worker/render_job.py").read_text(encoding="utf-8")
    assert "bind_decision_log" in src
    assert '_export_decision(\n        render_id,\n        "inputs"' in src or '"inputs"' in src and "_export_decision" in src
