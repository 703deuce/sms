"""Persistent per-VOD download scratch (retries resume with yt-dlp --continue)."""
from __future__ import annotations

import shutil
from pathlib import Path

from clips_worker.streamer.config import SCRATCH


def vod_import_dir(vod_id: str) -> Path:
    safe = "".join(c if c.isalnum() or c in "_-" else "_" for c in vod_id)
    path = (SCRATCH / "imports" / safe).resolve()
    path.mkdir(parents=True, exist_ok=True)
    return path


def cleanup_vod_import_dir(vod_id: str) -> None:
    path = vod_import_dir(vod_id)
    if path.is_dir():
        shutil.rmtree(path, ignore_errors=True)
