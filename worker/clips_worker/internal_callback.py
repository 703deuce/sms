"""Signed POST callbacks to the Next.js internal API."""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import urllib.error
import urllib.request


def _sign_body(secret: str, body: str) -> str:
    return hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()


def _progress_base_urls() -> list[str]:
    urls: list[str] = []
    for key in ("WORKER_CALLBACK_URL", "TRANSOVO_BACKEND_URL"):
        v = (os.environ.get(key) or "").strip().rstrip("/")
        if v and v not in urls:
            urls.append(v)
    app = (os.environ.get("APP_URL") or "").strip().rstrip("/")
    if app and app not in urls:
        urls.append(app)
    return urls


def post_internal(path: str, payload: dict) -> None:
    secret = os.environ.get("WORKER_SHARED_SECRET", "")
    if not secret:
        return
    urls = _progress_base_urls()
    if not urls:
        return
    body = json.dumps(payload)
    headers = {
        "Content-Type": "application/json",
        "x-worker-signature": _sign_body(secret, body),
    }
    timeout = int(os.environ.get("WORKER_PROGRESS_TIMEOUT_SEC", "120"))
    for base in urls:
        req = urllib.request.Request(f"{base}{path}", data=body.encode(), headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                resp.read()
            return
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError):
            continue


def post_project_auto_broll(project_id: str) -> None:
    post_internal(f"/api/internal/projects/{project_id}/auto-broll", {})
