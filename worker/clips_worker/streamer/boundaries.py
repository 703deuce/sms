"""Snap stream moment windows to sentence boundaries (B snap_bounds)."""
from __future__ import annotations

from clips_worker.picker.sentences import build_sentences
from clips_worker.picker.snap_bounds import snap_bounds
from clips_worker.streamer.fusion import FusionPick


def snap_fusion_pick(
    pick: FusionPick,
    words: list[dict],
    *,
    range_start_ms: int = 0,
    range_end_ms: int,
    length_max_ms: int | None = None,
) -> FusionPick:
    if not words:
        return pick
    sentences = build_sentences(words, range_start_ms, range_end_ms)
    clip = {
        "start_ms": pick.start_ms,
        "end_ms": pick.end_ms,
        "length_max_ms": length_max_ms
        if length_max_ms is not None
        else min(90_000, pick.end_ms - pick.start_ms + 15_000),
    }
    meta = pick.ai_meta or {}
    if meta.get("boundary_setup_ms") is not None:
        clip["boundary_setup_ms"] = meta["boundary_setup_ms"]
    if meta.get("boundary_payoff_ms") is not None:
        clip["boundary_payoff_ms"] = meta["boundary_payoff_ms"]
    snap_bounds(clip, words, sentences, range_start_ms, range_end_ms)
    pick.start_ms = int(clip["start_ms"])
    pick.end_ms = int(clip["end_ms"])
    return pick
