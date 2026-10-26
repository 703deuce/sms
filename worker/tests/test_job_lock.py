from clips_worker.job_reliability import JOB_LOCK_HEARTBEAT_SECONDS, JOB_LOCK_STALE_SECONDS, stale_lock_interval_sql
from clips_worker.worker_identity import worker_instance_id


def test_stale_interval_sql():
    assert "180" in stale_lock_interval_sql(180)
    assert JOB_LOCK_STALE_SECONDS == 180
    assert JOB_LOCK_HEARTBEAT_SECONDS == 30


def test_worker_instance_id_includes_worker_id(monkeypatch):
    monkeypatch.setenv("WORKER_ID", "clips-worker-stream-1")
    # Reset module singleton for test
    import clips_worker.worker_identity as wi

    wi._INSTANCE_ID = None
    iid = worker_instance_id()
    assert iid.startswith("clips-worker-stream-1:")
    assert len(iid.split(":")[-1]) == 8
