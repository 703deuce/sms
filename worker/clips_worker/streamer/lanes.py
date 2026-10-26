"""Worker lane job-type subsets (default vs stream)."""
from __future__ import annotations

import os

from clips_worker.job_types import JOB_TYPES

_STREAM_TYPES = frozenset(
    {
        "STREAM_IMPORT",
        "STREAM_ANALYZE",
        "STREAM_RENDER",
        "STREAM_CLEANUP",
    }
)


def worker_lane() -> str:
    return (os.environ.get("WORKER_LANE") or "default").strip().lower()


def lane_types(lane: str | None = None) -> tuple[str, ...]:
    lane = (lane or worker_lane()).lower()
    if lane == "stream":
        return tuple(t for t in JOB_TYPES if t in _STREAM_TYPES)
    if lane == "default":
        return tuple(t for t in JOB_TYPES if t not in _STREAM_TYPES)
    return JOB_TYPES


def lane_types_sql_in(lane: str | None = None) -> str:
    return ", ".join(f"'{t}'" for t in lane_types(lane))
