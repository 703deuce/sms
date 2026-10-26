"""Post streamer notifications to web internal API (S11)."""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import urllib.request


def _sign_body(secret: str, body: str) -> str:
    return hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()


def notify_event(
    *,
    workspace_id: str,
    type: str,
    vod_id: str | None = None,
    montage_id: str | None = None,
    data: dict | None = None,
) -> None:
    app_url = os.environ.get("APP_URL", "").rstrip("/")
    secret = os.environ.get("WORKER_SHARED_SECRET", "")
    if not app_url or not secret:
        return
    body = json.dumps(
        {
            "workspaceId": workspace_id,
            "type": type,
            "vodId": vod_id,
            "montageId": montage_id,
            "data": data or {},
        }
    )
    req = urllib.request.Request(
        f"{app_url}/api/internal/notify",
        data=body.encode(),
        headers={"Content-Type": "application/json", "x-worker-signature": _sign_body(secret, body)},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            resp.read()
    except Exception:
        pass
