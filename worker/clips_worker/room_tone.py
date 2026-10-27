"""Room tone: extract quiet loop and bed under EDL gap segments."""
from __future__ import annotations

import re
import subprocess
from pathlib import Path


def extract_room_tone_sample(source_video: Path, work_dir: Path, duration_s: float = 2.0) -> Path:
    """Pick a quiet window via silencedetect; fallback to head of file."""
    work_dir.mkdir(parents=True, exist_ok=True)
    log = subprocess.check_output(
        [
            "ffmpeg",
            "-hide_banner",
            "-i",
            str(source_video),
            "-af",
            "silencedetect=n=-50dB:d=0.5",
            "-f",
            "null",
            "-",
        ],
        stderr=subprocess.STDOUT,
        text=True,
    )
    starts: list[float] = []
    for line in log.splitlines():
        m = re.search(r"silence_start:\s*([\d.]+)", line)
        if m:
            starts.append(float(m.group(1)))
    start_s = starts[0] if starts else 0.0
    out = work_dir / "room_tone_loop.wav"
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-ss",
            f"{start_s:.3f}",
            "-i",
            str(source_video),
            "-t",
            f"{duration_s:.3f}",
            "-vn",
            "-ac",
            "1",
            "-ar",
            "44100",
            str(out),
        ],
    )
    return out


def apply_room_tone_under_gaps(
    video: Path,
    out_video: Path,
    room_loop: Path,
    gap_segments: list[dict],
    *,
    gap_volume_db: float = -6.0,
) -> None:
    """Mix looping room tone during output-timeline gap segments (audio only)."""
    if not gap_segments or not room_loop.is_file():
        subprocess.check_call(["cp", str(video), str(out_video)])
        return

    vol = 10 ** (gap_volume_db / 20.0)
    filters: list[str] = []
    inputs = ["-i", str(video), "-stream_loop", "-1", "-i", str(room_loop)]
    labels: list[str] = ["[0:a]"]
    for i, g in enumerate(gap_segments):
        dur_ms = max(1, int(g.get("durMs") or 0))
        at_ms = max(0, int(g.get("outInMs") or 0))
        lbl = f"rt{i}"
        filters.append(
            f"[1:a]atrim=0:{dur_ms / 1000:.3f},asetpts=PTS-STARTPTS,"
            f"volume={vol:.4f},adelay={at_ms}|{at_ms}[{lbl}]"
        )
        labels.append(f"[{lbl}]")
    n = len(labels)
    filters.append(f"{''.join(labels)}amix=inputs={n}:duration=first:normalize=0,alimiter=limit=0.95[aout]")
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            *inputs,
            "-filter_complex",
            ";".join(filters),
            "-map",
            "0:v:0",
            "-map",
            "[aout]",
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-shortest",
            str(out_video),
        ],
    )
