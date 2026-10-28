"""Enforce minimum clip length after boundary snap (streamer analyze)."""
from __future__ import annotations

from clips_worker.picker.extend_setup import extend_pick_to_min_duration
from clips_worker.picker.sentences import build_sentences
from clips_worker.streamer.fusion import FusionPick
from clips_worker.target_clip_len import ABS_MIN_MS, resolve_clip_length_policy


def enforce_min_length_after_snap(
    pick: FusionPick,
    words: list[dict],
    *,
    range_start_ms: int,
    range_end_ms: int,
    settings: dict,
    min_ms: int | None = None,
) -> FusionPick | None:
    """Expand to sentence bounds up to min_ms, or return None to drop."""
    if not words:
        return None
    policy = resolve_clip_length_policy(settings)
    floor_ms = int(min_ms if min_ms is not None else max(ABS_MIN_MS, policy.min_ms))
    sentences = build_sentences(words, range_start_ms, range_end_ms)
    if not sentences:
        return None
    clip = {
        "start_ms": int(pick.start_ms),
        "end_ms": int(pick.end_ms),
        "title": pick.title,
        "hook": pick.hook,
        "length_max_ms": policy.max_ms,
    }
    meta = pick.ai_meta or {}
    if meta.get("boundary_setup_ms") is not None:
        clip["boundary_setup_ms"] = meta.get("boundary_setup_ms")
    if meta.get("boundary_payoff_ms") is not None:
        clip["boundary_payoff_ms"] = meta.get("boundary_payoff_ms")
    for i, sent in enumerate(sentences):
        if sent.end_ms >= clip["start_ms"] and sent.start_ms <= clip["end_ms"]:
            clip.setdefault("start_sentence", i)
            clip["end_sentence"] = i
    clip.setdefault("start_sentence", 0)
    clip.setdefault("end_sentence", min(len(sentences) - 1, clip["start_sentence"]))

    extend_pick_to_min_duration(
        clip,
        sentences,
        {},
        words,
        range_start_ms,
        range_end_ms,
        min_ms=floor_ms,
        max_ms=policy.max_ms,
    )
    dur = int(clip["end_ms"]) - int(clip["start_ms"])
    if dur < floor_ms:
        return None
    pick.start_ms = int(clip["start_ms"])
    pick.end_ms = int(clip["end_ms"])
    return pick
