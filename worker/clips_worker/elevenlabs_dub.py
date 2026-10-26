"""ElevenLabs Dubbing API client."""
from __future__ import annotations

import os
import random
import time
from pathlib import Path
from typing import Any

import requests

from clips_worker.elevenlabs import _parse_error, _retryable


def _api_key() -> str:
    key = (os.environ.get("ELEVENLABS_API_KEY") or os.environ.get("ELEVENLABS_KEY") or "").strip()
    if not key:
        raise RuntimeError("ELEVENLABS_API_KEY is not configured")
    return key


def _headers() -> dict[str, str]:
    return {"xi-api-key": _api_key(), "accept": "application/json"}


def create_dubbing(video: Path, *, target_lang: str, name: str) -> str:
    url = "https://api.elevenlabs.io/v1/dubbing"
    data = {
        "name": name,
        "source_lang": "auto",
        "target_lang": target_lang,
        "num_speakers": "0",
        "watermark": "false",
        "drop_background_audio": "false",
        "highest_resolution": "false",
    }
    delays = (5, 15, 30)
    last: requests.Response | None = None
    for attempt in range(4):
        with video.open("rb") as fh:
            res = requests.post(
                url,
                headers=_headers(),
                data=data,
                files={"file": (video.name, fh, "video/mp4")},
                timeout=600,
            )
        last = res
        if res.ok:
            body = res.json()
            dub_id = body.get("dubbing_id")
            if not dub_id:
                raise RuntimeError("missing dubbing_id")
            return str(dub_id)
        err = _parse_error(res)
        if attempt < 3 and _retryable(res.status_code, err):
            time.sleep(delays[attempt] + random.uniform(0, 2))
            continue
        raise RuntimeError(err)
    raise RuntimeError(_parse_error(last) if last else "dubbing create failed")


def poll_dubbing(dubbing_id: str, *, timeout_s: float = 1200, interval_s: float = 10) -> None:
    url = f"https://api.elevenlabs.io/v1/dubbing/{dubbing_id}"
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        res = requests.get(url, headers=_headers(), timeout=120)
        if not res.ok:
            raise RuntimeError(_parse_error(res))
        body = res.json()
        status = str(body.get("status") or "").lower()
        if status in ("dubbed", "completed", "success"):
            return
        if status == "failed":
            raise RuntimeError(body.get("error") or "dubbing failed")
        time.sleep(interval_s)
    raise RuntimeError("dubbing poll timeout")


def download_dub_audio(dubbing_id: str, target_lang: str) -> bytes:
    url = f"https://api.elevenlabs.io/v1/dubbing/{dubbing_id}/audio/{target_lang}"
    res = requests.get(url, headers={**_headers(), "accept": "*/*"}, timeout=600)
    if not res.ok:
        raise RuntimeError(_parse_error(res))
    return res.content


def download_dub_transcript_srt(dubbing_id: str, target_lang: str) -> str:
    url = f"https://api.elevenlabs.io/v1/dubbing/{dubbing_id}/transcript/{target_lang}"
    res = requests.get(
        url,
        headers=_headers(),
        params={"format_type": "srt"},
        timeout=120,
    )
    if not res.ok:
        raise RuntimeError(_parse_error(res))
    return res.text
