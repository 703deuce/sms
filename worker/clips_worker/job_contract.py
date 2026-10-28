"""Central job failure contract: fail, release lock, run handler in try/finally."""
from __future__ import annotations

import json
from typing import Callable

from clips_worker.job_reliability import JOB_MAX_STREAM_ATTEMPTS_BEFORE_FAIL
from clips_worker.probe import format_subprocess_error
from clips_worker.streamer.lanes import lane_types_sql_in
from clips_worker.user_errors import user_facing_job_error


def _log(msg: str) -> None:
    print(msg, flush=True)


def default_max_attempts() -> int:
    return JOB_MAX_STREAM_ATTEMPTS_BEFORE_FAIL


def readable_job_error(exc: BaseException) -> str:
    try:
        return format_subprocess_error(exc)
    except BaseException:
        return f"{type(exc).__name__}: {str(exc)[:500]}"


def release_job_lock(conn, job_id: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE clip_jobs
            SET "lockedBy" = NULL,
                "lockedAt" = NULL
            WHERE id = %s AND status = 'RUNNING'
            """,
            (job_id,),
        )
    conn.commit()


def requeue_job_immediate(conn, job: dict, *, note: str = "requeued") -> None:
    """Release lock and set QUEUED immediately (deploy drain / interrupt)."""
    job_id = job["id"]
    attempts = int(job.get("attempts") or 0)
    max_attempts = int(job.get("maxAttempts") or job.get("max_attempts") or default_max_attempts())
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    with conn.cursor() as cur:
        if attempts >= max_attempts:
            cur.execute(
                """
                UPDATE clip_jobs
                SET status = 'FAILED',
                    "lockedBy" = NULL,
                    "lockedAt" = NULL,
                    error = LEFT(COALESCE(error, '') || %s, 4000),
                    "finishedAt" = NOW()
                WHERE id = %s
                """,
                (f" {note}; attempts exhausted", job_id),
            )
        else:
            cur.execute(
                """
                UPDATE clip_jobs
                SET status = 'QUEUED',
                    "lockedBy" = NULL,
                    "lockedAt" = NULL,
                    "runAfter" = NOW(),
                    attempts = attempts + 1,
                    error = LEFT(COALESCE(error, '') || %s, 500)
                WHERE id = %s
                """,
                (f" {note}", job_id),
            )
        if job.get("type") == "RENDER_CLIP":
            rid = payload.get("renderId")
            if rid:
                cur.execute(
                    """
                    UPDATE clip_renders
                    SET status = 'QUEUED', error = NULL, "updatedAt" = NOW()
                    WHERE id = %s AND status = 'RENDERING'
                    """,
                    (rid,),
                )
    conn.commit()


def requeue_job_retryable(
    conn,
    job: dict,
    exc: BaseException,
    *,
    post_progress_fn: Callable | None = None,
) -> None:
    """Requeue with delay for RetryableError (respect maxAttempts)."""
    from clips_worker.streamer.errors import RetryableError

    if not isinstance(exc, RetryableError):
        raise TypeError("expected RetryableError")
    job_id = job["id"]
    attempts = int(job.get("attempts") or 0)
    max_attempts = int(job.get("maxAttempts") or job.get("max_attempts") or default_max_attempts())
    delay_s = int(getattr(exc, "delay_seconds", 60) or 60)
    user_msg = user_facing_job_error(getattr(exc, "user_message", None) or str(exc))
    if attempts + 1 >= max_attempts:
        fail_job(conn, job, user_msg, post_progress_fn=post_progress_fn)
        return
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE clip_jobs
            SET status = 'QUEUED',
                "lockedBy" = NULL,
                "lockedAt" = NULL,
                "runAfter" = NOW() + (%s || ' seconds')::interval,
                attempts = attempts + 1,
                error = LEFT(COALESCE(error, '') || %s, 500)
            WHERE id = %s
            """,
            (str(delay_s), f" retryable: {user_msg[:200]}", job_id),
        )
    conn.commit()
    if post_progress_fn:
        post_progress_fn(
            job_id,
            {
                "jobStatus": "QUEUED",
                "projectStatus": "FINDING_CLIPS",
                "stage": "picker_retry",
                "progress": 50,
                "error": user_msg,
            },
        )
    _log(f"[clipper:job] requeued job={job_id} delay_s={delay_s} attempts={attempts + 1} msg={user_msg[:120]}")


def fail_job(conn, job: dict, message: str, *, post_progress_fn: Callable | None = None) -> None:
    from clips_worker.streamer.job_failure import terminal_failure_progress_payload

    user_msg = user_facing_job_error(message)
    job_id = job["id"]
    job_type = job.get("type") or ""
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    generation_id = payload.get("generationId")
    with conn.cursor() as cur:
        if generation_id:
            cur.execute(
                'UPDATE ai_generations SET status=%s, error=%s, "updatedAt"=NOW() WHERE id=%s',
                ("FAILED", user_msg[:4000], generation_id),
            )
        if job_type == "RENDER_CLIP":
            rid = payload.get("renderId")
            if rid:
                cur.execute(
                    'UPDATE clip_renders SET status = %s, error = %s, "updatedAt" = NOW() WHERE id = %s',
                    ("FAILED", user_msg[:4000], rid),
                )
        cur.execute(
            """
            UPDATE clip_jobs
            SET status = 'FAILED',
                error = %s,
                "finishedAt" = NOW(),
                "lockedBy" = NULL,
                "lockedAt" = NULL
            WHERE id = %s
            """,
            (user_msg[:4000], job_id),
        )
    conn.commit()
    if post_progress_fn:
        post_progress_fn(job_id, terminal_failure_progress_payload(job_type, user_msg))
    _log(f"[clipper:job] failed job={job_id} type={job_type} error={user_msg[:240]}")


def mark_job_done(conn, job_id: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE clip_jobs
            SET status = 'DONE',
                "finishedAt" = NOW(),
                "lockedBy" = NULL,
                "lockedAt" = NULL,
                error = NULL
            WHERE id = %s
            """,
            (job_id,),
        )
    conn.commit()


def run_job(
    conn,
    job: dict,
    handler: Callable[[object, dict], None],
    *,
    post_progress_fn: Callable | None = None,
    on_success_mark_done: bool = True,
) -> None:
    job_id = job["id"]
    try:
        handler(conn, job)
    except BaseException as exc:
        from clips_worker.worker_drain import WorkerDrainExit
        from clips_worker.streamer.errors import RetryableError

        if isinstance(exc, WorkerDrainExit):
            raise
        if isinstance(exc, RetryableError):
            requeue_job_retryable(conn, job, exc, post_progress_fn=post_progress_fn)
            return
        fail_job(conn, job, readable_job_error(exc), post_progress_fn=post_progress_fn)
    finally:
        release_job_lock(conn, job_id)


def dry_poll_iteration(conn) -> None:
    """Run stale requeue + claim SQL inside a rolled-back transaction (deploy gate)."""
    from clips_worker.job_lock import requeue_stale_running_jobs

    requeue_stale_running_jobs(conn)
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT id FROM clip_jobs
            WHERE status = 'QUEUED'
              AND type IN ({lane_types_sql_in()})
              AND "runAfter" <= (NOW() AT TIME ZONE 'UTC')
            LIMIT 1
            """
        )
        cur.fetchone()
    conn.rollback()
