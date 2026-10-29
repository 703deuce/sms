"""Finalize bring-your-own (BYO) projects: one clip after transcription, no M4 pipeline."""
from __future__ import annotations

import json
import subprocess
import uuid
from pathlib import Path
from typing import Callable

from clips_worker.pipeline import clip_keys, initial_clip_edits, insert_clips_batch, mark_project_ready
from clips_worker.probe import probe_duration
from clips_worker.storage import upload_file
from clips_worker.user_errors import BYO_DURATION_MESSAGE, BYO_MAX_DURATION_MS, ClipUserError


def _probe_video_wh(path: Path) -> tuple[int, int]:
    try:
        out = subprocess.check_output(
            [
                "ffprobe",
                "-v",
                "error",
                "-select_streams",
                "v:0",
                "-show_entries",
                "stream=width,height",
                "-of",
                "json",
                str(path),
            ],
            text=True,
        )
        streams = json.loads(out).get("streams") or []
        if streams:
            w = int(streams[0].get("width") or 0)
            h = int(streams[0].get("height") or 0)
            if w > 0 and h > 0:
                return w, h
    except Exception:
        pass
    return 1920, 1080


def _poster_frame_jpg(src: Path, out: Path, dur_s: float) -> None:
    t = min(1.0, max(0.0, dur_s / 2.0))
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-ss",
            f"{t:.3f}",
            "-i",
            str(src),
            "-frames:v",
            "1",
            "-q:v",
            "3",
            str(out),
        ],
        check=True,
        capture_output=True,
    )


def finalize_byo_clip(
    conn,
    job: dict,
    project: dict,
    words: list[dict],
    src: Path,
    post_progress: Callable[[str, dict], None],
) -> None:
    job_id = str(job["id"])
    project_id = str(project["id"])
    workspace_id = str(project["workspaceId"])
    settings = project.get("settings") or {}
    if isinstance(settings, str):
        settings = json.loads(settings)

    try:
        dur_ms = int(round(probe_duration(src) * 1000))
        if dur_ms > BYO_MAX_DURATION_MS:
            raise ClipUserError(BYO_DURATION_MESSAGE)

        clip_id = f"clip_{uuid.uuid4().hex}"

        try:
            edits = initial_clip_edits(settings)
        except Exception:
            print("[clipper:byo] edits_fallback", flush=True)
            edits = {}
        edits = dict(edits)
        edits["v"] = 2
        edits["trim"] = {"in": 0, "out": dur_ms}
        edits["cutRanges"] = []
        w, h = _probe_video_wh(src)
        layout = dict(edits.get("layout") or {})
        layout["mode"] = "center_crop" if h > w else "fit_blur"
        edits["layout"] = layout

        poster_key = None
        keys = clip_keys(workspace_id, project_id, clip_id)
        try:
            poster_path = src.parent / f"{clip_id}_poster.jpg"
            _poster_frame_jpg(src, poster_path, dur_ms / 1000.0)
            upload_file(keys["poster"], poster_path, "image/jpeg")
            poster_key = keys["poster"]
        except Exception:
            print("[clipper:byo] poster_skip", flush=True)

        title = str(project.get("title") or "Clip")[:200]
        row = {
            "id": clip_id,
            "projectId": project_id,
            "workspaceId": workspace_id,
            "title": title,
            "reason": "user_upload",
            "startMs": 0,
            "endMs": dur_ms,
            "segmentKey": None,
            "score": 0,
            "scores": {},
            "previewKey": None,
            "posterKey": poster_key,
            "wordsKey": None,
            "cropKey": None,
            "edits": edits,
            "aiMeta": {"byo": True},
        }
        insert_clips_batch(conn, [row])
        mark_project_ready(conn, project_id)
        post_progress(
            job_id,
            {
                "projectStatus": "READY",
                "stage": "ready",
                "progress": 100,
                "jobStatus": "DONE",
                "error": None,
            },
        )
        print(
            f"[clipper:byo] done project={project_id} clip={clip_id} dur_ms={dur_ms} words={len(words)}",
            flush=True,
        )
    except ClipUserError:
        raise
    except Exception as exc:
        print(f"[clipper:byo] fail err={type(exc).__name__}", flush=True)
        raise
