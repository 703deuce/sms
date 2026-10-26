"""Job lock heartbeat / stale requeue (shared with reaper timing on the web side)."""
from __future__ import annotations

# Match new-app/lib/server/clips/job-reliability.ts JOB_HEARTBEAT_STALE_MS
JOB_LOCK_STALE_SECONDS = 3 * 60
JOB_LOCK_HEARTBEAT_SECONDS = 30


def stale_lock_interval_sql(seconds: int = JOB_LOCK_STALE_SECONDS) -> str:
    """SQL interval fragment for lockedAt cutoff (seconds)."""
    return f"({int(seconds)} * interval '1 second')"


def boot_requeue_eligible(locked_by: str | None, worker_id: str, instance_id: str) -> bool:
    """
    Boot may requeue only our lane's orphaned locks (NULL, legacy bare WORKER_ID,
    or another instance of the same WORKER_ID). Other workers' live jobs use stale-heartbeat.
    """
    if locked_by is None:
        return True
    if locked_by == worker_id:
        return True
    prefix = f"{worker_id}:"
    if locked_by.startswith(prefix) and locked_by != instance_id:
        return True
    return False
