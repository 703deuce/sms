"""Re-queue orphaned RUNNING lane jobs on worker boot."""
from __future__ import annotations

from clips_worker.job_lock import requeue_running_not_owned_by_instance
from clips_worker.worker_identity import worker_instance_id


def requeue_running_lane_jobs_on_boot(conn) -> int:
    return requeue_running_not_owned_by_instance(conn, worker_instance_id())
