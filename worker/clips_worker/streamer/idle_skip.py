"""Detect long idle spans to skip transcribe (marathon / subathon)."""
from __future__ import annotations

import os
import subprocess
from dataclasses import dataclass
from pathlib import Path


def _float_env(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, str(default)))
    except ValueError:
        return default


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, str(default)))
    except ValueError:
        return default


IDLE_AUDIO_RMS_DB = _float_env("STREAM_IDLE_AUDIO_RMS_DB", -45.0)
IDLE_MIN_SKIP_MIN = _int_env("STREAM_IDLE_MIN_SKIP_MIN", 20)
IDLE_CHAT_MAX_MSG_PER_MIN = _float_env("STREAM_IDLE_CHAT_MAX_MSG_PER_MIN", 2.0)


@dataclass(frozen=True)
class IdleRange:
    start_ms: int
    end_ms: int
    reason: str


def _rms_db_per_second(audio_path: Path, duration_s: int) -> list[float]:
    """Sample mean RMS per second via ffmpeg astats (lightweight)."""
    if duration_s <= 0:
        return []
    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-nostats",
        "-i",
        str(audio_path),
        "-af",
        "astats=metadata=1:reset=1,ametadata=print:file=-",
        "-f",
        "null",
        "-",
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=max(60, duration_s * 2))
    except (subprocess.TimeoutExpired, OSError):
        return []
    # Fallback: if parsing fails, do not skip (safe default).
    lines = (proc.stderr or "") + (proc.stdout or "")
    if "RMS level dB" not in lines and "RMS_level" not in lines:
        return []
    # v1: insufficient structured parse in all ffmpeg builds — defer to chunk-level heuristic.
    return []


def chat_msgs_per_minute(chat_lines: list[dict], window_start_ms: int, window_end_ms: int) -> float:
    if window_end_ms <= window_start_ms:
        return 0.0
    minutes = max(1 / 60.0, (window_end_ms - window_start_ms) / 60_000.0)
    count = 0
    for line in chat_lines:
        at_ms = int(line.get("atMs") or line.get("offsetMs") or 0)
        if window_start_ms <= at_ms < window_end_ms:
            count += 1
    return count / minutes


def should_skip_chunk_transcribe(
    *,
    chunk_audio: Path,
    vod_start_ms: int,
    vod_end_ms: int,
    chat_lines: list[dict] | None = None,
) -> IdleRange | None:
    """
    Return an IdleRange if this chunk is entirely low-activity and long enough to skip GPU.
    Partial idle inside a chunk is handled in a later phase (split chunk).
    """
    duration_s = max(1, int((vod_end_ms - vod_start_ms) / 1000))
    min_s = IDLE_MIN_SKIP_MIN * 60
    if duration_s < min_s:
        return None

    # Cheap peak check via ffmpeg volumedetect on whole chunk.
    try:
        proc = subprocess.run(
            [
                "ffmpeg",
                "-hide_banner",
                "-i",
                str(chunk_audio),
                "-af",
                "volumedetect",
                "-f",
                "null",
                "-",
            ],
            capture_output=True,
            text=True,
            timeout=max(120, duration_s),
        )
        text = proc.stderr or ""
    except (subprocess.TimeoutExpired, OSError):
        return None

    mean_db = None
    for line in text.splitlines():
        if "mean_volume:" in line:
            try:
                mean_db = float(line.split("mean_volume:")[-1].split("dB")[0].strip())
            except ValueError:
                pass
    if mean_db is None:
        return None

    chat_ok = True
    if chat_lines is not None:
        rate = chat_msgs_per_minute(chat_lines, vod_start_ms, vod_end_ms)
        chat_ok = rate <= IDLE_CHAT_MAX_MSG_PER_MIN

    if mean_db <= IDLE_AUDIO_RMS_DB and chat_ok:
        return IdleRange(vod_start_ms, vod_end_ms, "audio+chat")
    return None


def log_idle_skip(vod_id: str, session_id: str | None, idle: IdleRange) -> None:
    hours = (idle.end_ms - idle.start_ms) / 3_600_000.0
    sid = session_id or "-"
    print(
        f"[clipper:stream] idle_skip vodId={vod_id} sessionId={sid} "
        f"startMs={idle.start_ms} endMs={idle.end_ms} hours={hours:.2f} reason={idle.reason}",
        flush=True,
    )
