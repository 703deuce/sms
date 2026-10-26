from clips_worker.job_reliability import (
    JOB_LOCK_HEARTBEAT_SECONDS,
    JOB_LOCK_STALE_SECONDS,
    boot_requeue_eligible,
    stale_lock_interval_sql,
)
from clips_worker.worker_identity import worker_instance_id


def test_stale_interval_sql():
    assert "180" in stale_lock_interval_sql(180)
    assert JOB_LOCK_STALE_SECONDS == 180
    assert JOB_LOCK_HEARTBEAT_SECONDS == 30


def test_worker_instance_id_includes_worker_id(monkeypatch):
    monkeypatch.setenv("WORKER_ID", "clips-worker-stream-1")
    import clips_worker.worker_identity as wi

    wi._INSTANCE_ID = None
    iid = worker_instance_id()
    assert iid.startswith("clips-worker-stream-1:")
    assert len(iid.split(":")[-1]) == 8


def test_boot_requeue_where_logic():
    worker_id = "clips-worker-stream-1"
    instance = "clips-worker-stream-1:deadbeef"

    assert boot_requeue_eligible(None, worker_id, instance) is True
    assert boot_requeue_eligible("clips-worker-stream-1", worker_id, instance) is True
    assert boot_requeue_eligible("clips-worker-stream-1:other1234", worker_id, instance) is True
    assert boot_requeue_eligible(instance, worker_id, instance) is False

    # Another worker in the same lane must not be stolen on boot.
    assert boot_requeue_eligible("clips-worker-stream-2:live5678", worker_id, instance) is False
    assert boot_requeue_eligible("clips-worker-1:abc", worker_id, instance) is False
