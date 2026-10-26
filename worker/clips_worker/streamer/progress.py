"""Rich progress payloads for streamer jobs (stage %, chunk counters, ETA)."""
from __future__ import annotations

import time


def eta_seconds(done: int, total: int, started_at: float) -> int | None:
    if total <= 0 or done <= 0:
        return None
    elapsed = max(0.1, time.time() - started_at)
    per = elapsed / done
    remain = max(0, total - done)
    return int(per * remain)


def analyze_progress_payload(
    *,
    stage: str,
    chunk_done: int,
    chunk_total: int,
    started_at: float,
    base_pct: int = 20,
    span_pct: int = 35,
) -> dict:
    frac = chunk_done / max(1, chunk_total)
    progress = base_pct + int(span_pct * frac)
    eta = eta_seconds(chunk_done, chunk_total, started_at)
    return {
        "projectStatus": "TRANSCRIBING",
        "stage": stage,
        "progress": min(99, progress),
        "chunkDone": chunk_done,
        "chunkTotal": chunk_total,
        "etaSeconds": eta,
        "jobStatus": "RUNNING",
    }
