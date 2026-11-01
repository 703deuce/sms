"""FFmpeg helpers with stderr tails for job errors."""
from __future__ import annotations

import subprocess
from pathlib import Path


def stderr_tail(text: str | bytes | None, lines: int = 20) -> str:
    if isinstance(text, bytes):
        text = text.decode("utf-8", "replace")
    parts = [ln for ln in (text or "").strip().splitlines() if ln.strip()]
    return "\n".join(parts[-lines:])


def probe_video_nb_frames(video: Path) -> int:
    out = subprocess.run(
        [
            "ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0",
            "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", str(video),
        ],
        capture_output=True,
        text=True,
    )
    if out.returncode != 0:
        return 0
    s = (out.stdout or "").strip()
    return int(s) if s.isdigit() else 0


def run_ffmpeg(cmd: list[str]) -> None:
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        tail = stderr_tail(proc.stderr or proc.stdout or "")
        raise subprocess.CalledProcessError(
            proc.returncode,
            cmd,
            output=proc.stdout,
            stderr=tail or f"ffmpeg exited {proc.returncode}",
        )


def format_subprocess_error(exc: BaseException, tail_lines: int = 20) -> str:
    if isinstance(exc, subprocess.CalledProcessError):
        err = (exc.stderr or exc.stdout or str(exc)).strip()
        tail = stderr_tail(err, tail_lines)
        cmd = exc.cmd[0] if exc.cmd else "command"
        return f"{cmd} failed:\n{tail}"[:4000]
    return str(exc)[:4000]
