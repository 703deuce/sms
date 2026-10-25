"""Step B: sentence-boundary candidate windows."""
from __future__ import annotations

from dataclasses import dataclass

from clips_worker.picker.sentences import Sentence

LENGTH_MS = {
    "auto": (15_000, 60_000),
    "lt30": (10_000, 30_000),
    "30_60": (30_000, 60_000),
    "60_90": (60_000, 90_000),
}
PREFER_MS = (25_000, 45_000)
MAX_WINDOWS = 300


@dataclass
class CandidateWindow:
    start_sentence: int
    end_sentence: int
    start_ms: int
    end_ms: int


def build_candidates(sentences: list[Sentence], clip_length: str, range_start_ms: int, range_end_ms: int) -> list[CandidateWindow]:
    lo, hi = LENGTH_MS.get(clip_length, LENGTH_MS["auto"])
    prefer_lo, prefer_hi = PREFER_MS
    windows: list[CandidateWindow] = []

    for i in range(len(sentences)):
        start_ms = sentences[i].start_ms
        if start_ms < range_start_ms:
            continue
        for j in range(i, len(sentences)):
            end_ms = sentences[j].end_ms
            if end_ms > range_end_ms:
                break
            dur = end_ms - start_ms
            if dur < lo:
                continue
            if dur > hi:
                break
            windows.append(CandidateWindow(i, j, start_ms, end_ms))

    if not windows:
        return windows

    # prefer 25-45s when auto
    if clip_length == "auto":
        preferred = [w for w in windows if prefer_lo <= (w.end_ms - w.start_ms) <= prefer_hi]
        if preferred:
            windows = preferred

    if len(windows) <= MAX_WINDOWS:
        return windows
    step = len(windows) / MAX_WINDOWS
    idxs = [int(k * step) for k in range(MAX_WINDOWS)]
    return [windows[i] for i in idxs]
