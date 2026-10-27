"""ElevenLabs audio isolation (Studio Sound)."""
from __future__ import annotations

import os
from pathlib import Path

import requests

from clips_worker.elevenlabs import _api_key, _post_with_retry


def isolate_audio_file(audio_path: Path) -> bytes:
    """Return isolated speech audio bytes (typically mp3)."""
    url = "https://api.elevenlabs.io/v1/audio-isolation"
    with audio_path.open("rb") as f:
        files = {"audio": (audio_path.name, f, "application/octet-stream")}
        res = _post_with_retry(
            url,
            headers={"xi-api-key": _api_key(), "accept": "audio/mpeg"},
            files=files,
            timeout=600,
        )
    return res.content


def isolation_cost_micros(duration_sec: float) -> int:
    """Bill roughly like SFX ($0.12/min)."""
    minutes = max(0.5, float(duration_sec)) / 60.0
    return int(round(minutes * 0.12 * 1_000_000))
