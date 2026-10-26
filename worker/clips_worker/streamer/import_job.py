"""STREAM_IMPORT: download Twitch/Kick VOD or clip, then enqueue PROCESS_PROJECT."""
from __future__ import annotations

import json
import shutil
import tempfile
import uuid
from pathlib import Path

from clips_worker.heartbeat import Heartbeat
from clips_worker.import_url import probe_video, upload_source_key
from clips_worker.probe import probe_duration
from clips_worker.storage import upload_file
from clips_worker.streamer.ytdlp import download_video, metadata, parse_metadata


MAX_DURATION_S = 3 * 3600
SCRATCH = Path("/tmp/streamer")


def _section_from_range(start_ms: int, end_ms: int | None) -> str | None:
    if not start_ms and not end_ms:
        return None
    start_s = max(0, start_ms) / 1000.0
    end_s = (end_ms or 0) / 1000.0
    if end_s <= start_s:
        return None
    return f"*{start_s}-{end_s}"


def run_stream_import_job(conn, job: dict, post_progress) -> None:
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    vod_id = payload.get("vodId")
    if not vod_id:
        raise RuntimeError("missing vodId")

    from psycopg2.extras import RealDictCursor

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT v.*, p."workspaceId", p.settings, p.id AS project_id
            FROM stream_vods v
            JOIN clip_projects p ON p.id = v."projectId"
            WHERE v.id = %s
            """,
            (vod_id,),
        )
        vod = dict(cur.fetchone())

    url = vod.get("url")
    if not url:
        raise RuntimeError("missing stream url")

    workspace_id = vod["workspaceId"]
    project_id = vod["project_id"]
    SCRATCH.mkdir(parents=True, exist_ok=True)

    with Heartbeat(job["id"], post_progress, every_s=45) as hb:
        hb.update(stage="Downloading", progress=5)
        post_progress(
            job["id"],
            {"projectStatus": "PREPARING", "stage": "Downloading", "progress": 5, "jobStatus": "RUNNING"},
        )
        meta_raw = metadata(url)
        meta = parse_metadata(meta_raw)
        dur_s = meta["duration_s"] or 0
        if dur_s > MAX_DURATION_S:
            raise RuntimeError("Video exceeds 3 hour limit (use a shorter range)")
        usage = shutil.disk_usage(SCRATCH)
        est = int(dur_s * 2_000_000)  # rough 2MB/s
        if usage.free < est * 2:
            raise RuntimeError("Not enough scratch disk for this download")

        section = _section_from_range(int(vod.get("rangeStartMs") or 0), vod.get("rangeEndMs"))

        def on_pct(pct: float) -> None:
            prog = 5 + int(min(20, pct * 0.2))
            hb.update(stage="Downloading", progress=prog)
            post_progress(
                job["id"],
                {"projectStatus": "PREPARING", "stage": "Downloading", "progress": prog, "jobStatus": "RUNNING"},
            )

        with tempfile.TemporaryDirectory(dir=SCRATCH) as td:
            dest = str(Path(td) / "source.mp4")

            def _dl():
                download_video(url, dest, section=section, progress_cb=on_pct)

            _dl()
            path = Path(dest)
            dur_s, width, height = probe_video(path)
            duration_ms = int(round(dur_s * 1000))
            size = path.stat().st_size

            upload_id = f"upl_{uuid.uuid4().hex}"
            key = upload_source_key(workspace_id, upload_id, "mp4")
            upload_file(key, path, "video/mp4")

            kind = vod.get("sourceType") or "vod"
            proc_payload = {"singleClip": True} if kind == "clip" else {}

            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO clip_uploads (id, "workspaceId", key, filename, bytes, mime, "durationMs", width, height, status, "createdAt")
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,'COMPLETE',NOW())
                    """,
                    (upload_id, workspace_id, key, "stream.mp4", size, "video/mp4", duration_ms, width, height),
                )
                cur.execute(
                    """
                    UPDATE clip_projects
                    SET "uploadId"=%s, title=COALESCE(%s, title), "rangeEndMs"=GREATEST("rangeEndMs", %s),
                        stage='queued', progress=5, "updatedAt"=NOW()
                    WHERE id=%s
                    """,
                    (upload_id, meta.get("title"), duration_ms, project_id),
                )
                cur.execute(
                    """
                    UPDATE stream_vods SET title=%s, category=%s, durationMs=%s, chapters=%s::jsonb, "updatedAt"=NOW()
                    WHERE id=%s
                    """,
                    (
                        meta.get("title"),
                        meta.get("category"),
                        duration_ms,
                        json.dumps(meta.get("chapters")) if meta.get("chapters") else None,
                        vod_id,
                    ),
                )
                proc_id = f"job_{uuid.uuid4().hex}"
                cur.execute(
                    """
                    INSERT INTO clip_jobs (id, "projectId", type, status, payload, priority, "createdAt")
                    VALUES (%s,%s,'PROCESS_PROJECT','QUEUED',%s::jsonb,10,NOW())
                    """,
                    (proc_id, project_id, json.dumps(proc_payload)),
                )
            conn.commit()

    post_progress(
        job["id"],
        {"projectStatus": "QUEUED", "stage": "queued", "progress": 25, "jobStatus": "DONE"},
    )
