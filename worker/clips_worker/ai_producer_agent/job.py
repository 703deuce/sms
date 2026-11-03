"""AI_PRODUCER_AGENT_ANALYZE — finder + analysis tools for the agent loop."""

from __future__ import annotations

import json
from typing import Any

from clips_worker.ai_producer_agent.feature_gate import ai_producer_agent_enabled
from clips_worker.ai_producer_agent.finder.run import run_analyze_payload


def handle_ai_producer_agent_analyze(conn, job: dict) -> None:
    from clips_worker.main import _mark_job_done, post_progress

    if not ai_producer_agent_enabled():
        from clips_worker.job_contract import fail_job

        fail_job(conn, job, "ai_producer_agent_disabled", post_progress_fn=post_progress)
        return
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    run_id = str(payload.get("runId") or "")
    mode = str(payload.get("mode") or "best_moments")
    try:
        result = run_analyze_payload(conn, job=job, payload=payload, progress=post_progress)
        with conn.cursor() as cur:
            from psycopg2.extras import Json

            cur.execute(
                'UPDATE clip_jobs SET payload = payload || %s::jsonb WHERE id = %s',
                (Json({"analyzeResult": result}), job["id"]),
            )
        conn.commit()
        post_progress(
            job["id"],
            {
                "jobStatus": "DONE",
                "runId": run_id,
                "mode": mode,
                "result": result,
            },
        )
    except Exception as exc:
        post_progress(
            job["id"],
            {
                "jobStatus": "FAILED",
                "runId": run_id,
                "error": str(exc)[:2000],
            },
        )
        from clips_worker.job_contract import fail_job

        fail_job(conn, job, str(exc)[:2000], post_progress_fn=post_progress)
        return
    _mark_job_done(conn, job["id"])
