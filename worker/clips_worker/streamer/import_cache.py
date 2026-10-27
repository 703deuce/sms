"""Persistent per-VOD download scratch (retries resume with yt-dlp --continue)."""
from __future__ import annotations

import shutil
import time
from pathlib import Path

from clips_worker.streamer.config import SCRATCH

FAILED_IMPORT_MAX_AGE_S = 7 * 86400


def vod_import_dir(vod_id: str) -> Path:
    safe = "".join(c if c.isalnum() or c in "_-" else "_" for c in vod_id)
    path = (SCRATCH / "imports" / safe).resolve()
    path.mkdir(parents=True, exist_ok=True)
    return path


def cleanup_vod_import_dir(vod_id: str) -> None:
    path = vod_import_dir(vod_id)
    if path.is_dir():
        shutil.rmtree(path, ignore_errors=True)


def pick_completed_audio(cache_dir: Path) -> Path | None:
    """First finished audio artifact (exclude yt-dlp .part partials)."""
    candidates = sorted(
        p for p in cache_dir.glob("audio.*") if p.is_file() and not p.name.endswith(".part")
    )
    return candidates[0] if candidates else None


def sweep_stale_failed_import_dirs(max_age_s: int = FAILED_IMPORT_MAX_AGE_S) -> int:
    """Remove import scratch dirs older than max_age_s (failed/abandoned downloads)."""
    root = (SCRATCH / "imports").resolve()
    if not root.is_dir():
        return 0
    cutoff = time.time() - max_age_s
    removed = 0
    for child in root.iterdir():
        if not child.is_dir():
            continue
        try:
            if child.stat().st_mtime < cutoff:
                shutil.rmtree(child, ignore_errors=True)
                removed += 1
        except OSError:
            continue
    return removed
