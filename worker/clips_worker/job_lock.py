"""RUNNING job lock heartbeats and stale-lock recovery."""
from __future__ import annotations

import os
import threading
from typing import Callable

import psycopg2

from clips_worker.job_reliability import (
    JOB_LOCK_HEARTBEAT_SECONDS,
    JOB_LOCK_STALE_SECONDS,
    JOB_MAX_STREAM_ATTEMPTS_BEFORE_FAIL,
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


def touch_job_lock_dsn(dsn: str, job_id: str, instance_id: str) -> None:
    try:
        with psycopg2.connect(dsn) as conn:
            touch_job_lock(conn, job_id, instance_id)
    except Exception as exc:
        _log(f"lock heartbeat failed job={job_id}: {exc}")


def requeue_stale_running_jobs(conn, stale_seconds: int = JOB_LOCK_STALE_SECONDS) -> int:
    """Idempotent: fail or requeue RUNNING lane jobs with no recent lock heartbeat."""
    interval = stale_lock_interval_sql(stale_seconds)
    with conn.cursor() as cur:
        cur.execute(
            f"""
            UPDATE clip_jobs
            SET status = 'FAILED',
                "lockedBy" = NULL,
                "lockedAt" = NULL,
                error = LEFT(
                  COALESCE(error, '') || ' Stale lock exceeded max attempts',
                  500
                ),
                "finishedAt" = NOW()
            WHERE status = 'RUNNING'
              AND type IN ({lane_types_sql_in()})
              AND type LIKE 'STREAM\\_%%'
              AND attempts >= %s
              AND ("lockedAt" IS NULL OR "lockedAt" < NOW() - {interval})
            """,
            (JOB_MAX_STREAM_ATTEMPTS_BEFORE_FAIL,),
        )
        failed = int(cur.rowcount or 0)
        cur.execute(
            f"""
            UPDATE clip_jobs
            SET status = 'QUEUED',
                "lockedBy" = NULL,
                "lockedAt" = NULL,
                "runAfter" = NOW(),
                error = LEFT(
                  COALESCE(error, '') || ' Stale lock requeued (no heartbeat)',
                  500
                )
            WHERE status = 'RUNNING'
              AND type IN ({lane_types_sql_in()})
              AND ("lockedAt" IS NULL OR "lockedAt" < NOW() - {interval})
            """,
        )
        n = int(cur.rowcount or 0)
    conn.commit()
    if failed:
        _log(f"stale lock recovery: failed {failed} RUNNING job(s) (attempts>={JOB_MAX_STREAM_ATTEMPTS_BEFORE_FAIL})")
    if n:
        _log(f"stale lock recovery: requeued {n} RUNNING job(s)")
    return n + failed


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

    def __init__(self, dsn: str, job_id: str, instance_id: str, every_s: float = JOB_LOCK_HEARTBEAT_SECONDS) -> None:
        self._dsn = dsn
        self._job_id = job_id
        self._instance_id = instance_id
        self._every_s = every_s
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def _tick(self) -> None:
        while not self._stop.wait(self._every_s):
            touch_job_lock_dsn(self._dsn, self._job_id, self._instance_id)

    def __enter__(self) -> JobLockHeartbeat:
        self._thread = threading.Thread(target=self._tick, daemon=True)
        self._thread.start()
        return self

    def __exit__(self, *args: object) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=self._every_s + 2)


def run_job_with_lock_heartbeat(dsn: str, conn, job: dict, handler: Callable[[object, dict], None]) -> None:
    instance = worker_instance_id()
    with JobLockHeartbeat(dsn, job["id"], instance):
        handler(conn, job)
