"""Kie image/video tasks for T2V scene media (poll-based, no callback)."""
from __future__ import annotations

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


def kie_aspect_ratio(aspect: str) -> str:
    if aspect in ("9:16", "4:5"):
        return "9:16"
    if aspect == "1:1":
        return "1:1"
    return "16:9"


def create_image_task(prompt: str, aspect: str) -> str:
    body: dict[str, Any] = {
        "model": _image_model(),
        "callBackUrl": "https://transovo.local/kie-noop",
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
    data = res.json()
    if data.get("code") != 200:
        raise RuntimeError(data.get("msg") or "kie_create_image_failed")
    task_id = (data.get("data") or {}).get("taskId")
    if not task_id:
        raise RuntimeError("kie_missing_taskId")
    return str(task_id)


def create_video_task(prompt: str, aspect: str, duration_s: int = 5) -> str:
    res_label = "720P" if aspect != "9:16" else "720P"
    body: dict[str, Any] = {
        "model": "wan/3-0-video",
        "callBackUrl": "https://transovo.local/kie-noop",
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


def poll_kie_task(task_id: str, *, timeout_s: int = 600, interval_s: float = 4.0) -> str:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        record = fetch_task(task_id)
        state = str(record.get("state") or "").lower()
        if state in ("success", "succeeded", "done"):
            return parse_result_url(record.get("resultJson"))
        if state in ("fail", "failed", "error"):
            raise RuntimeError(record.get("failMsg") or record.get("failCode") or "kie_task_failed")
        time.sleep(interval_s)
    raise RuntimeError("kie_task_timeout")
