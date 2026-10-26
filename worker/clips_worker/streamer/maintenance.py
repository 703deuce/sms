"""Periodic streamer maintenance (S13): advisory lock + internal HTTP."""
from __future__ import annotations

import json
import os
import urllib.request

from clips_worker.main import sign_body


def maybe_run_streamer_maintenance(conn) -> None:
    with conn.cursor() as cur:
        cur.execute("SELECT pg_try_advisory_lock(hashtext('streamer_maint'))")
        got = bool(cur.fetchone()[0])
    if not got:
        return
    try:
        app_url = os.environ.get("APP_URL", "").rstrip("/")
        secret = os.environ.get("WORKER_SHARED_SECRET", "")
        if not app_url or not secret:
            return
        body = json.dumps({})
        req = urllib.request.Request(
            f"{app_url}/api/internal/streamer/maintenance",
            data=body.encode(),
            headers={"Content-Type": "application/json", "x-worker-signature": sign_body(secret, body)},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            resp.read()
    finally:
        with conn.cursor() as cur:
            cur.execute("SELECT pg_advisory_unlock(hashtext('streamer_maint'))")
