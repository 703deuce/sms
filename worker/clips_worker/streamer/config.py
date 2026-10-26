"""Streamer worker env defaults (see STREAMER_BUILD_SPEC §12)."""
from __future__ import annotations

import os
from pathlib import Path


def _int(name: str, default: int) -> int:
    return int(os.environ.get(name, str(default)))


def _float(name: str, default: float) -> float:
    return float(os.environ.get(name, str(default)))


FULL_DOWNLOAD_MAX_MIN = _int("STREAMER_FULL_DOWNLOAD_MAX_MIN", 20)
MAX_VOD_HOURS = _int("STREAMER_MAX_VOD_HOURS", 12)
CHUNK_MIN = _int("STREAMER_CHUNK_MIN", 15)
CHUNK_OVERLAP_S = _int("STREAMER_CHUNK_OVERLAP_S", 30)
SEGMENT_PAD_S = _int("STREAMER_SEGMENT_PAD_S", 30)
SOURCE_RETENTION_HOURS = _int("STREAMER_SOURCE_RETENTION_HOURS", 24)
DEFAULT_MONTHLY_HOURS = _float("STREAMER_DEFAULT_MONTHLY_HOURS", 40.0)
MAX_RUNNING_ANALYZE = _int("STREAMER_MAX_RUNNING_PER_WORKSPACE", 1)
LLM_CANDIDATES = _int("STREAMER_LLM_CANDIDATES", 40)
SCRATCH = Path(os.environ.get("STREAMER_SCRATCH_DIR", "/tmp/streamer"))
