"""STREAM_IMPORT: metadata, short full-download or long audio-first path."""
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
from clips_worker.streamer.config import FULL_DOWNLOAD_MAX_MIN, MAX_VOD_HOURS, SCRATCH
from clips_worker.streamer.keys import stream_audio_key
from clips_worker.streamer.usage import check_cap, job_priority
from clips_worker.streamer.ytdlp import download_audio, download_video, metadata, parse_metadata


def _section_from_range(start_ms: int, end_ms: int | None) -> str | None:
    if not start_ms and not end_ms:
        return None
    start_s = max(0, start_ms) / 1000.0
    end_s = (end_ms or 0) / 1000.0
    if end_s <= start_s:
        return None
    return f"*{start_s}-{end_s}"


def _effective_duration_ms(vod: dict, meta_dur_s: float) -> int:
    start = int(vod.get("rangeStartMs") or 0)
    end = vod.get("rangeEndMs")
    if end:
        return max(0, int(end) - start)
    return int(meta_dur_s * 1000)


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
        effective_ms = _effective_duration_ms(vod, dur_s)
        max_s = MAX_VOD_HOURS * 3600
        if effective_ms > max_s * 1000:
            raise RuntimeError(f"VOD is longer than {MAX_VOD_HOURS} h; pick a range.")
        cap_err = check_cap(conn, workspace_id, effective_ms // 1000)
        if cap_err:
            raise RuntimeError(cap_err)

        kind = vod.get("sourceType") or "vod"
        use_long = (
            kind not in ("clip", "upload")
            and effective_ms > FULL_DOWNLOAD_MAX_MIN * 60 * 1000
        )

        section = _section_from_range(int(vod.get("rangeStartMs") or 0), vod.get("rangeEndMs"))

        if use_long:
            post_progress(
                job["id"],
                {
                    "projectStatus": "PREPARING",
                    "stage": "Downloading audio",
                    "progress": 8,
                    "jobStatus": "RUNNING",
                },
            )

            def on_pct(pct: float) -> None:
                prog = 8 + int(min(12, pct * 0.12))
                hb.update(stage="Downloading audio", progress=prog)
                post_progress(
                    job["id"],
                    {
                        "projectStatus": "PREPARING",
                        "stage": "Downloading audio",
                        "progress": prog,
                        "jobStatus": "RUNNING",
                    },
                )

            with tempfile.TemporaryDirectory(dir=SCRATCH) as td:
                audio_out = str(Path(td) / "audio.%(ext)s")
                download_audio(url, audio_out, section=section, progress_cb=on_pct)
                audio_path = next(Path(td).glob("audio.*"))
                duration_ms = effective_ms or int(dur_s * 1000)
                audio_key = stream_audio_key(workspace_id, vod_id)
                upload_file(audio_key, audio_path, "audio/opus")
                state = {"audioKey": audio_key}
                pri = job_priority(conn, vod.get("triggeredBy") or "paste")
                analyze_id = f"job_{uuid.uuid4().hex}"
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        UPDATE clip_projects
                        SET title=COALESCE(%s, title), stage='Downloading audio', progress=20, "updatedAt"=NOW()
                        WHERE id=%s
                        """,
                        (meta.get("title"), project_id),
                    )
                    cur.execute(
                        """
                        UPDATE stream_vods
                        SET title=%s, category=%s, durationMs=%s, chapters=%s::jsonb, state=%s::jsonb, "updatedAt"=NOW()
                        WHERE id=%s
                        """,
                        (
                            meta.get("title"),
                            meta.get("category"),
                            duration_ms,
                            json.dumps(meta.get("chapters")) if meta.get("chapters") else None,
                            json.dumps(state),
                            vod_id,
                        ),
                    )
                    cur.execute(
                        """
                        INSERT INTO clip_jobs (id, "projectId", type, status, payload, priority, "createdAt")
                        VALUES (%s,%s,'STREAM_ANALYZE','QUEUED',%s::jsonb,%s,NOW())
                        """,
                        (analyze_id, project_id, json.dumps({"vodId": vod_id}), pri),
                    )
                conn.commit()
            post_progress(
                job["id"],
                {"projectStatus": "QUEUED", "stage": "queued", "progress": 25, "jobStatus": "DONE"},
            )
            return

        usage = shutil.disk_usage(SCRATCH)
        est = int(dur_s * 2_000_000)
        if usage.free < est * 2:
            raise RuntimeError("Not enough scratch disk for this download")

        def on_pct(pct: float) -> None:
            prog = 5 + int(min(20, pct * 0.2))
            hb.update(stage="Downloading", progress=prog)
            post_progress(
                job["id"],
                {"projectStatus": "PREPARING", "stage": "Downloading", "progress": prog, "jobStatus": "RUNNING"},
            )

        with tempfile.TemporaryDirectory(dir=SCRATCH) as td:
            dest = str(Path(td) / "source.mp4")

            download_video(url, dest, section=section, progress_cb=on_pct)
            path = Path(dest)
            dur_s, width, height = probe_video(path)
            duration_ms = int(round(dur_s * 1000))
            size = path.stat().st_size

            upload_id = f"upl_{uuid.uuid4().hex}"
            key = upload_source_key(workspace_id, upload_id, "mp4")
            upload_file(key, path, "video/mp4")

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
