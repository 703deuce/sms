"""Progress + ETA payloads for regular (non-streamer) clip projects."""
from __future__ import annotations

import time

from clips_worker.streamer.progress import eta_seconds

REFRAME_ETA_SEC_PER_CLIP = 65


def reframe_eta_seconds(completed: int, total: int, started_at: float, concurrency: int) -> int:
    if total <= 0:
        return 0
    measured = eta_seconds(completed, total, started_at)
    if measured is not None:
        return measured
    remaining = max(0, total - completed)
    conc = max(1, concurrency)
    return int((remaining / conc) * REFRAME_ETA_SEC_PER_CLIP)


def reframe_progress_payload(
    idx: int,
    clip_total: int,
    started_at: float,
    concurrency: int,
    *,
    base_pct: int = 55,
    span_pct: int = 30,
    clips_ready: int | None = None,
) -> dict:
    completed_guess = clips_ready if clips_ready is not None else min(idx, clip_total)
    progress = base_pct + int(span_pct * completed_guess / max(1, clip_total))
    eta = reframe_eta_seconds(completed_guess, clip_total, started_at, concurrency)
    payload = {
        "projectStatus": "REFRAMING",
        "stage": f"reframe_{idx + 1}_of_{clip_total}",
        "progress": min(99, progress),
        "etaSeconds": max(0, eta),
        "jobStatus": "RUNNING",
        "clipsTotal": clip_total,
        "clipsReady": max(0, completed_guess),
    }
    return payload


def picker_progress_payload(stage: str, progress: int, eta_seconds_val: int | None = None) -> dict:
    payload = {
        "projectStatus": "FINDING_CLIPS",
        "stage": stage,
        "progress": progress,
        "jobStatus": "RUNNING",
    }
    if eta_seconds_val is not None and eta_seconds_val > 0:
        payload["etaSeconds"] = eta_seconds_val
    return payload
