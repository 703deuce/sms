"""ElevenLabs music/SFX (Python port for worker jobs)."""
from __future__ import annotations

import os
import random
import time
from typing import Any

import requests

MUSIC_COST_MICROS_PER_SEC = round((0.15 / 60) * 1_000_000)
SFX_COST_MICROS_PER_SEC = round((0.12 / 60) * 1_000_000)


def _api_key() -> str:
    key = (os.environ.get("ELEVENLABS_API_KEY") or os.environ.get("ELEVENLABS_KEY") or "").strip()
    if not key:
        raise RuntimeError("ELEVENLABS_API_KEY is not configured")
    return key


def _clamp(n: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, n))


def _retryable(status: int, message: str) -> bool:
    if status in (429, 503):
        return True
    low = message.lower()
    return "heavy traffic" in low or "busy" in low or "rate limit" in low


def _post_with_retry(url: str, **kwargs: Any) -> requests.Response:
    delays = (5, 15, 30)
    last: requests.Response | None = None
    for attempt in range(4):
        res = requests.post(url, **kwargs)
        last = res
        if res.ok:
            return res
        err = _parse_error(res)
        if attempt < 3 and _retryable(res.status_code, err):
            wait = delays[attempt] + random.uniform(0, 2)
            time.sleep(wait)
            continue
        raise RuntimeError(err)
    raise RuntimeError(_parse_error(last) if last else "ElevenLabs request failed")


def _parse_error(res: requests.Response) -> str:
    try:
        body = res.json()
        detail = (body or {}).get("detail") or {}
        if detail.get("status") == "bad_prompt":
            sug = (detail.get("data") or {}).get("prompt_suggestion")
            if sug:
                return f"bad_prompt: {sug}"
        msg = detail.get("message")
        if msg:
            return str(msg)
    except Exception:
        pass
    return res.text[:300] or f"ElevenLabs HTTP {res.status_code}"


def generate_music(prompt: str, length_ms: int, instrumental: bool) -> tuple[bytes, dict[str, Any]]:
    music_length_ms = int(_clamp(float(length_ms), 3000, 300_000))
    url = "https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128"
    res = _post_with_retry(
        url,
        headers={"xi-api-key": _api_key(), "accept": "audio/mpeg", "content-type": "application/json"},
        json={
            "prompt": str(prompt or "")[:4000],
            "music_length_ms": music_length_ms,
            "model_id": "music_v1",
            "force_instrumental": bool(instrumental),
        },
        timeout=600,
    )
    seconds = music_length_ms / 1000.0
    usage = {
        "provider": "elevenlabs",
        "model": "music_v1",
        "units": seconds,
        "unitType": "seconds",
        "costUsdMicros": int(round(seconds * MUSIC_COST_MICROS_PER_SEC)),
    }
    return res.content, usage
