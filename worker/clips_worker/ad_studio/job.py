"""B2 AD_STUDIO_RUN worker handler.

ClipJob requires a real ClipProject projectId. B2 deliberately does not enqueue
this job before B3 has created a destination project; this dispatch is safe for
the B3 handoff. No paid provider calls or automatic retries live here.
"""
from __future__ import annotations

import json


def run_ad_studio_job(conn, job: dict) -> None:
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    run_id = str(payload.get("runId") or "").strip()
    job_id = str(job["id"])
    print(f"[ad-studio:worker] job_start job={job_id} run={run_id}", flush=True)
    if not run_id:
        raise ValueError("Missing Ad Studio runId")
    with conn.cursor() as cur:
        cur.execute(
            'SELECT id, status, "projectId" FROM "AdStudioRun" WHERE id = %s',
            (run_id,),
        )
        row = cur.fetchone()
    if not row:
        raise ValueError("Ad Studio run not found")
    _, status, project_id = row
    if status == "cancelled":
        print(f"[ad-studio:worker] job_skipped_cancelled job={job_id} run={run_id}", flush=True)
        return
    if not project_id:
        # B3 must provide a real destination clip project before queueing this job.
        raise ValueError("AD_STUDIO_RUN requires a materialization project (B3)")
    print(f"[ad-studio:worker] dispatch_registered job={job_id} run={run_id} status={status}", flush=True)
    # B3 replaces this registration with scene jobs and stitch/render dispatch.
    raise ValueError("Ad Studio materialization is not enabled until B3")
