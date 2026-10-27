"""Persistent per-VOD download scratch (retries resume with yt-dlp --continue)."""
from __future__ import annotations

import json
import shutil
import time
from pathlib import Path
from typing import Any

from clips_worker.streamer.config import SCRATCH

FAILED_IMPORT_MAX_AGE_S = 48 * 3600


def _safe_vod_dir_name(vod_id: str) -> str:
    return "".join(c if c.isalnum() or c in "_-" else "_" for c in vod_id)


def vod_import_dir(vod_id: str) -> Path:
    path = (SCRATCH / "imports" / _safe_vod_dir_name(vod_id)).resolve()
    path.mkdir(parents=True, exist_ok=True)
    return path


def cleanup_vod_import_dir(vod_id: str) -> None:
    path = vod_import_dir(vod_id)
    if path.is_dir():
        shutil.rmtree(path, ignore_errors=True)


def _is_partial_audio(name: str) -> bool:
    if name.endswith(".part"):
        return True
    if ".ytdl" in name or ".temp" in name:
        return True
    if ".part-Frag" in name:
        return True
    return False


def pick_completed_audio(cache_dir: Path) -> Path | None:
    """First finished audio artifact (exclude yt-dlp partials)."""
    candidates = sorted(
        p for p in cache_dir.glob("audio.*") if p.is_file() and not _is_partial_audio(p.name)
    )
    return candidates[0] if candidates else None


def _active_import_dir_names(conn: Any) -> set[str]:
    names: set[str] = set()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT payload FROM clip_jobs
            WHERE type = 'STREAM_IMPORT' AND status IN ('QUEUED', 'RUNNING')
            """,
        )
        for (payload,) in cur.fetchall():
            if isinstance(payload, str):
                payload = json.loads(payload)
            if not isinstance(payload, dict):
                continue
            vod_id = payload.get("vodId")
            if vod_id:
                names.add(_safe_vod_dir_name(str(vod_id)))
    return names


def sweep_stale_failed_import_dirs(max_age_s: int = FAILED_IMPORT_MAX_AGE_S, conn: Any | None = None) -> int:
    """Remove import scratch dirs older than max_age_s (failed/abandoned downloads)."""
    root = (SCRATCH / "imports").resolve()
    if not root.is_dir():
        return 0
    cutoff = time.time() - max_age_s
    skip = _active_import_dir_names(conn) if conn is not None else set()
    removed = 0
    for child in root.iterdir():
        if not child.is_dir():
            continue
        if child.name in skip:
            continue
        try:
            if child.stat().st_mtime < cutoff:
                shutil.rmtree(child, ignore_errors=True)
                removed += 1
        except OSError:
            continue
    return removed
