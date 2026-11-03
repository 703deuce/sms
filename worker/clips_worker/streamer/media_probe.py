"""FIX1 (B.4d): measure stream start offsets instead of trusting requested times."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path


def _stream_start_s(path: str | Path, selector: str) -> float | None:
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", selector, "-show_entries", "stream=start_time",
             "-of", "json", str(path)],
            capture_output=True, text=True, timeout=30,
        ).stdout
        streams = json.loads(out or "{}").get("streams") or []
        vals = [float(s["start_time"]) for s in streams if s.get("start_time") not in (None, "N/A")]
        return min(vals) if vals else None
    except Exception:
        return None


def audio_lead_ms(path: str | Path) -> int:
    """ms by which the first audio packet starts after the first video packet (0 if unknown or negative)."""
    a = _stream_start_s(path, "a:0")
    v = _stream_start_s(path, "v:0")
    if a is None or v is None:
        return 0
    return max(0, int(round((a - v) * 1000)))
