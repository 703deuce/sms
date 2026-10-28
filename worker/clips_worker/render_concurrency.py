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


def ffmpeg_threads_per_job() -> int:
    cpus = os.cpu_count() or 4
    return max(1, cpus // clips_render_concurrency())
