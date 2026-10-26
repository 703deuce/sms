"""Re-queue RUNNING lane jobs on worker boot (deploy/restart leaves orphaned locks)."""
from __future__ import annotations

from clips_worker.main import lane_types_sql_in, log


def requeue_running_lane_jobs_on_boot(conn) -> int:
    with conn.cursor() as cur:
        cur.execute(
            f"""
            UPDATE clip_jobs
            SET status = 'QUEUED',
                "lockedBy" = NULL,
                "lockedAt" = NULL,
                error = 'Requeued after worker restart'
            WHERE status = 'RUNNING'
              AND type IN ({lane_types_sql_in()})
            """,
        )
        n = int(cur.rowcount or 0)
    conn.commit()
    if n:
        log(f"boot recovery: requeued {n} orphaned RUNNING lane job(s)")
    return n
