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
from clips_worker.user_errors import (
    BYO_DURATION_MESSAGE,
    BYO_MAX_DURATION_MS,
    FULL_VIDEO_DURATION_MESSAGE,
    FULL_VIDEO_MAX_DURATION_MS,
    ClipUserError,
)

_ASPECTS = {"9:16": 9 / 16, "4:5": 4 / 5, "1:1": 1.0, "16:9": 16 / 9}


def is_full_video(settings: dict | None, job: dict | None = None) -> bool:
    """FV1: settings.fullVideo (or the job payload flag) marks an "Edit a full video" project."""
    if isinstance(settings, dict) and settings.get("fullVideo") is True:
        return True
    payload = (job or {}).get("payload") or {}
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except Exception:
            payload = {}
    return isinstance(payload, dict) and payload.get("fullVideo") is True


def source_aspect_ratio(w: int, h: int) -> str:
    """Nearest supported canvas for the source frame (mirrors lib/clips/full-video.ts)."""
    import math

    if w <= 0 or h <= 0:
        return "16:9"
    r = math.log(w / h)
    return min(_ASPECTS, key=lambda a: abs(math.log(_ASPECTS[a]) - r))


def full_video_initial_edits(edits: dict, settings: dict, w: int, h: int) -> dict:
    """FV1 defaults: canvas = chosen aspect (client sends the source's), full frame when the
    canvas matches the source shape, no headline / platform badge (those are shorts overlays)."""
    out = dict(edits)
    aspect = str(settings.get("aspectRatio") or "") or source_aspect_ratio(w, h)
    if aspect not in _ASPECTS:
        aspect = source_aspect_ratio(w, h)
    out["aspectRatio"] = aspect
    layout = dict(out.get("layout") or {})
    if source_aspect_ratio(w, h) == aspect:
        layout["mode"] = "full_frame"
    else:
        layout["mode"] = "center_crop" if h > w else "fit_blur"
    out["layout"] = layout
    tpl = dict(out.get("exportTemplate") or {})
    tpl["headlineBar"] = {**dict(tpl.get("headlineBar") or {}), "enabled": False}
    tpl["platformBadge"] = {"enabled": False}
    out["exportTemplate"] = tpl
    return out


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


def _build_full_video_assets(src: Path, workspace_id: str, project_id: str, dur_ms: int, w: int, h: int) -> dict:
    """FV2: peaks + filmstrip for full-video projects only (never for clips)."""
    try:
        from clips_worker.full_video_assets import build_pre_ready_assets

        return build_pre_ready_assets(src, workspace_id, project_id, dur_ms, w, h, upload_file)
    except Exception as exc:
        print(f"[clipper:fullvideo] assets_skip err={type(exc).__name__}", flush=True)
        return {}


def _start_full_video_proxy(src: Path, workspace_id: str, project_id: str, dur_ms: int) -> None:
    """FV2: after READY, the 720p playback proxy (skipped when the source is already light)."""
    try:
        from clips_worker.full_video_assets import build_and_attach_proxy

        build_and_attach_proxy(src, workspace_id, project_id, dur_ms, upload_file)
    except Exception as exc:
        print(f"[clipper:fullvideo] proxy_skip err={type(exc).__name__}", flush=True)


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

    full = is_full_video(settings, job)
    try:
        dur_ms = int(round(probe_duration(src) * 1000))
        if full:
            if dur_ms > FULL_VIDEO_MAX_DURATION_MS:
                raise ClipUserError(FULL_VIDEO_DURATION_MESSAGE)
        elif dur_ms > BYO_MAX_DURATION_MS:
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
        editor_assets: dict = {}
        if full:
            edits = full_video_initial_edits(edits, settings, w, h)
            post_progress(
                job_id,
                {"projectStatus": "TRANSCRIBING", "stage": "transcribing", "progress": 70, "jobStatus": "RUNNING"},
            )
            editor_assets = _build_full_video_assets(src, workspace_id, project_id, dur_ms, w, h)

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
            "aiMeta": (
                {"byo": True, "fullVideo": True, **({"editorAssets": editor_assets} if editor_assets else {})}
                if full
                else {"byo": True}
            ),
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
            f"[clipper:byo] done project={project_id} clip={clip_id} dur_ms={dur_ms} words={len(words)}"
            f" full={int(full)}",
            flush=True,
        )
        if full:
            _start_full_video_proxy(src, workspace_id, project_id, dur_ms)
    except ClipUserError:
        raise
    except Exception as exc:
        print(f"[clipper:byo] fail err={type(exc).__name__}", flush=True)
        raise
