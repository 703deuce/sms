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
) -> FusionPick:
    if not words:
        return pick
    sentences = build_sentences(words, range_start_ms, range_end_ms)
    clip = {
        "start_ms": pick.start_ms,
        "end_ms": pick.end_ms,
        "length_max_ms": pick.end_ms - pick.start_ms + 15_000,
    }
    snap_bounds(clip, words, sentences, range_start_ms, range_end_ms)
    pick.start_ms = int(clip["start_ms"])
    pick.end_ms = int(clip["end_ms"])
    return pick
