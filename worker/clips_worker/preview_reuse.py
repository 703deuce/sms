"""When RENDER_CLIP may copy preview.mp4 instead of re-encoding."""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from clips_worker.preview_edits_match import preview_export_matches
from clips_worker.storage import download_object

CLIP_PREVIEW_ASPECT = "9:16"
CLIP_PREVIEW_RESOLUTION = "720p"


def can_reuse_clip_preview_for_render(
    aspect: str,
    resolution: str,
    edits: dict,
    clip_start_ms: int,
    clip_end_ms: int,
) -> bool:
    return (
        aspect == CLIP_PREVIEW_ASPECT
        and resolution == CLIP_PREVIEW_RESOLUTION
        and preview_export_matches(edits, clip_start_ms, clip_end_ms)
    )


def export_edits_allow_preview_reuse(
    aspect: str,
    edits: dict,
    clip_start_ms: int,
    clip_end_ms: int,
) -> bool:
    return aspect == CLIP_PREVIEW_ASPECT and preview_export_matches(edits, clip_start_ms, clip_end_ms)


def materialize_export_from_preview(
    preview_key: str,
    resolution: str,
    dest_mp4: Path,
    work_dir: Path,
) -> None:
    """Copy or locally scale clip preview.mp4 for export (no speakercrop/Modal)."""
    from clips_worker.render_clip import aspect_size

    preview_mp4 = work_dir / "_preview_src.mp4"
    download_object(preview_key, preview_mp4)
    if resolution in (CLIP_PREVIEW_RESOLUTION, 720, "720"):
        shutil.copy(preview_mp4, dest_mp4)
        return
    if resolution in (1080, "1080"):
        resolution = "1080p"
    w, h = aspect_size(CLIP_PREVIEW_ASPECT, resolution)
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(preview_mp4),
            "-vf",
            f"scale={w}:{h}:flags=lanczos",
            "-c:v",
            "libx264",
            "-crf",
            "20",
            "-preset",
            "veryfast",
            "-c:a",
            "aac",
            "-movflags",
            "+faststart",
            str(dest_mp4),
        ],
        check=True,
    )
