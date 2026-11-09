"""Advance one durable server-side streamer agent batch step per job.

Unlike a browser loop this is persisted via STREAM_AGENT_BATCH jobs and survives
closing the browser. The web app owns all authorization, state, and workspace
constraints; the worker only invokes a signed, bounded orchestration tick.
"""
from __future__ import annotations

import json
import os
import urllib.request
from hashlib import sha256
from hmac import new as hmac_new


def handle_stream_agent_batch(conn, job: dict) -> None:
    from clips_worker.main import _mark_job_done

    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    batch_id = str(payload.get("batchId") or "")
    project_id = str(job.get("projectId") or "")
    if not batch_id or not project_id:
        raise RuntimeError("stream_agent_batch_missing_identifiers")
    secret = (os.environ.get("WORKER_SHARED_SECRET") or
              os.environ.get("INTEGRATION_SECRET_KEY") or "").strip()
    if not secret:
        raise RuntimeError("stream_agent_batch_worker_secret_missing")
    from clips_worker.main import progress_base_urls
    base = progress_base_urls()[0].rstrip('/')
    body = json.dumps({"projectId": project_id, "batchId": batch_id})
    request = urllib.request.Request(
        base + "/api/internal/streamer/agent-batches/tick",
        data=body.encode("utf-8"), method="POST")
    request.add_header("Content-Type", "application/json")
    request.add_header("x-worker-signature", hmac_new(
        secret.encode("utf-8"), body.encode("utf-8"), sha256).hexdigest())
    with urllib.request.urlopen(request, timeout=90) as response:
        if response.status != 200:
            raise RuntimeError(f"stream_agent_batch_tick_http_{response.status}")
        result = json.loads(response.read().decode("utf-8"))
        if not isinstance(result, dict) or not isinstance(result.get("data"), dict):
            raise RuntimeError("stream_agent_batch_tick_invalid_response")
    _mark_job_done(conn, job["id"])
