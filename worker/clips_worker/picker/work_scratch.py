"""Writable scratch dirs on regular (non-stream) worker."""
from __future__ import annotations

import os
from pathlib import Path


def worker_scratch_root() -> Path:
    raw = (
        os.environ.get("CLIPS_WORKER_SCRATCH")
        or os.environ.get("CLIPS_UPLOAD_STAGING_DIR")
        or "/opt/clips-worker/cache"
    )
    root = Path(raw).expanduser()
    root.mkdir(parents=True, exist_ok=True)
    return root


def video_picker_scratch_dir() -> Path:
    d = worker_scratch_root() / "video_picker"
    d.mkdir(parents=True, exist_ok=True)
    return d
