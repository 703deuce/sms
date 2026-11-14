"""Worker<->web deadlock regression (job_b10ed571 / proj_95576ba8, 2026-11-10).

1. Every progress POST happens with no uncommitted SQL write on the job connection.
2. The agent-only PROCESS_PROJECT branch commits project + job state itself
   before its DONE callback (no reliance on the progress helper).
3. A slow / failing progress POST never raises and never hangs the job.
4. A terminal post that cannot be delivered is written by the worker's own DB update.
"""
from __future__ import annotations

import http.server
import sys
import threading
import time
from contextlib import contextmanager
from unittest.mock import MagicMock, patch

sys.modules.setdefault("psycopg2", MagicMock())
sys.modules.setdefault("psycopg2.extras", MagicMock())

import clips_worker.main as main_mod  # noqa: E402
from clips_worker.job_reliability import bind_job_connection, unbind_job_connection  # noqa: E402
from clips_worker.worker_identity import worker_instance_id  # noqa: E402


class _Cursor:
    def __init__(self, conn):
        self.conn = conn
        self.rowcount = 1

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def execute(self, sql, params=None):
        head = " ".join(str(sql).split())[:60].upper()
        if head.startswith(("UPDATE", "INSERT", "DELETE")):
            self.conn.events.append(("write", head, params))
            self.conn.dirty = True
        else:
            self.conn.events.append(("read", head, params))

    def fetchone(self):
        return None


class FakeConn:
    def __init__(self):
        self.events: list[tuple] = []
        self.dirty = False

    def cursor(self, *a, **k):
        return _Cursor(self)

    def commit(self):
        self.events.append(("commit",))
        self.dirty = False

    def rollback(self):
        self.events.append(("rollback",))
        self.dirty = False


def _env(monkeypatch, **extra):
    for key in (
        "WORKER_PROGRESS_TIMEOUT_SEC",
        "WORKER_PROGRESS_MAX_ATTEMPTS",
        "WORKER_PROGRESS_BACKOFF_SEC",
        "WORKER_CALLBACK_URL",
        "TRANSOVO_BACKEND_URL",
    ):
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("APP_URL", "https://transovo.test")
    monkeypatch.setenv("WORKER_SHARED_SECRET", "secret")
    for k, v in extra.items():
        monkeypatch.setenv(k, str(v))


@contextmanager
def _bound(job_id, conn):
    token = bind_job_connection(job_id, conn)
    try:
        yield
    finally:
        unbind_job_connection(token)


def _recording_post(conn):
    def fake(job_id, payload, base, timeout=None):
        # The invariant: no uncommitted write may be open while the web is called.
        conn.events.append(("http", payload.get("stage"), payload.get("jobStatus"), conn.dirty))

    return fake


def test_commit_precedes_post_when_bound(monkeypatch):
    _env(monkeypatch)
    conn = FakeConn()
    with conn.cursor() as cur:
        cur.execute("UPDATE clip_projects SET status='FINDING_CLIPS' WHERE id=%s", ("p",))
    with _bound("job_1", conn), patch.object(main_mod, "_post_progress_once", side_effect=_recording_post(conn)):
        main_mod.post_progress("job_1", {"projectStatus": "FINDING_CLIPS", "stage": "finding_clips", "jobStatus": "DONE"})
    kinds = [e[0] for e in conn.events]
    assert kinds == ["write", "commit", "http"]
    assert conn.events[-1][3] is False


def test_agent_only_branch_commits_before_done_callback(monkeypatch):
    """Even with NO bound connection (helper cannot commit for it), the agent-only
    branch must have committed its clip_projects UPDATE before posting DONE."""
    _env(monkeypatch)
    conn = FakeConn()
    project = {
        "id": "proj_95576ba8",
        "status": "PREPARING",
        "source_key": "uploads/x.mp4",
        "settings": {},
        "transcriptWords": [{"w": "hi", "s": 0, "e": 1}],
    }
    job = {"id": "job_b10ed571", "projectId": "proj_95576ba8", "type": "PROCESS_PROJECT", "payload": {"agentOnly": True}}
    with patch.object(main_mod, "load_project", return_value=project), patch.object(
        main_mod, "download_object"
    ), patch.object(main_mod, "probe_duration", return_value=60.0), patch(
        "clips_worker.gpu.render_warmup.schedule_modal_warmup_background"
    ), patch.object(main_mod, "_post_progress_once", side_effect=_recording_post(conn)):
        main_mod.process_job(conn, job)

    https = [e for e in conn.events if e[0] == "http"]
    assert https, conn.events
    # No callback (in particular the DONE one) was sent with an open write txn.
    assert all(e[3] is False for e in https), conn.events
    done_idx = next(i for i, e in enumerate(conn.events) if e[0] == "http" and e[2] == "DONE")
    before = conn.events[:done_idx]
    proj_upd = max(i for i, e in enumerate(before) if e[0] == "write" and "CLIP_PROJECTS" in e[1])
    job_done = max(i for i, e in enumerate(before) if e[0] == "write" and "CLIP_JOBS" in e[1])
    assert proj_upd < job_done
    assert ("commit",) in before[job_done:]


def test_slow_web_does_not_hang_or_raise(monkeypatch):
    """A real local server that never answers in time: bounded, non-raising."""

    class Slow(http.server.BaseHTTPRequestHandler):
        def do_POST(self):  # noqa: N802
            time.sleep(3)
            try:
                self.send_response(200)
                self.end_headers()
            except Exception:
                pass

        def log_message(self, *a):
            pass

    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Slow)
    srv.daemon_threads = True
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    try:
        _env(
            monkeypatch,
            WORKER_PROGRESS_TIMEOUT_SEC=1,
            WORKER_PROGRESS_MAX_ATTEMPTS=2,
            WORKER_PROGRESS_BACKOFF_SEC=0.1,
        )
        monkeypatch.setenv("APP_URL", f"http://127.0.0.1:{srv.server_address[1]}")
        started = time.monotonic()
        main_mod.post_progress("job_slow", {"stage": "finding_clips", "jobStatus": "DONE"}, must_succeed=True)
        elapsed = time.monotonic() - started
        assert elapsed < 4.0, elapsed  # 2 x 1s timeout + 0.1s backoff, not 120s x 60
    finally:
        srv.shutdown()


def test_default_policy_is_short_and_bounded(monkeypatch):
    _env(monkeypatch)
    seen = {}

    def fake_urlopen(req, timeout=None):
        seen.setdefault("timeouts", []).append(timeout)
        raise TimeoutError("The read operation timed out")

    sleeps = []
    monkeypatch.setattr(main_mod.urllib.request, "urlopen", fake_urlopen)
    monkeypatch.setattr(main_mod.time, "sleep", lambda s: sleeps.append(s))
    main_mod.post_progress("job_t", {"projectStatus": "READY", "stage": "ready", "jobStatus": "DONE"})
    assert seen["timeouts"] and all(t == 10.0 for t in seen["timeouts"])
    assert len(seen["timeouts"]) == 4  # terminal: 4 attempts x 1 URL
    assert sum(sleeps) <= 4.0

    seen.clear()
    sleeps.clear()
    main_mod.post_progress("job_t", {"stage": "transcribing", "jobStatus": "RUNNING"})
    assert len(seen["timeouts"]) == 2  # non-terminal: 2 attempts


def test_must_succeed_and_http_errors_never_raise(monkeypatch):
    import urllib.error

    _env(monkeypatch)
    monkeypatch.setattr(main_mod.time, "sleep", lambda s: None)
    for exc in (
        TimeoutError("timed out"),
        urllib.error.HTTPError("u", 400, "bad", {}, None),
        urllib.error.HTTPError("u", 503, "unavailable", {}, None),
        ConnectionResetError("reset"),
    ):
        with patch.object(main_mod, "_post_progress_once", side_effect=exc):
            main_mod.post_progress("job_x", {"jobStatus": "DONE"}, must_succeed=True)
            main_mod.post_progress_terminal("job_x", {"jobStatus": "FAILED", "error": "x"})
            main_mod.post_progress_resilient("job_x", {"jobStatus": "RUNNING"})


def test_undeliverable_terminal_post_writes_job_status_itself(monkeypatch):
    _env(monkeypatch)
    monkeypatch.setattr(main_mod.time, "sleep", lambda s: None)
    conn = FakeConn()
    with _bound("job_term", conn), patch.object(main_mod, "_post_progress_once", side_effect=TimeoutError("t")):
        main_mod.post_progress("job_term", {"jobStatus": "DONE", "stage": "done"})
    writes = [e for e in conn.events if e[0] == "write"]
    assert len(writes) == 1 and "UPDATE CLIP_JOBS" in writes[0][1]
    status, _err, job_id, locked_by = writes[0][2]
    assert (status, job_id, locked_by) == ("DONE", "job_term", worker_instance_id())
    assert conn.events[-1] == ("commit",)


def test_non_terminal_failure_writes_nothing(monkeypatch):
    _env(monkeypatch)
    monkeypatch.setattr(main_mod.time, "sleep", lambda s: None)
    conn = FakeConn()
    with _bound("job_hb", conn), patch.object(main_mod, "_post_progress_once", side_effect=TimeoutError("t")):
        main_mod.post_progress("job_hb", {"jobStatus": "RUNNING", "stage": "transcribing"})
    assert [e for e in conn.events if e[0] == "write"] == []
