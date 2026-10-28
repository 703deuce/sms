"""Range-only video segment download for streamer clips."""
from __future__ import annotations

import subprocess
from pathlib import Path


def download_segment(
    url: str,
    dest: Path,
    start_s: float,
    end_s: float,
    *,
    job_id: str = "",
    vod_id: str = "",
    clip_id: str = "",
) -> None:
    from clips_worker.streamer.audio_first_ingest import (
        ingest_clip_section_video,
        stream_audio_first_ingest_enabled,
    )

    if stream_audio_first_ingest_enabled() and job_id and vod_id and clip_id:
        ingest_clip_section_video(
            url,
            dest,
            purpose="render",
            job_id=job_id,
            vod_id=vod_id,
            clip_id=clip_id,
            start_s=start_s,
            end_s=end_s,
        )
        return
    section = f"*{max(0.0, start_s):.3f}-{max(start_s + 0.1, end_s):.3f}"
    cmd = [
        "yt-dlp",
        "-f",
        "bv*[height<=1080][fps<=60]+ba/b[height<=1080]",
        "--merge-output-format",
        "mp4",
        "--download-sections",
        section,
        "--force-keyframes-at-cuts",
        "-o",
        str(dest),
        url,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    if proc.returncode != 0:
        raise RuntimeError((proc.stderr or proc.stdout or "segment download failed")[:500])


def cut_local_segment(src: Path, dest: Path, start_s: float, end_s: float) -> None:
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-ss",
            f"{start_s:.3f}",
            "-to",
            f"{end_s:.3f}",
            "-i",
            str(src),
            "-c",
            "copy",
            str(dest),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
