"""YouTube long-form export helpers, never called for ordinary clip renders.

A 70-minute YouTube episode must not run through the generic F15 full-file
H.264 re-encode after the compositor and insert splicer have completed.
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

from clips_worker.export_duration_guard import probe_stream_durations


def correct_youtube_episode_overrun(
    source: Path,
    output: Path,
    expected_ms: int,
    *,
    tolerance_ms: int = 300,
) -> tuple[Path, dict[str, float]]:
    """Fast stream-copy end trim; leave an in-tolerance MP4 untouched.

    Copying video and AAC packets can retain up to a codec packet of padding,
    but avoids re-encoding a multi-hour stream with no observable progress.
    The outcome and any remaining tolerance are logged for operator QA.
    """
    if expected_ms <= 0:
        return source, {}
    lengths = probe_stream_durations(source)
    requested = expected_ms / 1000.0
    observed = max(lengths.values(), default=0)
    if observed <= requested + tolerance_ms / 1000.0:
        return source, lengths
    cmd = [
        "ffmpeg", "-y", "-v", "error",
        "-i", str(source), "-t", f"{requested:.6f}",
        "-map", "0:v:0", "-map", "0:a?",
        "-c", "copy", "-movflags", "+faststart", str(output),
    ]
    subprocess.run(cmd, check=True)
    after = probe_stream_durations(output)
    print("[youtube-video:render] " + json.dumps({
        "event": "fast_duration_trim", "expected_s": requested,
        "before_s": observed, "after_s": max(after.values(), default=0),
        "method": "stream_copy", "codec_reencode": False,
    }), flush=True)
    return output, after
