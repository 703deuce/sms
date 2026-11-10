"""Regression: worker commits the job connection before any progress HTTP request."""
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from clips_worker.job_reliability import (
    bind_job_connection,
    commit_before_progress,
    unbind_job_connection,
)


class FakeConnection:
    def __init__(self):
        self.events = []
        self.fail = False

    def commit(self):
        self.events.append("commit")
        if self.fail:
            raise RuntimeError("db commit failed")

    def rollback(self):
        self.events.append("rollback")


class ProgressTransactionTests(unittest.TestCase):
    def test_release_precedes_network_and_keeps_claim(self):
        conn = FakeConnection()
        conn.locked_by = "slot-1"
        token = bind_job_connection("job-1", conn)
        try:
            commit_before_progress("job-1", "finding_clips")
            conn.events.append("http")
            self.assertEqual(conn.events, ["commit", "http"])
            self.assertEqual(conn.locked_by, "slot-1")
        finally:
            unbind_job_connection(token)

    def test_failed_commit_prevents_progress(self):
        conn = FakeConnection()
        conn.fail = True
        token = bind_job_connection("job-1", conn)
        try:
            with self.assertRaisesRegex(RuntimeError, "db commit failed"):
                commit_before_progress("job-1", "transcribing")
            self.assertEqual(conn.events, ["commit", "rollback"])
        finally:
            unbind_job_connection(token)

    def test_other_job_cannot_commit_this_connection(self):
        conn = FakeConnection()
        token = bind_job_connection("job-1", conn)
        try:
            commit_before_progress("job-2", "finding_clips")
            self.assertEqual(conn.events, [])
        finally:
            unbind_job_connection(token)

    def test_unbound_connection_is_not_reused(self):
        conn = FakeConnection()
        token = bind_job_connection("job-1", conn)
        unbind_job_connection(token)
        commit_before_progress("job-1", "finding_clips")
        self.assertEqual(conn.events, [])


if __name__ == "__main__":
    unittest.main()
