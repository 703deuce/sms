"""Extend short picks backward through setup (gameplay lead-in) before selection."""
from __future__ import annotations

from clips_worker.picker.log_util import picker_info
from clips_worker.picker.sentences import Sentence
from clips_worker.picker.signals import SentenceSignals
from clips_worker.picker.snap_bounds import snap_bounds


def extend_short_pick_backward(
    pick: dict,
    sentences: list[Sentence],
    sig_by: dict[int, SentenceSignals],
    words: list[dict],
    range_start_ms: int,
    range_end_ms: int,
    min_ms: int,
) -> None:
    dur = int(pick["end_ms"]) - int(pick["start_ms"])
    if dur >= min_ms:
        return
    ss = int(pick.get("start_sentence", 0))
    es = int(pick.get("end_sentence", ss))
    before = (int(pick["start_ms"]), int(pick["end_ms"]))
    # Prefer expanding backward into higher-energy sentences (fight lead-in).
    while dur < min_ms and ss > 0:
        prev = ss - 1
        sig = sig_by.get(prev) or sig_by.get(sentences[prev].idx)
        new_start = max(range_start_ms, sentences[prev].start_ms)
        if new_start >= pick["end_ms"]:
            break
        ss = prev
        pick["start_sentence"] = ss
        pick["start_ms"] = new_start
        dur = int(pick["end_ms"]) - int(pick["start_ms"])
        if sig and sig.rms_z < -0.2 and dur >= min_ms * 0.85:
            break
    if dur < min_ms and es < len(sentences) - 1:
        while dur < min_ms and es < len(sentences) - 1:
            es += 1
            pick["end_sentence"] = es
            pick["end_ms"] = min(range_end_ms, sentences[es].end_ms)
            dur = int(pick["end_ms"]) - int(pick["start_ms"])
    snap_bounds(pick, words, sentences, range_start_ms, range_end_ms)
    after_dur = int(pick["end_ms"]) - int(pick["start_ms"])
    if after_dur > dur or pick["start_ms"] != before[0]:
        picker_info(
            "extend_short_setup",
            title=str(pick.get("title", ""))[:40],
            before_start=before[0],
            before_end=before[1],
            after_start=int(pick["start_ms"]),
            after_end=int(pick["end_ms"]),
            min_ms=min_ms,
        )
