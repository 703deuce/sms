"""Step E: snap, dedupe, filter, rank."""
from __future__ import annotations

from clips_worker.picker.config import cleanup_settings


def _overlap(a: tuple[int, int], b: tuple[int, int]) -> float:
    lo = max(a[0], b[0])
    hi = min(a[1], b[1])
    if hi <= lo:
        return 0.0
    span = min(a[1] - a[0], b[1] - b[0])
    return (hi - lo) / max(span, 1)


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
    words: list[dict],
    range_start_ms: int,
    range_end_ms: int,
    genre: str = "podcast",
) -> list[dict]:
    cfg = cleanup_settings()
    padding_ms = cfg["padding_ms"]
    overlap_drop = cfg["overlap_drop"]
    min_score = cfg["min_score"]
    top_n = cfg["top_n"]

    picks = []
    for row in scored:
        ss, es = row["start_sentence"], row["end_sentence"]
        if ss < 0 or es >= len(sentences) or ss > es:
            continue
        start_ms = max(range_start_ms, sentences[ss].start_ms - padding_ms)
        end_ms = min(range_end_ms, sentences[es].end_ms + padding_ms)
        start_ms = snap_ms(start_ms, words, "start", padding_ms)
        end_ms = snap_ms(end_ms, words, "end", padding_ms)
        if end_ms - start_ms < 5000:
            continue
        picks.append({**row, "start_ms": start_ms, "end_ms": end_ms})

    picks.sort(key=lambda x: -x["score"])
    kept: list[dict] = []
    for p in picks:
        span = (p["start_ms"], p["end_ms"])
        if any(_overlap(span, (k["start_ms"], k["end_ms"])) > overlap_drop for k in kept):
            continue
        kept.append(p)

    strong = [p for p in kept if p["score"] >= min_score]
    if strong:
        result = strong[:top_n]
    elif kept:
        best = kept[0]
        best["low_confidence"] = True
        result = [best]
    else:
        result = []

    for p in result:
        p.setdefault("low_confidence", p["score"] < min_score)
    return result
