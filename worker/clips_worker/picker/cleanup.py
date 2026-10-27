"""Step E: snap to sentence boundaries, comedy laugh tail, selection."""
from __future__ import annotations

from clips_worker.picker.config import genre_meta, resolve_genre_key, snap_settings
from clips_worker.picker.log_util import picker_info
from clips_worker.picker.selection import select_clips
from clips_worker.picker.snap_bounds import snap_bounds


def finalize_picks(
    scored: list[dict],
    sentences,
    signals_by_idx: dict,
    words: list[dict],
    range_start_ms: int,
    range_end_ms: int,
    genre: str = "podcast",
) -> list[dict]:
    gkey = resolve_genre_key(genre)
    gmeta = genre_meta(genre)
    snap = snap_settings()
    laugh_tail = gmeta.get("preferences", {}).get("end_after_laugh_s") or snap.get("comedy_laugh_tail_s")

    picks = []
    dropped_short = 0
    dropped_bounds = 0
    for row in scored:
        ss, es = row["start_sentence"], row["end_sentence"]
        if ss < 0 or es >= len(sentences) or ss > es:
            dropped_bounds += 1
            continue
        start_ms = max(range_start_ms, sentences[ss].start_ms)
        end_ms = min(range_end_ms, sentences[es].end_ms)
        if gkey == "comedy_standup" and laugh_tail:
            lo, hi = float(laugh_tail[0]), float(laugh_tail[1])
            end_ms += int(((lo + hi) / 2) * 1000)
        pick = {**row, "start_ms": start_ms, "end_ms": end_ms}
        snap_bounds(pick, words, sentences, range_start_ms, range_end_ms)
        if pick["end_ms"] - pick["start_ms"] < 15000:
            dropped_short += 1
            continue
        picks.append(pick)

    # select_clips runs after snap_bounds; includes R10 near-duplicate dedupe on final ms spans
    selected = select_clips(picks, range_end_ms - range_start_ms)
    picker_info(
        "selection",
        candidates=len(picks),
        selected=len(selected),
        dropped_short=dropped_short,
        dropped_bounds=dropped_bounds,
    )
    return selected
