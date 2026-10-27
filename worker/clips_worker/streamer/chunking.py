"""Long-VOD audio chunk planning and transcript merge."""
from __future__ import annotations

import subprocess
from pathlib import Path

from clips_worker.streamer.transcribe_stream import STREAM_CHUNK_MAX_BYTES


def plan_chunks(
    duration_ms: int,
    chunk_ms: int,
    overlap_ms: int,
) -> list[tuple[int, int]]:
    if duration_ms <= 0:
        return []
    if duration_ms <= chunk_ms:
        return [(0, duration_ms)]
    out: list[tuple[int, int]] = []
    start = 0
    while start < duration_ms:
        end = min(duration_ms, start + chunk_ms)
        out.append((start, end))
        if end >= duration_ms:
            break
        start = max(0, end - overlap_ms)
    return out


def merge_words(chunks: list[list[dict]], ranges: list[tuple[int, int]]) -> list[dict]:
    """Merge chunk word lists at overlap midpoints (absolute ms)."""
    if not chunks:
        return []
    merged = list(chunks[0])
    for i in range(1, len(chunks)):
        end_a, start_b = ranges[i - 1][1], ranges[i][0]
        mid_s = (end_a + start_b) / 2000.0
        left = [w for w in merged if float(w["s"]) < mid_s]
        right = [w for w in chunks[i] if float(w["s"]) >= mid_s]
        merged = left + right
    for pos, w in enumerate(merged):
        w["i"] = pos
    return merged


def ffmpeg_slice_opus(src: Path, dest: Path, start_ms: int, end_ms: int) -> None:
    """Slice opus segment; shrink window until file is under STREAM_CHUNK_MAX_BYTES."""
    lo = start_ms
    hi = end_ms
    min_ms = 60_000
    while True:
        start_s = max(0, lo) / 1000.0
        dur_s = max(0.01, (hi - lo) / 1000.0)
        subprocess.check_call(
            [
                "ffmpeg",
                "-y",
                "-ss",
                f"{start_s:.3f}",
                "-t",
                f"{dur_s:.3f}",
                "-i",
                str(src),
                "-c",
                "copy",
                str(dest),
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        if dest.stat().st_size <= STREAM_CHUNK_MAX_BYTES or (hi - lo) <= min_ms:
            return
        hi = lo + (hi - lo) // 2
