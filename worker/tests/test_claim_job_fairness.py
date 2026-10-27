"""Fair claim ordering: per-user queue depth must not let one user monopolize the worker."""
from __future__ import annotations

from pathlib import Path


def _user_queue_index(job: dict, all_jobs: list[dict]) -> int:
    """Matches worker SQL: depth among this user's still-queued jobs at claim time."""
    uid = job["user"]
    return sum(1 for j in all_jobs if j["user"] == uid and j["created_at"] <= job["created_at"])


def _claim_order_key(job: dict, all_jobs: list[dict]) -> tuple:
    return (
        -int(job.get("priority") or 0),
        _user_queue_index(job, all_jobs),
        job.get("run_after") or 0,
        job.get("created_at") or 0,
    )


def _next_claim(queued: list[dict], all_jobs: list[dict]) -> dict | None:
    if not queued:
        return None
    return min(queued, key=lambda j: _claim_order_key(j, all_jobs))


def test_fair_claim_interleaves_users():
    """User B's first job (queue index 1) is claimed before user A's tenth."""
    all_jobs = [{"id": f"a{i}", "user": "alice", "priority": 0, "created_at": i, "run_after": 0} for i in range(1, 11)]
    all_jobs.append({"id": "b1", "user": "bob", "priority": 0, "created_at": 11, "run_after": 0})
    queued = list(all_jobs)
    order = []
    while queued:
        nxt = _next_claim(queued, all_jobs)
        order.append(nxt["id"])
        queued.remove(nxt)
    assert order[0] == "a1"
    assert order[1] == "b1"
    assert order[2] == "a2"


def test_claim_sql_includes_per_user_fairness():
    main_py = Path(__file__).resolve().parents[1] / "clips_worker" / "main.py"
    src = main_py.read_text(encoding="utf-8")
    assert "p3.\"createdById\" = pj.\"createdById\"" in src
    assert "STREAM_ANALYZE" in src


def test_stream_lane_still_has_stream_analyze():
    from clips_worker.streamer.lanes import lane_types

    stream = set(lane_types("stream"))
    default = set(lane_types("default"))
    assert "STREAM_ANALYZE" in stream
    assert "STREAM_ANALYZE" not in default
    assert "PROCESS_PROJECT" in default
