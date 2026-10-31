"""Bounded parallel clip reframe/render on the worker (4-CPU default)."""
from __future__ import annotations

import os


def clips_render_concurrency() -> int:
    raw = (os.environ.get("CLIPS_RENDER_CONCURRENCY") or "3").strip()
    try:
        n = int(raw)
    except ValueError:
        n = 2
    return max(1, min(8, n))


def worker_concurrency() -> int:
    """E6: job slots per worker process group. Default lane 2, stream lane 1 (capture is long-lived)."""
    from clips_worker.streamer.lanes import worker_lane

    default = "1" if worker_lane() == "stream" else "2"
    raw = (os.environ.get("WORKER_CONCURRENCY") or default).strip()
    try:
        n = int(raw)
    except ValueError:
        n = int(default)
    return max(1, min(8, n))


def ffmpeg_threads_per_job() -> int:
    cpus = os.cpu_count() or 4
    # E6: N job slots share the CPUs too.
    return max(1, cpus // (clips_render_concurrency() * worker_concurrency()))
