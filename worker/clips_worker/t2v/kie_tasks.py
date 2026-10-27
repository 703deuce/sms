"""Kie image/video tasks for T2V scene media (poll + optional callback)."""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
from typing import Any

import requests

JOBS_BASE = os.environ.get("KIE_API_BASE_URL", "https://api.kie.ai").rstrip("/")


def _kie_key() -> str:
    k = (os.environ.get("KIE_API_KEY") or "").strip()
    if not k:
        raise RuntimeError("KIE_API_KEY is not configured")
    return k


def _image_model() -> str:
    return (os.environ.get("KIE_IMAGE_MODEL") or "nano-banana-2").strip()


def sign_t2v_kie_callback(job_id: str) -> str:
    secret = (
        os.environ.get("KIE_T2V_CALLBACK_SECRET")
        or os.environ.get("KIE_CALLBACK_SECRET")
        or os.environ.get("WORKER_SHARED_SECRET")
        or ""
    ).strip()
    if not secret:
        return ""
    return hmac.new(secret.encode(), job_id.encode(), hashlib.sha256).hexdigest()


def t2v_kie_callback_url(job_id: str) -> str | None:
    base = (os.environ.get("APP_URL") or os.environ.get("WORKER_CALLBACK_URL") or "").strip().rstrip("/")
    sig = sign_t2v_kie_callback(job_id)
    if not base or not sig:
        return None
    return f"{base}/api/t2v/internal/kie/callback?jobId={job_id}&s={sig}"


def kie_aspect_ratio(aspect: str) -> str:
    if aspect in ("9:16", "4:5"):
        return "9:16"
    if aspect == "1:1":
        return "1:1"
    return "16:9"


def create_image_task(prompt: str, aspect: str, *, call_back_url: str | None = None) -> str:
    body: dict[str, Any] = {
        "model": _image_model(),
        "callBackUrl": call_back_url or "https://transovo.local/kie-noop",
        "input": {
            "prompt": prompt,
            "image_input": [],
            "image_urls": [],
            "aspect_ratio": kie_aspect_ratio(aspect),
            "resolution": "2K",
            "output_format": "png",
        },
    }
    res = requests.post(
        f"{JOBS_BASE}/api/v1/jobs/createTask",
        headers={"Authorization": f"Bearer {_kie_key()}", "Content-Type": "application/json"},
        json=body,
        timeout=60,
    )
    res.raise_for_status()
    data = res.json()
    if data.get("code") != 200:
        raise RuntimeError(data.get("msg") or "kie_create_image_failed")
    task_id = (data.get("data") or {}).get("taskId")
    if not task_id:
        raise RuntimeError("kie_missing_taskId")
    return str(task_id)


def create_video_task(prompt: str, aspect: str, duration_s: int = 5, *, call_back_url: str | None = None) -> str:
    res_label = "720P" if aspect != "9:16" else "720P"
    body: dict[str, Any] = {
        "model": "wan/3-0-video",
        "callBackUrl": call_back_url or "https://transovo.local/kie-noop",
        "input": {
            "prompt": prompt,
            "aspect_ratio": kie_aspect_ratio(aspect),
            "duration": max(3, min(5, duration_s)),
            "resolution": res_label,
        },
    }
    res = requests.post(
        f"{JOBS_BASE}/api/v1/jobs/createTask",
        headers={"Authorization": f"Bearer {_kie_key()}", "Content-Type": "application/json"},
        json=body,
        timeout=60,
    )
    res.raise_for_status()
    data = res.json()
    if data.get("code") != 200:
        raise RuntimeError(data.get("msg") or "kie_create_video_failed")
    task_id = (data.get("data") or {}).get("taskId")
    if not task_id:
        raise RuntimeError("kie_missing_taskId")
    return str(task_id)


def fetch_task(task_id: str) -> dict[str, Any]:
    res = requests.get(
        f"{JOBS_BASE}/api/v1/jobs/recordInfo",
        params={"taskId": task_id},
        headers={"Authorization": f"Bearer {_kie_key()}"},
        timeout=60,
    )
    res.raise_for_status()
    data = res.json()
    if data.get("code") != 200:
        raise RuntimeError(data.get("msg") or "kie_recordInfo_failed")
    record = data.get("data") or {}
    return record


def parse_result_url(result_json: str | None) -> str:
    if not result_json:
        raise RuntimeError("kie_missing_result")
    parsed = json.loads(result_json)
    urls = parsed.get("resultUrls") or []
    if not urls:
        raise RuntimeError("kie_missing_resultUrls")
    return str(urls[0])


def kie_result_from_job_payload(conn, job_id: str) -> str | None:
    with conn.cursor() as cur:
        cur.execute('SELECT payload FROM clip_jobs WHERE id=%s', (job_id,))
        row = cur.fetchone()
    if not row or not row[0]:
        return None
    payload = row[0]
    if isinstance(payload, str):
        payload = json.loads(payload)
    url = payload.get("kieResultUrl")
    return str(url) if url else None


def poll_kie_task(
    task_id: str,
    *,
    timeout_s: int = 600,
    interval_s: float = 4.0,
    conn=None,
    job_id: str | None = None,
) -> str:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        if conn and job_id:
            early = kie_result_from_job_payload(conn, job_id)
            if early:
                return early
        record = fetch_task(task_id)
        state = str(record.get("state") or "").lower()
        if state in ("success", "succeeded", "done"):
            return parse_result_url(record.get("resultJson"))
        if state in ("fail", "failed", "error"):
            raise RuntimeError(record.get("failMsg") or record.get("failCode") or "kie_task_failed")
        time.sleep(interval_s)
    raise RuntimeError("kie_task_timeout")
