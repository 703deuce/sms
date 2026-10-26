"""Per-second loudness signal from audio (ebur128 momentary when available)."""
from __future__ import annotations

import re
import subprocess
from pathlib import Path


def _parse_ebur128_momentary(stderr: str) -> list[float]:
    """Parse ffmpeg ebur128 momentary loudness (M) values in dB."""
    vals: list[float] = []
    for line in stderr.splitlines():
        m = re.search(r"M:\s*(-?\d+(?:\.\d+)?)", line)
        if m:
            vals.append(float(m.group(1)))
    return vals


def audio_signal_per_second(audio_path: Path, duration_s: int) -> list[float]:
    if duration_s <= 0:
        return []
    proc = subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-i",
            str(audio_path),
            "-af",
            "ebur128=peak=true",
            "-f",
            "null",
            "-",
        ],
        capture_output=True,
        text=True,
    )
    momentary = _parse_ebur128_momentary(proc.stderr or "")
    if not momentary:
        return [0.0] * duration_s
    # ~10 samples/s → bucket into 1 Hz
    per_s: list[float] = []
    bucket = max(1, len(momentary) // max(1, duration_s))
    for sec in range(duration_s):
        lo = sec * bucket
        hi = min(len(momentary), (sec + 1) * bucket)
        chunk = momentary[lo:hi] or momentary[-1:]
        per_s.append(max(chunk))
    # robust z over 120s window, clip [0,6]/6
    out: list[float] = []
    for i, m in enumerate(per_s):
        lo = max(0, i - 60)
        hi = min(len(per_s), i + 61)
        window = per_s[lo:hi]
        med = sorted(window)[len(window) // 2]
        mad = sorted(abs(x - med) for x in window)[len(window) // 2] or 1.0
        z = (m - med) / (1.4826 * mad)
        z = max(0.0, min(6.0, z))
        out.append(z / 6.0)
    return out
