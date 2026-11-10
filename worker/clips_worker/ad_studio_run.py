"""AD_STUDIO_RUN — durable, signed worker-to-web handoff for B2 planning and stock staging.

This handler deliberately does NOT create paid AI Studio jobs or render clips; B3 owns that.
The shared ClipJob claim/lock/heartbeat machinery remains unchanged.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import urllib.error
import urllib.request


def handle_ad_studio_run(conn, job: dict) -> None:
    from clips_worker.job_contract import mark_job_done

    job_id = str(job["id"])
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    run_id = str(payload.get("runId") or "")
    phase = str(payload.get("phase") or "")
    if not run_id or phase not in ("plan", "stock"):
        print(f"[ad-studio:worker] invalid_payload job={job_id}", flush=True)
        raise ValueError("invalid_ad_studio_run_payload")

    secret = (os.environ.get("WORKER_SHARED_SECRET") or "").strip()
    if not secret:
        print(f"[ad-studio:worker] worker_secret_missing job={job_id}", flush=True)
        raise RuntimeError("AD_STUDIO worker shared secret is not configured")
    base = (os.environ.get("WORKER_CALLBACK_URL") or os.environ.get("APP_URL") or "").strip().rstrip("/")
    if not base:
        raise RuntimeError("AD_STUDIO callback URL is not configured")

    body = json.dumps({"runId": run_id, "phase": phase, "jobId": job_id}, separators=(",", ":"))
    signature = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()
    request = urllib.request.Request(
        f"{base}/api/internal/ad-studio/runs/{run_id}/execute",
        data=body.encode(), method="POST",
        headers={"Content-Type": "application/json", "x-worker-signature": signature},
    )
    print(f"[ad-studio:worker] dispatch_begin run={run_id} job={job_id} phase={phase}", flush=True)
    # Never retain a database transaction or row lock while performing HTTP.
    conn.commit()
    print(f"[ad-studio:worker] db_transaction_released run={run_id} job={job_id}", flush=True)
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            response.read()
            print(f"[ad-studio:worker] http_complete run={run_id} job={job_id} status={response.status}", flush=True)
    except urllib.error.HTTPError as exc:
        print(f"[ad-studio:worker] http_failed run={run_id} job={job_id} status={exc.code}", flush=True)
        raise RuntimeError("ad_studio_execute_failed") from exc
    except Exception as exc:
        print(f"[ad-studio:worker] transport_failed run={run_id} job={job_id} type={type(exc).__name__}", flush=True)
        raise
    mark_job_done(conn, job_id)
    print(f"[ad-studio:worker] job_done run={run_id} job={job_id} phase={phase}", flush=True)
