"""Media duration via ffprobe."""
from __future__ import annotations

import subprocess
from pathlib import Path


def probe_duration(path: str | Path) -> float:
    p = str(path)
    try:
        out = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                p,
            ],
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
        return float(out)
    except subprocess.CalledProcessError as exc:
        err = (exc.stderr or exc.stdout or str(exc)).strip()
        raise RuntimeError(f"ffprobe failed: {err[:500]}") from exc


def format_subprocess_error(exc: BaseException) -> str:
    if isinstance(exc, subprocess.CalledProcessError):
        err = (exc.stderr or exc.stdout or str(exc)).strip()
        return f"{exc.cmd[0] if exc.cmd else 'command'} failed: {err[:500]}"
    return str(exc)
