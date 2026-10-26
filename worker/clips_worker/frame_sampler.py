"""Sample JPEG frames from a clip video for thumbnail vision."""
from __future__ import annotations

import subprocess
from pathlib import Path


def sample_frames(
    video: Path,
    out_dir: Path,
    *,
    duration_s: float,
    interval_s: float = 2.0,
    min_frames: int = 20,
    max_frames: int = 45,
) -> list[dict]:
    out_dir.mkdir(parents=True, exist_ok=True)
    fps = 1.0 / interval_s
    if duration_s < min_frames * interval_s:
        fps = min(max_frames / max(duration_s, 0.1), 1.0)
    pattern = out_dir / "frame_%04d.jpg"
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(video),
            "-vf",
            f"fps={fps:.4f},scale=512:-2",
            "-q:v",
            "3",
            str(pattern),
        ],
    )
    frames = sorted(out_dir.glob("frame_*.jpg"))
    if len(frames) > max_frames:
        step = max(1, len(frames) // max_frames)
        frames = frames[::step][:max_frames]
    if len(frames) < min_frames and duration_s >= min_frames * 0.5:
        raise RuntimeError(f"expected at least {min_frames} frames, got {len(frames)}")
    out: list[dict] = []
    for i, path in enumerate(frames):
        out.append({"index": i, "path": path, "jpeg": path.read_bytes()})
    return out
