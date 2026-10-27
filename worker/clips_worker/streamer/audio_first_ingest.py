"""Stage-2 stream ingest: audio-first, section-only video, disk guards, resumable sections.

Public entry points for STREAM_IMPORT / STREAM_RENDER and Agent A autopull:

- ``ingest_vod_audio`` — lowest-bitrate audio only, upload, delete local scratch
- ``ingest_clip_section_video`` — one padded clip range via yt-dlp sections
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

from clips_worker.streamer.config import SCRATCH
from clips_worker.streamer.errors import RetryableError
from clips_worker.streamer.import_cache import pick_completed_audio
from clips_worker.streamer.ytdlp import _platform_from_url

# Lowest practical audio for transcribe/rank (still mono 16 kHz opus post-process).
AUDIO_FORMAT = (
    "worstaudio/worst[acodec!=none]/"
    "ba[abr<=48]/bestaudio[abr<=64]/bestaudio/b"
)

DISK_MIN_FREE_BYTES = int(os.environ.get("STREAM_INGEST_MIN_FREE_BYTES", str(2 * 1024**3)))
DISK_BYTES_PER_SECTION_EST = int(os.environ.get("STREAM_INGEST_SECTION_EST_BYTES", str(80 * 1024**2)))


class IngestDiskQueueError(RetryableError):
    """Scratch disk below threshold — retry later."""


@dataclass
class IngestMetrics:
    job_id: str = ""
    vod_id: str = ""
    bytes_downloaded: int = 0
    audio_ms: int = 0
    sections: int = 0
    peak_disk_mb: float = 0.0
    platform: str = ""

    def add_bytes(self, n: int, scratch_dir: Path) -> None:
        self.bytes_downloaded += max(0, int(n))
        self._refresh_peak(scratch_dir)

    def _refresh_peak(self, scratch_dir: Path) -> None:
        total = 0
        if scratch_dir.is_dir():
            for p in scratch_dir.rglob("*"):
                if p.is_file():
                    try:
                        total += p.stat().st_size
                    except OSError:
                        pass
        self.peak_disk_mb = max(self.peak_disk_mb, total / (1024 * 1024))


def stream_audio_first_ingest_enabled() -> bool:
    raw = (os.environ.get("STREAM_AUDIO_FIRST_INGEST") or "1").strip().lower()
    return raw not in ("0", "false", "no", "off")


def ingest_platform_label(url: str) -> str:
    p = _platform_from_url(url)
    return p or "unknown"


def log_ingest_summary(metrics: IngestMetrics) -> None:
    print(
        "[clipper:ingest] "
        f"job={metrics.job_id} vodId={metrics.vod_id} platform={metrics.platform} "
        f"bytes_downloaded={metrics.bytes_downloaded} audio_ms={metrics.audio_ms} "
        f"sections={metrics.sections} peak_disk_mb={round(metrics.peak_disk_mb, 2)}",
        flush=True,
    )


def assert_scratch_headroom(
    *,
    scratch: Path = SCRATCH,
    need_bytes: int = DISK_BYTES_PER_SECTION_EST,
    min_free: int = DISK_MIN_FREE_BYTES,
) -> None:
    usage = shutil.disk_usage(scratch)
    if usage.free < min_free:
        raise IngestDiskQueueError(
            f"Scratch disk low ({usage.free // (1024**2)} MB free); ingest queued until space is available."
        )
    if usage.free < need_bytes * 2:
        raise IngestDiskQueueError(
            f"Not enough scratch disk for section download (need ~{need_bytes // (1024**2)} MB headroom)."
        )


class JobIngestWorkspace:
    """Per-job temp dir with peak disk tracking and guaranteed cleanup."""

    def __init__(self, job_id: str, vod_id: str, *, parent: Path | None = None) -> None:
        self.job_id = job_id
        self.vod_id = vod_id
        self.parent = parent or (SCRATCH / "ingest")
        self.metrics = IngestMetrics(job_id=job_id, vod_id=vod_id)
        self._dir: Path | None = None

    def __enter__(self) -> JobIngestWorkspace:
        self.parent.mkdir(parents=True, exist_ok=True)
        self._dir = Path(tempfile.mkdtemp(prefix=f"ingest_{self.vod_id[:12]}_", dir=str(self.parent)))
        return self

    @property
    def path(self) -> Path:
        if self._dir is None:
            raise RuntimeError("JobIngestWorkspace not entered")
        return self._dir

    def track_path(self, p: Path) -> None:
        if p.is_file():
            self.metrics.add_bytes(p.stat().st_size, self.path)

    def __exit__(self, exc_type, exc, tb) -> None:
        if self._dir and self._dir.is_dir():
            self.metrics._refresh_peak(self._dir)
            log_ingest_summary(self.metrics)
            shutil.rmtree(self._dir, ignore_errors=True)
        self._dir = None


def _section_spec(start_s: float, end_s: float) -> str:
    a = max(0.0, start_s)
    b = max(a + 0.1, end_s)
    return f"*{a:.3f}-{b:.3f}"


def _run_audio_ytdlp(
    url: str,
    dest_template: str,
    section: str | None,
    workdir: Path,
    progress_cb: Callable[[float], None] | None,
) -> None:
    from clips_worker.streamer.http_download import run_ytdlp

    cmd = [
        "yt-dlp",
        "--retries",
        "5",
        "--fragment-retries",
        "12",
        "--continue",
        "--concurrent-fragments",
        "4",
        "-f",
        AUDIO_FORMAT,
        "-x",
        "--audio-format",
        "opus",
        "--postprocessor-args",
        "ffmpeg:-ac 1 -ar 16000 -b:a 24k",
        "-o",
        dest_template,
        "--newline",
        "-P",
        str(workdir),
    ]
    if section:
        cmd.extend(["--download-sections", section])
    cmd.append(url)
    run_ytdlp(cmd, progress_cb, step="Downloading audio")


def _probe_audio_ms(path: Path) -> int:
    try:
        out = subprocess.check_output(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(path),
            ],
            text=True,
        ).strip()
        return int(float(out) * 1000)
    except (subprocess.CalledProcessError, ValueError):
        return 0


def ingest_vod_audio(
    url: str,
    *,
    job_id: str,
    vod_id: str,
    section: str | None,
    progress_cb: Callable[[float], None] | None = None,
) -> tuple[Path, IngestMetrics]:
    """
    Download audio-only (full VOD or range section). Caller uploads then deletes ``audio_path``.
    """
    assert_scratch_headroom(need_bytes=200 * 1024**2)
    metrics = IngestMetrics(job_id=job_id, vod_id=vod_id, platform=ingest_platform_label(url))
    with JobIngestWorkspace(job_id, vod_id) as ws:
        dest_tmpl = str(ws.path / "audio.%(ext)s")
        _run_audio_ytdlp(url, dest_tmpl, section, ws.path, progress_cb)
        audio_path = pick_completed_audio(ws.path)
        if audio_path is None:
            raise RuntimeError("audio download incomplete (no finished audio file)")
        ws.track_path(audio_path)
        metrics.bytes_downloaded = ws.metrics.bytes_downloaded
        metrics.peak_disk_mb = ws.metrics.peak_disk_mb
        metrics.audio_ms = _probe_audio_ms(audio_path)
        staged = SCRATCH / "ingest_staging" / f"{vod_id}_audio.opus"
        staged.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(audio_path, staged)
        metrics.bytes_downloaded = max(metrics.bytes_downloaded, staged.stat().st_size)
    log_ingest_summary(metrics)
    return staged, metrics


def _section_marker(work_dir: Path, clip_id: str) -> Path:
    return work_dir / f".section_{clip_id}.done"


def ingest_clip_section_video(
    url: str,
    dest: Path,
    *,
    job_id: str,
    vod_id: str,
    clip_id: str,
    start_s: float,
    end_s: float,
    progress_cb: Callable[[float], None] | None = None,
    work_dir: Path | None = None,
) -> IngestMetrics:
    """Download one clip section (+ padding already applied by caller). Resumes if marker exists."""
    assert_scratch_headroom()
    metrics = IngestMetrics(
        job_id=job_id,
        vod_id=vod_id,
        platform=ingest_platform_label(url),
        sections=1,
    )
    wd = work_dir or (SCRATCH / "ingest_sections" / vod_id)
    wd.mkdir(parents=True, exist_ok=True)
    marker = _section_marker(wd, clip_id)
    if marker.is_file() and dest.is_file() and dest.stat().st_size > 0:
        metrics.bytes_downloaded = dest.stat().st_size
        metrics.peak_disk_mb = dest.stat().st_size / (1024 * 1024)
        log_ingest_summary(metrics)
        return metrics

    from clips_worker.streamer.http_download import run_ytdlp

    section = _section_spec(start_s, end_s)
    partial = wd / f"section_{clip_id}.%(ext)s"
    cmd = [
        "yt-dlp",
        "--retries",
        "5",
        "--fragment-retries",
        "12",
        "--continue",
        "-f",
        "bv*[height<=1080][fps<=60]+ba/b[height<=1080]/b",
        "--merge-output-format",
        "mp4",
        "--download-sections",
        section,
        "--force-keyframes-at-cuts",
        "-o",
        str(partial),
        "--newline",
        "-P",
        str(wd),
        url,
    ]
    run_ytdlp(cmd, progress_cb, step="Downloading section")
    # yt-dlp may emit section_<id>.mp4 or section_<id>.f*.mp4 — pick newest mp4 for clip_id prefix.
    candidates = sorted(wd.glob(f"section_{clip_id}*.mp4"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not candidates:
        raise RuntimeError("section download produced no mp4")
    shutil.move(str(candidates[0]), str(dest))
    if dest.is_file():
        metrics.bytes_downloaded = dest.stat().st_size
        metrics.peak_disk_mb = dest.stat().st_size / (1024 * 1024)
    marker.write_text(json.dumps({"dest": str(dest), "ts": time.time()}), encoding="utf-8")
    log_ingest_summary(metrics)
    return metrics


def delete_local_ingest_file(path: Path) -> None:
    try:
        if path.is_file():
            path.unlink()
    except OSError:
        pass
