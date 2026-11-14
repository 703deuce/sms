"""Job lock heartbeat / stale requeue (shared with reaper timing on the web side)."""
from __future__ import annotations

# Match new-app/lib/server/clips/job-reliability.ts JOB_HEARTBEAT_STALE_MS
JOB_LOCK_STALE_SECONDS = 3 * 60
JOB_LOCK_HEARTBEAT_SECONDS = 30
# Stream analyze/import: fail after this many claims (includes stale requeues).
JOB_MAX_STREAM_ATTEMPTS_BEFORE_FAIL = 3


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

# The worker keeps its SQL connection open while processing a job.  Its logical
# claim (lockedBy/lockedAt) survives commits; a SQL transaction must not.
from contextvars import ContextVar

_active_job_connection: ContextVar[tuple[str, object] | None] = ContextVar(
    "clipper_active_job_connection", default=None
)


def bind_job_connection(job_id: str, conn):
    """Bind the current handler's connection for synchronous progress callbacks."""
    return _active_job_connection.set((job_id, conn))


def unbind_job_connection(token) -> None:
    _active_job_connection.reset(token)


def bound_job_connection(job_id: str):
    """The connection bound for ``job_id`` in this context, or None (other job / thread)."""
    active = _active_job_connection.get()
    if active is None or active[0] != job_id:
        return None
    return active[1]


def commit_before_progress(job_id: str, stage: str | None = None) -> None:
    """End any pending SQL transaction before blocking on a website callback.

    Do not clear lockedBy: that is the durable job claim, not a SQL row lock.
    A failed commit aborts the callback so we never report uncommitted state.
    """
    active = _active_job_connection.get()
    if active is None or active[0] != job_id:
        return
    conn = active[1]
    label = (stage or "unknown")[:120]
    print(f"[clipper:progress] db_release_begin job={job_id} stage={label}", flush=True)
    try:
        conn.commit()
    except Exception as exc:
        try:
            conn.rollback()
        except Exception:
            pass
        print(
            f"[clipper:progress] db_release_failed job={job_id} stage={label} "
            f"exception={type(exc).__name__}",
            flush=True,
        )
        raise
    print(f"[clipper:progress] db_released job={job_id} stage={label}", flush=True)
