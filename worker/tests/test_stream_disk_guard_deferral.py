"""CL11 regression: only media jobs are guarded; deferral never burns retries."""
from contextlib import contextmanager

from clips_worker.job_contract import (
    defer_job_for_disk_pressure,
    requeue_job_immediate,
    stream_job_needs_disk_guard,
)


class FakeConn:
    def __init__(self, attempts=2):
        self.attempts = attempts
        self.status = "RUNNING"
        self.locked_by = "worker-a"
        self.run_after_seconds = None
        self.commits = 0
        self.statements = []

    @contextmanager
    def cursor(self):
        conn = self

        class Cursor:
            rowcount = 1

            def execute(self, sql, params):
                conn.statements.append((sql, params))
                if 'GREATEST(0, attempts - 1)' in sql:
                    assert params[2] == conn.locked_by
                    conn.attempts = max(0, conn.attempts - 1)
                    conn.run_after_seconds = int(params[0])
                    conn.status = "QUEUED"
                    conn.locked_by = None
                elif 'attempts = attempts + 1' in sql:
                    conn.attempts += 1
                    conn.status = "QUEUED"
                    conn.locked_by = None
                elif "status = 'FAILED'" in sql:
                    conn.status = "FAILED"

        yield Cursor()

    def commit(self):
        self.commits += 1


def test_tick_and_batch_coordination_bypass_disk_guard():
    for job_type in ("STREAM_AGENT_BATCH", "STREAM_CLEANUP", "STREAM_TICK"):
        assert not stream_job_needs_disk_guard(job_type)
    for job_type in (
        "STREAM_IMPORT", "STREAM_AGENT_PREPARE", "STREAM_ANALYZE",
        "STREAM_RENDER", "STREAM_RELAYOUT", "STREAM_MONTAGE", "STREAM_AUTOPULL",
    ):
        assert stream_job_needs_disk_guard(job_type)


def test_repeated_disk_deferrals_preserve_attempts_and_delay():
    # Each simulated claim increments attempts once; each deferral must undo it.
    conn = FakeConn(attempts=0)
    for _ in range(5):
        conn.status = "RUNNING"
        conn.locked_by = "worker-a"
        conn.attempts += 1
        defer_job_for_disk_pressure(
            conn,
            {"id": "heavy-1", "type": "STREAM_RENDER", "lockedBy": "worker-a"},
        )
        assert conn.status == "QUEUED"
        assert conn.attempts == 0
        assert conn.locked_by is None
        assert conn.run_after_seconds == 60
    assert conn.commits == 5
    assert all("runAfter" in sql for sql, _ in conn.statements)


def test_drain_release_still_counts_attempt():
    conn = FakeConn(attempts=1)
    requeue_job_immediate(
        conn,
        {"id": "drain-1", "type": "STREAM_RENDER", "attempts": 1, "maxAttempts": 4},
        note="Drain release",
    )
    assert conn.status == "QUEUED"
    assert conn.attempts == 2
    assert conn.commits == 1
    assert 'attempts = attempts + 1' in conn.statements[0][0]
