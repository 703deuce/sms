"""ElevenLabs music/SFX (Python port for worker jobs)."""
from __future__ import annotations

import os
import random
import subprocess
import tempfile
import time
from pathlib import Path
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


def _merge_usage(parts: list[dict[str, Any]]) -> dict[str, Any]:
    seconds = sum(float(u.get("units") or 0) for u in parts)
    micros = sum(int(u.get("costUsdMicros") or 0) for u in parts)
    return {
        "provider": "elevenlabs",
        "model": "music_v1",
        "units": seconds,
        "unitType": "seconds",
        "costUsdMicros": micros,
    }


def _crossfade_two(a: bytes, b: bytes, crossfade_s: float, work: Path) -> bytes:
    p0 = work / "a.mp3"
    p1 = work / "b.mp3"
    out = work / "merged.mp3"
    p0.write_bytes(a)
    p1.write_bytes(b)
    fc = f"[0:a][1:a]acrossfade=d={crossfade_s}:c1=tri:c2=tri[a]"
    subprocess.run(
        [
            "ffmpeg",
            "-v",
            "error",
            "-y",
            "-i",
            str(p0),
            "-i",
            str(p1),
            "-filter_complex",
            fc,
            "-map",
            "[a]",
            str(out),
        ],
        check=True,
    )
    return out.read_bytes()


def _crossfade_mp3_segments(segments: list[bytes], crossfade_s: float = 3.0) -> bytes:
    if len(segments) == 1:
        return segments[0]
    with tempfile.TemporaryDirectory(prefix="t2v-music-") as td:
        work = Path(td)
        merged = segments[0]
        for seg in segments[1:]:
            merged = _crossfade_two(merged, seg, crossfade_s, work)
        return merged


def generate_music_for_length(prompt: str, length_ms: int, instrumental: bool) -> tuple[bytes, dict[str, Any]]:
    """ElevenLabs music_v1 (3s–300s per request); longer beds are segmented + crossfaded."""
    total_ms = int(_clamp(float(length_ms), 3000, 600_000))
    max_seg = 300_000
    if total_ms <= max_seg:
        return generate_music(prompt, total_ms, instrumental)
    segments: list[bytes] = []
    usages: list[dict[str, Any]] = []
    remaining = total_ms
    while remaining > 0:
        seg_ms = int(min(remaining, max_seg))
        audio, usage = generate_music(prompt, seg_ms, instrumental)
        segments.append(audio)
        usages.append(usage)
        remaining -= seg_ms
    merged = _crossfade_mp3_segments(segments)
    return merged, _merge_usage(usages)
