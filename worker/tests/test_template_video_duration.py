from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

from clips_worker.edits_render import ensure_template_video_duration


FFMPEG = shutil.which("ffmpeg")
FFPROBE = shutil.which("ffprobe")


def run(args: list[str]) -> str:
    proc = subprocess.run(args, capture_output=True, text=True, check=False)
    if proc.returncode:
        raise RuntimeError((proc.stderr or proc.stdout or "")[-2000:])
    return (proc.stdout or "").strip()


def frames(path: Path) -> int:
    return int(run([
        FFPROBE, "-v", "error", "-select_streams", "v:0", "-count_frames",
        "-show_entries", "stream=nb_read_frames",
        "-of", "default=noprint_wrappers=1:nokey=1", str(path),
    ]))


def duration(path: Path) -> float:
    return float(run([
        FFPROBE, "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(path),
    ]))


@pytest.mark.skipif(not FFMPEG or not FFPROBE, reason="ffmpeg/ffprobe required")
def test_template_export_pads_short_video_tail_to_program_clock(tmp_path: Path) -> None:
    short = tmp_path / "short_video_track.mp4"
    run([
        FFMPEG, "-y", "-v", "error",
        "-f", "lavfi", "-i", "color=c=green:s=160x90:r=30:d=2.933333",
        "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=3",
        "-map", "0:v:0", "-map", "1:a:0",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", str(short),
    ])
    assert frames(short) == 88
    assert ensure_template_video_duration(short, 3000, tmp_path) is True
    assert frames(short) == 90
    assert duration(short) == pytest.approx(3.0, abs=0.04)
    streams = json.loads(run([
        FFPROBE, "-v", "error", "-show_streams", "-of", "json", str(short),
    ]))["streams"]
    assert {stream["codec_type"] for stream in streams} == {"video", "audio"}
