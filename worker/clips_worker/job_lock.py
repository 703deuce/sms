"""RUNNING job lock heartbeats and stale-lock recovery."""
from __future__ import annotations

import os
import threading
from typing import Callable

import psycopg2

from clips_worker.job_reliability import (
    JOB_LOCK_HEARTBEAT_SECONDS,
    JOB_LOCK_STALE_SECONDS,
    stale_lock_interval_sql,
)
from clips_worker.streamer.lanes import lane_types_sql_in
from clips_worker.worker_identity import worker_instance_id


def _log(msg: str) -> None:
    print(msg, flush=True)


def touch_job_lock(conn, job_id: str, instance_id: str) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE clip_jobs
            SET "lockedAt" = NOW()
            WHERE id = %s
              AND status = 'RUNNING'
              AND "lockedBy" = %s
            """,
            (job_id, instance_id),
        )
        touched = (cur.rowcount or 0) > 0
    conn.commit()
    return touched


def touch_job_lock_dsn(dsn: str, job_id: str, instance_id: str) -> bool | None:
    """True = still ours, False = no longer RUNNING / locked by us (requeued), None = DB error."""
    try:
        with psycopg2.connect(dsn) as conn:
            return touch_job_lock(conn, job_id, instance_id)
    except Exception as exc:
        _log(f"lock heartbeat failed job={job_id}: {exc}")
        return None


def job_still_owned(conn, job_id: str, instance_id: str | None = None) -> bool:
    """FV4a: is this RUNNING job still locked by this worker slot? (True on DB errors — fail open.)"""
    inst = instance_id or worker_instance_id()
    try:
        with conn.cursor() as cur:
            cur.execute('SELECT status, "lockedBy" FROM clip_jobs WHERE id = %s', (job_id,))
            row = cur.fetchone()
        conn.commit()
    except Exception as exc:
        _log(f"ownership check failed job={job_id}: {exc}")
        try:
            conn.rollback()
        except Exception:
            pass
        return True
    if not row:
        return False
    status, locked_by = (row["status"], row["lockedBy"]) if isinstance(row, dict) else (row[0], row[1])
    return status == "RUNNING" and locked_by == inst


def requeue_stale_running_jobs(conn, stale_seconds: int = JOB_LOCK_STALE_SECONDS) -> int:
    """Requeue or fail RUNNING lane jobs with no recent lock heartbeat (all job types)."""
    interval = stale_lock_interval_sql(stale_seconds)
    with conn.cursor() as cur:
        cur.execute(
            f"""
            UPDATE clip_jobs
            SET status = CASE
                  WHEN attempts + 1 >= COALESCE("maxAttempts", 3) THEN 'FAILED'
                  ELSE 'QUEUED'
                END,
                attempts = attempts + 1,
                "lockedBy" = NULL,
                "lockedAt" = NULL,
                "runAfter" = NOW(),
                error = LEFT(
                  COALESCE(error, '') ||
                  CASE WHEN attempts + 1 >= COALESCE("maxAttempts", 3)
                    THEN ' Stale lock; attempts exhausted'
                    ELSE ' Stale lock requeued (no heartbeat)'
                  END,
                  500
                ),
                "finishedAt" = CASE
                  WHEN attempts + 1 >= COALESCE("maxAttempts", 3) THEN NOW()
                  ELSE "finishedAt"
                END
            WHERE status = 'RUNNING'
              AND type IN ({lane_types_sql_in()})
              AND ("lockedAt" IS NULL OR "lockedAt" < NOW() - {interval})
            """
        )
        n = int(cur.rowcount or 0)
    conn.commit()
    if n:
        _log(f"stale lock recovery: updated {n} RUNNING job(s)")
    return n


def requeue_running_not_owned_by_instance(conn, instance_id: str) -> int:
    worker_id = os.environ.get("WORKER_ID", "worker-1")
    instance_prefix = f"{worker_id}:"
    with conn.cursor() as cur:
        cur.execute(
            f"""
            UPDATE clip_jobs
            SET status = 'QUEUED',
                "lockedBy" = NULL,
                "lockedAt" = NULL,
                "runAfter" = NOW(),
                error = LEFT(
                  COALESCE(error, '') || ' Requeued after worker restart',
                  500
                )
            WHERE status = 'RUNNING'
              AND type IN ({lane_types_sql_in()})
              AND (
                "lockedBy" IS NULL
                OR "lockedBy" = %s
                OR (
                  "lockedBy" LIKE %s
                  AND "lockedBy" IS DISTINCT FROM %s
                )
              )
            """,
            (worker_id, f"{instance_prefix}%", instance_id),
        )
        n = int(cur.rowcount or 0)
    conn.commit()
    if n:
        _log(f"boot recovery: requeued {n} orphaned RUNNING lane job(s)")
    return n


class JobLockHeartbeat:
    """Refresh lockedAt on the DB while a handler runs (separate conn per tick)."""

    LOST_AFTER_MISSES = 2

    def __init__(
        self,
        dsn: str,
        job_id: str,
        instance_id: str,
        every_s: float = JOB_LOCK_HEARTBEAT_SECONDS,
        *,
        touch: Callable[[str, str, str], bool | None] | None = None,
        on_lost: Callable[[], None] | None = None,
    ) -> None:
        self._dsn = dsn
        self._job_id = job_id
        self._instance_id = instance_id
        self._every_s = every_s
        self._touch = touch or touch_job_lock_dsn
        self._on_lost = on_lost
        self._misses = 0
        self.lost = threading.Event()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def _beat(self) -> None:
        ok = self._touch(self._dsn, self._job_id, self._instance_id)
        if ok is False:
            self._misses += 1
        elif ok is True:
            self._misses = 0
        if self._misses >= self.LOST_AFTER_MISSES and not self.lost.is_set():
            # FV4a: the job was requeued (web watchdog / stale-lock recovery) and maybe claimed by
            # another slot. Stop this copy instead of rendering a duplicate as an orphan.
            self.lost.set()
            _log(f"[clipper:job] claim lost job={self._job_id} instance={self._instance_id} — stopping this copy")
            if self._on_lost:
                try:
                    self._on_lost()
                except Exception as exc:
                    _log(f"claim-lost hook failed job={self._job_id}: {exc}")

    def _tick(self) -> None:
        while not self._stop.wait(self._every_s):
            self._beat()

    def __enter__(self) -> JobLockHeartbeat:
        self._thread = threading.Thread(target=self._tick, daemon=True)
        self._thread.start()
        return self

    def __exit__(self, *args: object) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=self._every_s + 2)


def run_job_with_lock_heartbeat(
    dsn: str,
    conn,
    job: dict,
    handler: Callable[[object, dict], None],
    *,
    post_progress_fn: Callable | None = None,
) -> None:
    from clips_worker.job_contract import run_job

    from clips_worker.export_progress import cancel_active

    instance = worker_instance_id()
    with JobLockHeartbeat(dsn, job["id"], instance, on_lost=lambda: cancel_active("claim_lost")):
        run_job(conn, job, handler, post_progress_fn=post_progress_fn, on_success_mark_done=False)
