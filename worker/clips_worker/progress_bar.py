"""Animated progress bar overlay for export."""
from __future__ import annotations

import subprocess
from pathlib import Path

from clips_worker.probe import probe_duration


def apply_progress_bar(
    video: Path,
    out: Path,
    color: str,
    position: str,
    thickness: int,
    play_w: int,
    play_h: int,
) -> None:
    bar_h = max(6, min(12, int(thickness)))
    dur = max(0.1, probe_duration(video))
    y = 0 if position == "top" else play_h - bar_h
    c = color.lstrip("#")
    if len(c) == 6:
        ffmpeg_color = f"0x{c}@0.85"
    else:
        ffmpeg_color = "0xFFFFFF@0.85"
    fc = (
        f"color=c={ffmpeg_color}:s={play_w}x{bar_h}:d={dur:.3f}[bar];"
        f"[0:v][bar]overlay=x='-W+W*t/{dur:.3f}':y={y}:shortest=1"
    )
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(video),
            "-filter_complex",
            fc,
            "-c:a",
            "copy",
            str(out),
        ],
    )
