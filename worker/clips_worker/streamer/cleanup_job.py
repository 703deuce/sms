"""STREAM_CLEANUP: delete bulky stream sources; keep transcript, signals, candidates, clip outputs."""
from __future__ import annotations

import json

from clips_worker.streamer.storage_cleanup import purge_stream_bulky_storage


def run_stream_cleanup_job(conn, job: dict, post_progress) -> None:
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    vod_id = payload.get("vodId")
    if not vod_id:
        raise RuntimeError("missing vodId")

    reason = str(payload.get("reason") or "cleanup_job")
    purge_stream_bulky_storage(conn, vod_id, reason=reason)
    post_progress(job["id"], {"jobStatus": "DONE"})
