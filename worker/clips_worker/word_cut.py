"""Word-safe cuts — mirrors new-app/lib/clips/word-cut.ts."""
from __future__ import annotations

import json

WORD_CUT_PAD_MS = 60
WORD_CUT_MIN_MS = 40


def _word_span_ms(w: dict) -> tuple[int, int]:
    return int(float(w["s"]) * 1000), int(float(w["e"]) * 1000)


def cut_intersects_word_interior(cut: list[int], words: list[dict]) -> bool:
    a, b = min(cut[0], cut[1]), max(cut[0], cut[1])
    if b - a < WORD_CUT_MIN_MS:
        return False
    for w in words:
        ws, we = _word_span_ms(w)
        mid = (ws + we) / 2
        if a < mid < b:
            return True
    return False


def snap_cut_range_to_word_gaps(cut: list[int], words: list[dict], pad_ms: int = WORD_CUT_PAD_MS) -> list[int] | None:
    a, b = int(cut[0]), int(cut[1])
    if b - a < WORD_CUT_MIN_MS:
        return None
    if not words:
        return [a, b]
    start, end = a, b
    for w in sorted(words, key=lambda x: float(x["s"])):
        ws, we = _word_span_ms(w)
        if we <= start or ws >= end:
            continue
        if ws > start:
            start = min(end, ws + pad_ms)
        if we < end:
            end = max(start, we - pad_ms)
    if end - start < WORD_CUT_MIN_MS:
        return None
    if cut_intersects_word_interior([start, end], words):
        return None
    return [int(start), int(end)]


def _is_exact_word_span(cut: list[int], words: list[dict]) -> bool:
    a, b = int(cut[0]), int(cut[1])
    for w in words:
        ws, we = _word_span_ms(w)
        if ws == a and we == b:
            return True
    return False


def sanitize_cut_ranges(cuts: list, words: list[dict], pad_ms: int = WORD_CUT_PAD_MS) -> list:
    out: list = []
    for c in cuts:
        if not c or len(c) < 2:
            continue
        pair = [int(c[0]), int(c[1])]
        if _is_exact_word_span(pair, words):
            out.append(pair)
            continue
        if cut_intersects_word_interior(pair, words):
            snapped = snap_cut_range_to_word_gaps(pair, words, pad_ms)
            if snapped:
                print(json.dumps({"tag": "clipper:cut", "action": "snap", "ms": snapped[1] - snapped[0]}))
                out.append(snapped)
            else:
                print(json.dumps({"tag": "clipper:cut", "action": "reject"}))
            continue
        out.append(pair)
    return out
