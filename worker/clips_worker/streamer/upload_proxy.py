"""Lightweight analysis proxy for large uploads — master stays untouched for renders."""
from __future__ import annotations

import subprocess
from pathlib import Path

from clips_worker.streamer.config import SCRATCH

# Build proxy when master is larger than this (bytes).
UPLOAD_PROXY_MIN_BYTES = 200 * 1024 * 1024


def should_build_upload_proxy(master_bytes: int) -> bool:
    return master_bytes >= UPLOAD_PROXY_MIN_BYTES


def build_analysis_proxy(master: Path, dest: Path) -> None:
    """720p H.264 proxy for layout / vision — not used for final clip renders."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg",
        "-y",
        "-v",
        "error",
        "-i",
        str(master),
        "-vf",
        "scale=-2:720",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-an",
        "-movflags",
        "+faststart",
        str(dest),
    ]
    subprocess.check_call(cmd)


def stream_analysis_proxy_key(workspace_id: str, vod_id: str) -> str:
    return f"ws/{workspace_id}/streams/{vod_id}/analysis_proxy.mp4"
