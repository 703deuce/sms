"""Lightweight analysis proxy for uploads and VOD URLs — master/full-res only for final render."""
from __future__ import annotations

import json
import subprocess
import time
from pathlib import Path

from clips_worker.storage import upload_file
from clips_worker.streamer.config import SCRATCH

# Build proxy when master is larger than this (bytes).
UPLOAD_PROXY_MIN_BYTES = 200 * 1024 * 1024

YTDLP_ANALYSIS_FORMAT = "bv*[height<=480][fps<=30]+ba/b[height<=480]/b"


def should_build_upload_proxy(master_bytes: int) -> bool:
    return master_bytes >= UPLOAD_PROXY_MIN_BYTES


def build_analysis_proxy(master: Path, dest: Path) -> None:
    """~480p H.264 proxy for layout / vision / video picker — not used for final clip renders."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg",
        "-y",
        "-v",
        "error",
        "-i",
        str(master),
        "-vf",
        "scale=-2:480",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "24",
        "-an",
        "-movflags",
        "+faststart",
        str(dest),
    ]
    subprocess.check_call(cmd)


def stream_analysis_proxy_key(workspace_id: str, vod_id: str) -> str:
    return f"ws/{workspace_id}/streams/{vod_id}/analysis_proxy.mp4"


def _section_spec(start_s: float, end_s: float) -> str:
    return f"*{start_s:.3f}-{end_s:.3f}"


def download_vod_analysis_proxy(
    url: str,
    dest: Path,
    *,
    range_start_ms: int,
    range_end_ms: int | None,
    job_id: str,
    vod_id: str,
    progress_cb=None,
) -> None:
    """One cached 360–480p proxy for the VOD trim range (yt-dlp, stored in object storage)."""
    from clips_worker.streamer.http_download import run_ytdlp

    dest.parent.mkdir(parents=True, exist_ok=True)
    start_s = max(0.0, range_start_ms / 1000.0)
    end_s = (range_end_ms / 1000.0) if range_end_ms and range_end_ms > range_start_ms else None
    section = _section_spec(start_s, end_s) if end_s and end_s > start_s else None
    wd = SCRATCH / "analysis_proxy_ingest" / vod_id
    wd.mkdir(parents=True, exist_ok=True)
    partial = wd / "analysis_proxy.%(ext)s"
    cmd = [
        "yt-dlp",
        "--retries",
        "5",
        "--fragment-retries",
        "12",
        "--continue",
        "-f",
        YTDLP_ANALYSIS_FORMAT,
        "--merge-output-format",
        "mp4",
        "-o",
        str(partial),
        "--newline",
        "-P",
        str(wd),
    ]
    if section:
        cmd.extend(["--download-sections", section, "--force-keyframes-at-cuts"])
    cmd.append(url)
    run_ytdlp(cmd, progress_cb, step="analysis_proxy")
    candidates = sorted(wd.glob("analysis_proxy*.mp4"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not candidates:
        raise RuntimeError("analysis proxy download produced no mp4")
    import shutil

    shutil.move(str(candidates[0]), str(dest))


def ensure_vod_analysis_proxy(
    *,
    vod: dict,
    state: dict,
    workspace_id: str,
    vod_id: str,
    scratch: Path,
    job_id: str,
) -> dict:
    """Ensure state['analysisProxyKey'] points at a stored ~480p proxy for this VOD range."""
    if state.get("analysisProxyKey"):
        return state
    url = vod.get("url")
    if not url:
        return state
    start_ms = int(vod.get("rangeStartMs") or 0)
    end_ms = vod.get("rangeEndMs")
    end_i = int(end_ms) if end_ms is not None else None
    dest = scratch / "analysis_proxy_upload.mp4"
    download_vod_analysis_proxy(
        str(url),
        dest,
        range_start_ms=start_ms,
        range_end_ms=end_i,
        job_id=job_id,
        vod_id=vod_id,
    )
    key = stream_analysis_proxy_key(workspace_id, vod_id)
    upload_file(key, dest, "video/mp4")
    marker = scratch / ".analysis_proxy_key"
    marker.write_text(json.dumps({"key": key, "ts": time.time()}), encoding="utf-8")
    return {**state, "analysisProxyKey": key}


def ytdlp_section_format() -> str:
    return YTDLP_ANALYSIS_FORMAT
