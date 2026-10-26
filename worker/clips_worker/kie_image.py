"""Kie Nano Banana image tasks (worker)."""
from __future__ import annotations

import base64
import os
from typing import Any

import requests

JOBS_BASE = os.environ.get("KIE_API_BASE_URL", "https://api.kie.ai").rstrip("/")
UPLOAD_BASE = os.environ.get("KIE_UPLOAD_BASE_URL", "https://kieai.redpandaai.co").rstrip("/")


def _key() -> str:
    k = (os.environ.get("KIE_API_KEY") or "").strip()
    if not k:
        raise RuntimeError("KIE_API_KEY is not configured")
    return k


def image_model() -> str:
    return (os.environ.get("KIE_IMAGE_MODEL") or "nano-banana-2").strip()


def upload_jpeg(jpeg: bytes, workspace_id: str, label: str) -> str:
    b64 = base64.b64encode(jpeg).decode()
    res = requests.post(
        f"{UPLOAD_BASE}/api/file-base64-upload",
        headers={"Authorization": f"Bearer {_key()}", "Content-Type": "application/json"},
        json={
            "base64Data": f"data:image/jpeg;base64,{b64}",
            "uploadPath": f"clips-{workspace_id}".replace("/", "_"),
            "fileName": f"{label}-{os.getpid()}.jpg",
        },
        timeout=120,
    )
    data = res.json()
    if data.get("code") != 200:
        raise RuntimeError(data.get("msg") or "upload failed")
    url = (data.get("data") or {}).get("downloadUrl") or (data.get("data") or {}).get("fileUrl")
    if not url:
        raise RuntimeError("upload missing url")
    return url


def create_image_task(prompt: str, image_urls: list[str], aspect: str, callback_url: str) -> str:
    body: dict[str, Any] = {
        "model": image_model(),
        "callBackUrl": callback_url,
        "input": {
            "prompt": prompt,
            "image_input": image_urls,
            "image_urls": image_urls,
            "aspect_ratio": aspect,
            "resolution": "2K",
            "output_format": "png",
        },
    }
    res = requests.post(
        f"{JOBS_BASE}/api/v1/jobs/createTask",
        headers={"Authorization": f"Bearer {_key()}", "Content-Type": "application/json"},
        json=body,
        timeout=60,
    )
    data = res.json()
    if data.get("code") != 200:
        raise RuntimeError(data.get("msg") or "createTask failed")
    task_id = (data.get("data") or {}).get("taskId")
    if not task_id:
        raise RuntimeError("missing taskId")
    return task_id
