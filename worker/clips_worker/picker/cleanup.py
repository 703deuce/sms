"""Step E: snap to sentence boundaries, comedy laugh tail, selection."""
from __future__ import annotations

from clips_worker.picker.config import genre_meta, resolve_genre_key, snap_settings
from clips_worker.picker.selection import select_clips


def snap_ms(ms: float, words: list[dict], edge: str, padding_ms: int) -> int:
    t = ms / 1000.0
    if edge == "start":
        for w in words:
            if w["e"] >= t:
                return max(0, int(w["s"] * 1000) - padding_ms)
        return max(0, int(ms) - padding_ms)
    for w in reversed(words):
        if w["s"] <= t:
            return int(w["e"] * 1000) + padding_ms
    return int(ms) + padding_ms


def finalize_picks(
    scored: list[dict],
    sentences,
    signals_by_idx: dict,
    words: list[dict],
    range_start_ms: int,
    range_end_ms: int,
    genre: str = "podcast",
) -> list[dict]:
    snap = snap_settings()
    pad_start = int(float(snap.get("pad_start_s", 0.15)) * 1000)
    pad_end = int(float(snap.get("pad_end_s", 0.35)) * 1000)
    gkey = resolve_genre_key(genre)
    gmeta = genre_meta(genre)
    laugh_tail = gmeta.get("preferences", {}).get("end_after_laugh_s") or snap.get("comedy_laugh_tail_s")

    picks = []
    for row in scored:
        ss, es = row["start_sentence"], row["end_sentence"]
        if ss < 0 or es >= len(sentences) or ss > es:
            continue
        start_ms = max(range_start_ms, sentences[ss].start_ms)
        end_ms = min(range_end_ms, sentences[es].end_ms)
        if gkey == "comedy_standup" and laugh_tail:
            lo, hi = float(laugh_tail[0]), float(laugh_tail[1])
            end_ms += int(((lo + hi) / 2) * 1000)
        start_ms = snap_ms(start_ms, words, "start", pad_start)
        end_ms = snap_ms(end_ms, words, "end", pad_end)
        if end_ms - start_ms < 5000:
            continue
        picks.append({**row, "start_ms": start_ms, "end_ms": end_ms})

    return select_clips(picks, range_end_ms - range_start_ms)
