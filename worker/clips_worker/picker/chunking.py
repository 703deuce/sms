"""20-minute transcript chunks with 2-minute overlap."""
from __future__ import annotations

from clips_worker.picker.config import genres_config
from clips_worker.picker.sentences import Sentence


def chunk_sentences(sentences: list[Sentence]) -> list[tuple[int, int]]:
    cfg = genres_config()
    chunk_min = int(cfg.get("chunk_minutes", 20))
    overlap_min = int(cfg.get("chunk_overlap_minutes", 2))
    if not sentences:
        return []
    chunk_ms = chunk_min * 60_000
    overlap_ms = overlap_min * 60_000
    start_ms = sentences[0].start_ms
    end_ms = sentences[-1].end_ms
    spans: list[tuple[int, int]] = []
    cur = start_ms
    while cur < end_ms:
        hi = cur + chunk_ms
        spans.append((cur, hi))
        if hi >= end_ms:
            break
        cur = hi - overlap_ms
    return spans


def slice_sentence_range(sentences: list[Sentence], lo_ms: int, hi_ms: int) -> list[Sentence]:
    out = [s for s in sentences if s.end_ms >= lo_ms and s.start_ms <= hi_ms]
    return out
