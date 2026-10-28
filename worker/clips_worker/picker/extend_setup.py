"""Extend short picks with setup (before) and follow-through (after) to minimum duration."""
from __future__ import annotations

from clips_worker.picker.log_util import picker_info
from clips_worker.picker.sentences import Sentence
from clips_worker.picker.signals import SentenceSignals
from clips_worker.picker.snap_bounds import snap_bounds


def extend_pick_to_min_duration(
    pick: dict,
    sentences: list[Sentence],
    sig_by: dict[int, SentenceSignals],
    words: list[dict],
    range_start_ms: int,
    range_end_ms: int,
    *,
    min_ms: int,
    max_ms: int,
) -> None:
    """Grow sentence span backward then forward until min_ms or limits; re-snap bounds."""
    max_ms = max(min_ms, int(max_ms))
    dur = int(pick["end_ms"]) - int(pick["start_ms"])
    if dur >= min_ms:
        return
    ss = int(pick.get("start_sentence", 0))
    es = int(pick.get("end_sentence", ss))
    before = (int(pick["start_ms"]), int(pick["end_ms"]))

    def _refresh() -> int:
        pick["start_ms"] = max(range_start_ms, int(sentences[ss].start_ms))
        pick["end_ms"] = min(range_end_ms, int(sentences[es].end_ms))
        return int(pick["end_ms"]) - int(pick["start_ms"])

    dur = _refresh()
    # Setup before (prefer higher-energy lead-in when signals exist).
    while dur < min_ms and ss > 0:
        prev = ss - 1
        trial_ss = prev
        trial_start = max(range_start_ms, int(sentences[trial_ss].start_ms))
        trial_end = int(pick["end_ms"])
        if trial_end - trial_start > max_ms:
            break
        if trial_start >= trial_end:
            break
        sig = sig_by.get(prev) or sig_by.get(sentences[prev].idx)
        ss = trial_ss
        pick["start_sentence"] = ss
        dur = _refresh()
        if sig and sig.rms_z < -0.2 and dur >= min_ms:
            break

    # Follow-through after payoff.
    while dur < min_ms and es < len(sentences) - 1:
        trial_es = es + 1
        trial_end = min(range_end_ms, int(sentences[trial_es].end_ms))
        trial_start = int(pick["start_ms"])
        if trial_end - trial_start > max_ms:
            break
        if trial_end <= trial_start:
            break
        es = trial_es
        pick["end_sentence"] = es
        dur = _refresh()

    snap_bounds(pick, words, sentences, range_start_ms, range_end_ms)
    after_dur = int(pick["end_ms"]) - int(pick["start_ms"])
    if after_dur != before[1] - before[0] or pick["start_ms"] != before[0] or pick["end_ms"] != before[1]:
        picker_info(
            "extend_pick_to_min",
            title=str(pick.get("title", ""))[:40],
            before_start=before[0],
            before_end=before[1],
            after_start=int(pick["start_ms"]),
            after_end=int(pick["end_ms"]),
            min_ms=min_ms,
            max_ms=max_ms,
            duration_ms=after_dur,
        )


def extend_short_pick_backward(
    pick: dict,
    sentences: list[Sentence],
    sig_by: dict[int, SentenceSignals],
    words: list[dict],
    range_start_ms: int,
    range_end_ms: int,
    min_ms: int,
) -> None:
    """Backward-compatible wrapper."""
    max_ms = int(pick.get("length_max_ms") or (range_end_ms - range_start_ms))
    extend_pick_to_min_duration(
        pick,
        sentences,
        sig_by,
        words,
        range_start_ms,
        range_end_ms,
        min_ms=min_ms,
        max_ms=max_ms,
    )
