"""Generate real clip-card posters without invoking the paid AI thumbnail flow."""
from __future__ import annotations

import json
import subprocess
import tempfile
import time
from pathlib import Path

from psycopg2.extras import RealDictCursor

from clips_worker.clip_source_media import resolve_clip_export_source
from clips_worker.storage import download_object, upload_file

_ASPECT_SIZE = {
    "9:16": (360, 640),
    "16:9": (640, 360),
    "4:5": (480, 600),
    "1:1": (512, 512),
}


def _obj(value) -> dict:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}
    return {}


def run_card_thumbnail_job(conn, job: dict) -> None:
    started = time.perf_counter()
    payload = _obj(job.get("payload"))
    clip_id = str(job.get("clipId") or payload.get("clipId") or "")
    if not clip_id:
        raise RuntimeError("card_thumbnail_missing_clip_id")
    print(f"[clips:cards] thumbnail generate begin clipId={clip_id}", flush=True)

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT c.id, c."projectId", c."workspaceId", c."startMs", c."endMs",
                   c."posterKey", c."previewKey", c."sourceSegKey",
                   c."sourceSegStartMs", c."sourceSegEndMs", c.edits,
                   p.settings, p."proxyKey", u.key AS source_key
            FROM clips c
            JOIN clip_projects p ON p.id = c."projectId"
            LEFT JOIN clip_uploads u ON u.id = p."uploadId"
            WHERE c.id = %s AND c."deletedAt" IS NULL
            """,
            (clip_id,),
        )
        row = cur.fetchone()
    if not row:
        raise RuntimeError("card_thumbnail_clip_missing")

    ctx = dict(row)
    if ctx.get("posterKey"):
        print(
            f"[clips:cards] thumbnail generate end clipId={clip_id} status=exists "
            f"elapsedMs={round((time.perf_counter() - started) * 1000)}",
            flush=True,
        )
        return

    edits = _obj(ctx.get("edits"))
    settings = _obj(ctx.get("settings"))
    aspect = str(payload.get("aspect") or edits.get("aspectRatio") or settings.get("aspectRatio") or "9:16")
    if aspect not in _ASPECT_SIZE:
        aspect = "9:16"
    width, height = _ASPECT_SIZE[aspect]

    with tempfile.TemporaryDirectory() as td:
        work = Path(td)
        src = work / "source.mp4"
        source_offset_ms = 0
        source_reason = ""

        preview_key = ctx.get("previewKey")
        if preview_key:
            try:
                print(f"[clips:cards] thumbnail generate step=download_preview clipId={clip_id}", flush=True)
                download_object(str(preview_key), src)
                source_offset_ms = int(ctx.get("startMs") or 0)
                source_reason = "preview"
            except Exception:
                src.unlink(missing_ok=True)

        if not src.exists():
            source_key, source_offset_ms, source_reason = resolve_clip_export_source({**ctx, "clipId": clip_id})
            if not source_key:
                raise RuntimeError("card_thumbnail_source_missing")
            print(
                f"[clips:cards] thumbnail generate step=download_source clipId={clip_id} source={source_reason}",
                flush=True,
            )
            download_object(source_key, src)

        seek_ms = max(0, int(ctx.get("startMs") or 0) - int(source_offset_ms or 0))
        poster = work / "poster.jpg"
        print(
            f"[clips:cards] thumbnail generate step=extract_frame clipId={clip_id} aspect={aspect} seekMs={seek_ms}",
            flush=True,
        )
        subprocess.check_call(
            [
                "ffmpeg", "-y", "-v", "error",
                "-ss", f"{seek_ms / 1000.0:.3f}", "-i", str(src),
                "-vf", f"scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height}",
                "-frames:v", "1", "-q:v", "3", str(poster),
            ]
        )

        poster_key = f"ws/{ctx['workspaceId']}/projects/{ctx['projectId']}/clips/{clip_id}/poster.jpg"
        print(f"[clips:cards] thumbnail generate step=upload clipId={clip_id}", flush=True)
        upload_file(poster_key, poster, "image/jpeg")
        print(f"[clips:cards] thumbnail generate step=persist clipId={clip_id}", flush=True)
        with conn.cursor() as cur:
            cur.execute(
                'UPDATE clips SET "posterKey"=%s, "updatedAt"=NOW() WHERE id=%s AND "deletedAt" IS NULL',
                (poster_key, clip_id),
            )
        conn.commit()

    print(
        f"[clips:cards] thumbnail generate end clipId={clip_id} status=ready "
        f"elapsedMs={round((time.perf_counter() - started) * 1000)}",
        flush=True,
    )
