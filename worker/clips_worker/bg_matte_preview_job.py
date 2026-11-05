"""Editor E2: generate a real six-second matte sample before a full export.

This is queued as BG_MATTE_PREVIEW and uses the same GPU matting pipeline and
workspace storage as export. Nothing in this job modifies clip edits or charges
end-user credits. A failed GPU/budget request is surfaced by the failed ClipJob.
"""
from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

from clips_worker.bg_matte_job import ensure_matte
from clips_worker.clip_source_media import resolve_clip_export_source
from clips_worker.storage import download_object


def run_bg_matte_preview_job(conn, job: dict, post_progress) -> None:
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    clip_id = str(payload.get("clipId") or job.get("clipId") or "")
    workspace_id = str(payload.get("workspaceId") or "")
    project_id = str(job.get("projectId") or "")
    quality = "detail" if payload.get("quality") == "detail" else "standard"
    preview_fingerprint = str(payload.get("previewFingerprint") or "")
    if not clip_id or not workspace_id or not project_id:
        raise RuntimeError("missing matte preview clip/workspace/project")

    with conn.cursor() as cur:
        cur.execute(
            """SELECT c."sourceSegKey", c."sourceSegStartMs", c."previewKey",
                      c."startMs", c."endMs", p."workspaceId", u.key
               FROM clips c
               JOIN clip_projects p ON p.id = c."projectId"
               LEFT JOIN clip_uploads u ON u.id = p."uploadId"
               WHERE c.id=%s AND c."projectId"=%s AND c."workspaceId"=%s""",
            (clip_id, project_id, workspace_id),
        )
        row = cur.fetchone()
    if not row or str(row[5]) != workspace_id:
        raise RuntimeError("clip not found for matte preview")
    ctx = {
        "sourceSegKey": row[0], "sourceSegStartMs": row[1],
        "previewKey": row[2], "startMs": row[3],
        "workspaceId": workspace_id, "projectId": project_id,
        "clipId": clip_id, "source_key": row[6],
    }
    source_key, source_offset_ms, _reason = resolve_clip_export_source(ctx)
    if not source_key:
        raise RuntimeError("source media missing for matte preview")
    duration_ms = max(0, int(row[4]) - int(row[3]))
    if duration_ms < 500:
        raise RuntimeError("clip is too short for matte preview")
    sample_ms = min(6000, duration_ms)
    # Preview the beginning of this clip, never the beginning of a larger upload.
    seek_s = max(0.0, (int(row[3]) - source_offset_ms) / 1000.0)
    post_progress(job["id"], {"jobStatus": "RUNNING", "stage": "matte_preview_source", "progress": 10})
    with tempfile.TemporaryDirectory(prefix="bg_matte_preview_") as tmp:
        work = Path(tmp)
        src = work / "source.mp4"
        snippet = work / "preview_source.mp4"
        download_object(source_key, src)
        subprocess.check_call([
            "ffmpeg", "-y", "-v", "error", "-ss", f"{seek_s:.3f}",
            "-i", str(src), "-t", f"{sample_ms / 1000:.3f}",
            "-vf", "scale='if(gte(iw,ih),640,-2)':'if(gt(ih,iw),640,-2)'",
            "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "24",
            "-pix_fmt", "yuv420p", str(snippet),
        ])
        post_progress(job["id"], {"jobStatus": "RUNNING", "stage": "matte_preview_gpu", "progress": 30})
        ensure_matte(
            conn, snippet, work, workspace_id=workspace_id, project_id=project_id,
            clip_id=clip_id, quality=quality, preview_fingerprint=preview_fingerprint,
            stage=lambda *_args, **_kw: None,
        )
    post_progress(job["id"], {"jobStatus": "RUNNING", "stage": "matte_preview_ready", "progress": 95})
