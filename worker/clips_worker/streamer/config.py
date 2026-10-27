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
# Bulky audio/chunks/segments: delete immediately after READY/FAILED (0 = now).
SOURCE_RETENTION_HOURS = _int("STREAMER_SOURCE_RETENTION_HOURS", 0)
CLIP_RETENTION_DAYS_MONTHLY = _int("STREAMER_CLIP_RETENTION_DAYS_MONTHLY", 14)
CLIP_RETENTION_DAYS_ANNUAL = _int("STREAMER_CLIP_RETENTION_DAYS_ANNUAL", 90)
DISK_GUARD_PCT = _int("STREAMER_DISK_GUARD_PCT", 85)
DEFAULT_MONTHLY_HOURS = _float("STREAMER_DEFAULT_MONTHLY_HOURS", 40.0)
MAX_RUNNING_ANALYZE = _int("STREAMER_MAX_RUNNING_PER_WORKSPACE", 1)
LLM_CANDIDATES = _int("STREAMER_LLM_CANDIDATES", 40)
SCRATCH = Path(os.environ.get("STREAMER_SCRATCH_DIR", "/tmp/streamer"))


def stream_chat_signal_enabled() -> bool:
    """VOD chat replay + ranker chat signal (default on). Set STREAM_CHAT_SIGNAL=0 to disable."""
    raw = (os.environ.get("STREAM_CHAT_SIGNAL") or "1").strip().lower()
    return raw in ("1", "true", "yes", "on")


def stream_chat_reaction_weight(settings: dict | None = None) -> float:
    streamer = (settings or {}).get("streamer") if isinstance(settings, dict) else {}
    if isinstance(streamer, dict) and streamer.get("chatReactionWeight") is not None:
        return float(streamer["chatReactionWeight"])
    return _float("STREAM_CHAT_REACTION_WEIGHT", 0.45)
