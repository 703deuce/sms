"""G1b3: blank project — an editor with no source video (CapCut "New project").

The web creates a PENDING clip_uploads row + a full-video project (settings.blank) + a PROCESS_PROJECT
job with payload.blank. Here the worker makes a black, silent canvas file for that upload key, marks
the upload COMPLETE and finalizes the BYO / full-video clip with NO transcription (no words, no ASR,
no credits). The user then adds media from the Media panel (inserts / Video-lane segments / B-roll)
and extends the trim. Filters: lavfi color + anullsrc, libx264 (ffmpeg 5.1 ok).
"""
from __future__ import annotations

import subprocess
from pathlib import Path

BLANK_DEFAULT_MS = 10_000
BLANK_MIN_MS = 10_000
BLANK_MAX_MS = 60 * 60 * 1000
BLANK_INITIAL_TRIM_MS = 10_000
_SIZES = {"9:16": (720, 1280), "16:9": (1280, 720), "1:1": (720, 720), "4:5": (720, 900)}


def blank_size(aspect: str | None) -> tuple[int, int]:
    return _SIZES.get(str(aspect or ""), _SIZES["9:16"])


def blank_duration_ms(raw) -> int:
    try:
        v = int(raw)
    except (TypeError, ValueError):
        v = BLANK_DEFAULT_MS
    return max(BLANK_MIN_MS, min(BLANK_MAX_MS, v))


def make_blank_video(dest: Path, aspect: str | None, dur_ms: int) -> tuple[int, int]:
    w, h = blank_size(aspect)
    d = dur_ms / 1000.0
    subprocess.check_call(
        [
            "ffmpeg", "-y", "-v", "error",
            "-f", "lavfi", "-i", f"color=c=black:s={w}x{h}:r=30:d={d:.3f}",
            "-f", "lavfi", "-i", f"anullsrc=r=48000:cl=stereo:d={d:.3f}",
            "-shortest", "-c:v", "libx264", "-preset", "ultrafast", "-tune", "stillimage", "-crf", "35",
            "-g", "30", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "32k", "-movflags", "+faststart", str(dest),
        ]
    )
    return w, h


def template_carrier_frames(raw) -> int:
    """Exact authored 30fps frame budget. Unlike ordinary blank projects this is never duration-clamped."""
    try:
        frames = int(raw)
    except (TypeError, ValueError):
        raise ValueError("template carrier requires an exact frame count")
    if frames < 3 or frames > 30 * 60 * 30:
        raise ValueError("template carrier frame budget is out of range")
    return frames


def make_template_carrier(dest: Path, aspect: str | None, frames: int) -> tuple[int, int]:
    """Neutral black/silent carrier with an exact 30fps frame count."""
    w, h = blank_size(aspect)
    d = frames / 30.0
    subprocess.check_call(
        [
            "ffmpeg", "-y", "-v", "error",
            "-f", "lavfi", "-i", f"color=c=black:s={w}x{h}:r=30",
            "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
            "-frames:v", str(frames), "-t", f"{d:.9f}",
            "-c:v", "libx264", "-preset", "ultrafast", "-tune", "stillimage", "-crf", "35",
            "-g", "30", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "32k",
            "-movflags", "+faststart", str(dest),
        ]
    )
    return w, h


def prepare_blank_source(conn, project: dict, payload: dict, dest: Path) -> Path:
    """Generate + upload the canvas to the project's upload key; mark the upload COMPLETE."""
    from clips_worker.probe import probe_duration
    from clips_worker.storage import upload_file

    settings = project.get("settings") or {}
    if isinstance(settings, str):
        import json

        settings = json.loads(settings)
    if payload.get("templateCarrier") is True:
        frames = template_carrier_frames(payload.get("templateCarrierFrames"))
        w, h = make_template_carrier(dest, settings.get("aspectRatio"), frames)
    else:
        dur = blank_duration_ms(payload.get("blankMs"))
        w, h = make_blank_video(dest, settings.get("aspectRatio"), dur)
    upload_file(project["source_key"], dest, "video/mp4")
    real_ms = int(round(probe_duration(dest) * 1000))
    with conn.cursor() as cur:
        cur.execute(
            'UPDATE clip_uploads SET status=%s, bytes=%s, "durationMs"=%s, width=%s, height=%s WHERE id=%s',
            ("COMPLETE", dest.stat().st_size, real_ms, w, h, project["uploadId"]),
        )
    conn.commit()
    print(f"[clipper:blank] project={project['id']} canvas={w}x{h} ms={real_ms}", flush=True)
    return dest


def is_blank_job(settings: dict | None, payload: dict | None) -> bool:
    return bool((payload or {}).get("blank") is True or (isinstance(settings, dict) and settings.get("blank") is True))
