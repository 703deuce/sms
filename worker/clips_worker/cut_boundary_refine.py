"""CUTS_QUALITY1 §1 — mirror of new-app/lib/clips/cuts-quality/cut-boundary-refine.ts (tests)."""
from __future__ import annotations

import math

FRAME_MS = 10
HOP_MS = 5
SPEECH_DB_ABOVE_FLOOR = 8
NEIGHBOR_INTRUSION_MS = 30
MIN_ROOM_TONE_MS = 20


def _db_to_linear(db: float) -> float:
    return 10 ** (db / 20)


def _linear_to_db(l: float) -> float:
    return 20 * math.log10(max(l, 1e-12))


def speech_threshold_linear(floor: float) -> float:
    return _db_to_linear(_linear_to_db(floor) + SPEECH_DB_ABOVE_FLOOR)


def noise_floor_for_window(frames: list[tuple[int, float]], center_ms: int, window_ms: int = 2000) -> float:
    lo = center_ms - window_ms // 2
    hi = center_ms + window_ms // 2
    vals = sorted(r for t, r in frames if lo <= t <= hi)
    if not vals:
        return 0.01
    idx = min(len(vals) - 1, max(0, int(len(vals) * 0.1)))
    return vals[idx]


def refine_cut_boundary(
    prev_end_ms: int | None,
    word_start_ms: int,
    word_end_ms: int,
    next_start_ms: int | None,
    frames: list[tuple[int, float]],
) -> tuple[list[int], str]:
    center = (word_start_ms + word_end_ms) / 2
    floor = noise_floor_for_window(frames, int(center))
    thr = speech_threshold_linear(floor)
    prev_end = prev_end_ms if prev_end_ms is not None else word_start_ms - 200
    next_start = next_start_ms if next_start_ms is not None else word_end_ms + 200
    left_lo = max(prev_end - 20, word_start_ms - 200)
    left_hi = min(word_start_ms + 60, word_end_ms)
    right_lo = max(word_end_ms - 60, word_start_ms)
    right_hi = min(next_start + 20, word_end_ms + 200)

    def valley(lo: int, hi: int) -> int | None:
        best = None
        best_r = 1e9
        for t, r in frames:
            if t < lo or t > hi:
                continue
            if r > thr:
                continue
            if r < best_r:
                best_r = r
                best = t
        return best

    left = valley(left_lo, left_hi)
    right = valley(right_lo, right_hi)
    confidence = "ready"
    note = "filler"
    if left is None:
        left = word_start_ms
        confidence = "needs_review"
        note += "; no quiet valley on left"
    elif left > word_start_ms + NEIGHBOR_INTRUSION_MS:
        confidence = "needs_review"
        note += "; left edge inside neighbor word"
    if right is None:
        right = word_end_ms
        confidence = "needs_review"
        note += "; no quiet valley on right"
    elif right < word_end_ms - NEIGHBOR_INTRUSION_MS:
        confidence = "needs_review"
        note += "; right edge inside neighbor word"
    if prev_end_ms is not None and abs(left - prev_end_ms) >= MIN_ROOM_TONE_MS * 2:
        left -= MIN_ROOM_TONE_MS
    if next_start_ms is not None and abs(right - next_start_ms) >= MIN_ROOM_TONE_MS * 2:
        right += MIN_ROOM_TONE_MS
    left = max(left, min(word_start_ms, word_end_ms))
    right = min(right, max(word_start_ms, word_end_ms))
    return [int(left), int(right)], confidence if confidence == "ready" else note
