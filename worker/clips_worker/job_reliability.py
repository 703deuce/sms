"""Job lock heartbeat / stale requeue (shared with reaper timing on the web side)."""
from __future__ import annotations

# Match new-app/lib/server/clips/job-reliability.ts JOB_HEARTBEAT_STALE_MS
JOB_LOCK_STALE_SECONDS = 3 * 60
JOB_LOCK_HEARTBEAT_SECONDS = 30


def stale_lock_interval_sql(seconds: int = JOB_LOCK_STALE_SECONDS) -> str:
    """SQL interval fragment for lockedAt cutoff (seconds)."""
    return f"({int(seconds)} * interval '1 second')"
