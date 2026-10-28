"""Step B: sentence-boundary candidate windows."""
from __future__ import annotations

from dataclasses import dataclass

from clips_worker.picker.config import cleanup_settings, length_bucket
from clips_worker.picker.sentences import Sentence
from clips_worker.target_clip_len import ClipLengthPolicy, resolve_clip_length_policy


@dataclass
class CandidateWindow:
    start_sentence: int
    end_sentence: int
    start_ms: int
    end_ms: int


def build_candidates(
    sentences: list[Sentence],
    clip_length: str,
    range_start_ms: int,
    range_end_ms: int,
    genre: str = "podcast",
    length_policy: ClipLengthPolicy | None = None,
) -> list[CandidateWindow]:
    if length_policy is None:
        bucket = length_bucket(clip_length, genre)
        lo = int(bucket.get("min_ms", 15_000))
        hi = int(bucket.get("max_ms", 60_000))
        prefer_lo = int(bucket.get("prefer_min_ms", 25_000))
        prefer_hi = int(bucket.get("prefer_max_ms", 45_000))
    else:
        lo = length_policy.min_ms
        hi = length_policy.max_ms
        prefer_lo = length_policy.prefer_min_ms
        prefer_hi = length_policy.prefer_max_ms
    max_windows = cleanup_settings()["max_windows"]
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

    auto_mode = length_policy.mode == "auto" if length_policy else clip_length in ("auto", "Auto")
    if auto_mode and prefer_lo and prefer_hi and prefer_hi < hi:
        preferred = [w for w in windows if prefer_lo <= (w.end_ms - w.start_ms) <= prefer_hi]
        if preferred:
            windows = preferred

    if len(windows) <= max_windows:
        return windows
    step = len(windows) / max_windows
    idxs = [int(k * step) for k in range(max_windows)]
    return [windows[i] for i in idxs]
