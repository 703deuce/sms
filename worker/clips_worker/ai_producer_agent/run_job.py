"""AI_PRODUCER_AGENT_RUN — durable orchestrator trigger via internal HTTP."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from hashlib import sha256
from hmac import new as hmac_new


def _sign(body: str) -> str:
    secret = (os.environ.get("WORKER_SHARED_SECRET") or os.environ.get("INTEGRATION_SECRET_KEY") or "").strip()
    if not secret:
        return ""
    return hmac_new(secret.encode(), body.encode(), sha256).hexdigest()


def handle_ai_producer_agent_run(conn, job: dict) -> None:
    from clips_worker.main import _mark_job_done, post_progress
    from clips_worker.ai_producer_agent.feature_gate import ai_producer_agent_enabled

    if not ai_producer_agent_enabled():
        from clips_worker.job_contract import fail_job

        fail_job(conn, job, "ai_producer_agent_disabled", post_progress_fn=post_progress)
        return
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    run_id = str(payload.get("runId") or "")
    base = (os.environ.get("APP_URL") or os.environ.get("NEXT_PUBLIC_APP_URL") or "http://127.0.0.1:3000").rstrip("/")
    url = f"{base}/api/internal/ai-producer-agent/runs/{run_id}/execute"
    body = json.dumps({"runId": run_id})
    req = urllib.request.Request(url, data=body.encode(), method="POST")
    req.add_header("Content-Type", "application/json")
    sig = _sign(body)
    if sig:
        req.add_header("x-worker-signature", sig)
    try:
        with urllib.request.urlopen(req, timeout=1200) as resp:
            resp.read()
    except urllib.error.HTTPError as exc:
        from clips_worker.job_contract import fail_job

        fail_job(conn, job, f"execute_http_{exc.code}", post_progress_fn=post_progress)
        return
    except Exception as exc:
        from clips_worker.job_contract import fail_job

        fail_job(conn, job, str(exc)[:2000], post_progress_fn=post_progress)
        return
    post_progress(job["id"], {"jobStatus": "DONE", "runId": run_id})
    _mark_job_done(conn, job["id"])
