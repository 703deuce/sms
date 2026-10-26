"""Clips CPU worker: claim ClipJob rows, full M3–M4 pipeline."""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import subprocess
import sys
import tempfile
import time
import traceback
import urllib.parse
import urllib.request
from pathlib import Path

import psycopg2
from psycopg2.extras import RealDictCursor

from clips_worker.pipeline import run_m4_pipeline
from clips_worker.render_job import run_render_clip_job
from clips_worker.probe import format_subprocess_error, probe_duration
from clips_worker.storage import download_object

TRANSCRIBE = Path(os.environ.get("TRANSCRIBE_SCRIPT", "/app/transcribe.py"))
V3 = Path(os.environ.get("SPEAKERCROP_DIR", "/app/v3"))


def env(name: str, default: str | None = None) -> str:
    v = os.environ.get(name, default)
    if not v:
        raise RuntimeError(f"Missing env {name}")
    return v


def log(msg: str) -> None:
    print(msg, flush=True)


def db_host_label(dsn: str) -> str:
    try:
        parsed = urllib.parse.urlparse(dsn)
        host = parsed.hostname or "unknown"
        port = parsed.port or 5432
        db = (parsed.path or "").lstrip("/") or "postgres"
        return f"{host}:{port}/{db}"
    except Exception:
        return "unknown"


def log_models() -> None:
    yunet = V3 / "yunet.onnx"
    land = V3 / "face_landmarker.task"
    fonts = V3 / "fonts" / "Poppins-ExtraBold.ttf"
    log(
        f"models yunet={yunet.exists()} face_landmarker={land.exists()} "
        f"poppins={fonts.exists()} v3_dir={V3.is_dir()}"
    )


def log_picker_config() -> None:
    try:
        from clips_worker.picker.config import genres_config, load_core_rubric

        cfg = genres_config()
        genres = sorted((cfg.get("genres") or {}).keys())
        ui = sorted((cfg.get("ui_genre_map") or {}).keys())
        core_ok = bool(load_core_rubric())
        log(
            f"picker config loaded core_rubric={core_ok} playbook_genres={','.join(genres)} ui_genres={','.join(ui)}"
        )
    except Exception as exc:
        log(f"picker config load failed: {exc}")


def mark_generation_failed(conn, job: dict, message: str) -> None:
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    generation_id = payload.get("generationId")
    if generation_id:
        with conn.cursor() as cur:
            cur.execute(
                'UPDATE ai_generations SET status=%s, error=%s, "updatedAt"=NOW() WHERE id=%s',
                ("FAILED", message[:4000], generation_id),
            )
    with conn.cursor() as cur:
        cur.execute(
            'UPDATE clip_jobs SET status=%s, error=%s, "finishedAt"=NOW() WHERE id=%s',
            ("FAILED", message[:4000], job["id"]),
        )
    conn.commit()
    post_progress(job["id"], {"jobStatus": "FAILED", "error": message[:500]})


def count_queued_jobs(conn) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT count(*)::int FROM clip_jobs
            WHERE status = 'QUEUED' AND type IN ('IMPORT_URL', 'PROCESS_PROJECT', 'RENDER_CLIP', 'REFRAME_CROP', 'MUSIC', 'THUMBNAIL', 'DUB')
              AND "runAfter" <= (NOW() AT TIME ZONE 'UTC')
            """,
        )
        return int(cur.fetchone()[0])


def sign_body(secret: str, body: str) -> str:
    return hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()


def post_progress(job_id: str, payload: dict) -> None:
    app_url = env("APP_URL").rstrip("/")
    secret = env("WORKER_SHARED_SECRET")
    body = json.dumps(payload)
    req = urllib.request.Request(
        f"{app_url}/api/internal/jobs/{job_id}/progress",
        data=body.encode(),
        headers={"Content-Type": "application/json", "x-worker-signature": sign_body(secret, body)},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=300) as resp:
        resp.read()


def claim_job(conn) -> dict | None:
    worker_id = os.environ.get("WORKER_ID", "worker-1")
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            UPDATE clip_jobs
            SET status = 'RUNNING',
                "lockedBy" = %s,
                "lockedAt" = NOW(),
                attempts = attempts + 1
            WHERE id = (
              SELECT id FROM clip_jobs
              WHERE status = 'QUEUED'
                AND type IN ('IMPORT_URL', 'PROCESS_PROJECT', 'RENDER_CLIP', 'REFRAME_CROP', 'MUSIC', 'THUMBNAIL', 'DUB')
                AND "runAfter" <= (NOW() AT TIME ZONE 'UTC')
              ORDER BY priority DESC, "runAfter" ASC
              FOR UPDATE SKIP LOCKED
              LIMIT 1
            )
            RETURNING *
            """,
            (worker_id,),
        )
        row = cur.fetchone()
    conn.commit()
    return dict(row) if row else None


def load_project(conn, project_id: str) -> dict:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT p.*, u.key AS source_key, u.filename
            FROM clip_projects p
            LEFT JOIN clip_uploads u ON u.id = p."uploadId"
            WHERE p.id = %s
            """,
            (project_id,),
        )
        row = cur.fetchone()
    if not row:
        raise RuntimeError("project missing")
    return dict(row)


def process_job(conn, job: dict) -> None:
    project = load_project(conn, job["projectId"])
    if project.get("status") == "CANCELED":
        post_progress(job["id"], {"jobStatus": "FAILED", "error": "canceled"})
        return

    key = project["source_key"]
    if not key:
        raise RuntimeError("missing source key")

    log(f"processing job={job['id']} project={project['id']}")
    post_progress(
        job["id"],
        {"projectStatus": "PREPARING", "stage": "preparing", "progress": 2, "jobStatus": "RUNNING"},
    )

    with tempfile.TemporaryDirectory() as td:
        src = Path(td) / "source.mp4"
        download_object(key, src)
        post_progress(job["id"], {"projectStatus": "PREPARING", "stage": "preparing", "progress": 8})

        _ = probe_duration(src)
        post_progress(
            job["id"],
            {"projectStatus": "TRANSCRIBING", "stage": "transcribing", "progress": 12, "jobStatus": "RUNNING"},
        )

        words_path = Path(td) / "words.json"
        model = os.environ.get("ASR_MODEL", "small.en")
        subprocess.check_call([sys.executable, str(TRANSCRIBE), str(src), str(words_path), model])
        words = json.loads(words_path.read_text())
        for pos, w in enumerate(words):
            if "i" not in w:
                w["i"] = pos

        post_progress(
            job["id"],
            {
                "projectStatus": "TRANSCRIBING",
                "stage": "transcribing",
                "progress": 45,
                "transcriptWords": words,
                "jobStatus": "RUNNING",
            },
        )

    run_m4_pipeline(conn, job["id"], project, words, key, post_progress)
    log(f"finished job={job['id']}")


def main() -> None:
    dsn = env("DATABASE_URL")
    host = db_host_label(dsn)
    log(f"clips-worker starting worker_id={os.environ.get('WORKER_ID', 'worker-1')} db={host}")
    log_models()
    log_picker_config()
    try:
        with psycopg2.connect(dsn) as conn:
            queued = count_queued_jobs(conn)
            log(f"connected to db host={host} queued_jobs={queued}")
    except Exception as exc:
        log(f"FATAL database startup failed: {exc}")
        traceback.print_exc()
        sys.exit(1)

    idle_polls = 0
    while True:
        try:
            with psycopg2.connect(dsn) as conn:
                job = claim_job(conn)
                if not job:
                    idle_polls += 1
                    if idle_polls % 30 == 1:
                        try:
                            n = count_queued_jobs(conn)
                            log(f"poll idle queued_jobs={n}")
                        except Exception as poll_exc:
                            log(f"poll count failed: {poll_exc}")
                    time.sleep(2)
                    continue
                idle_polls = 0
                log(f"claimed job={job['id']}")
                try:
                    if job.get("type") == "RENDER_CLIP":
                        run_render_clip_job(conn, job, post_progress)
                    elif job.get("type") == "THUMBNAIL":
                        from clips_worker.thumbnail_job import run_thumbnail_job

                        run_thumbnail_job(conn, job, post_progress)
                        with conn.cursor() as cur:
                            cur.execute(
                                'UPDATE clip_jobs SET status = %s, "finishedAt" = NOW(), error = NULL WHERE id = %s',
                                ("DONE", job["id"]),
                            )
                        conn.commit()
                    elif job.get("type") == "DUB":
                        from clips_worker.dub_job import run_dub_job

                        run_dub_job(conn, job, post_progress)
                        with conn.cursor() as cur:
                            cur.execute(
                                'UPDATE clip_jobs SET status = %s, "finishedAt" = NOW(), error = NULL WHERE id = %s',
                                ("DONE", job["id"]),
                            )
                        conn.commit()
                    elif job.get("type") == "MUSIC":
                        from clips_worker.music_job import run_music_job

                        run_music_job(conn, job, post_progress)
                        with conn.cursor() as cur:
                            cur.execute(
                                'UPDATE clip_jobs SET status = %s, "finishedAt" = NOW(), error = NULL WHERE id = %s',
                                ("DONE", job["id"]),
                            )
                        conn.commit()
                    elif job.get("type") == "REFRAME_CROP":
                        from clips_worker.reframe_crop import run_reframe_crop_job

                        run_reframe_crop_job(conn, job)
                        post_progress(job["id"], {"jobStatus": "DONE"})
                    elif job.get("type") == "IMPORT_URL":
                        from clips_worker.import_url import run_import_url_job

                        project = load_project(conn, job["projectId"])
                        run_import_url_job(conn, job, project, post_progress)
                        with conn.cursor() as cur:
                            cur.execute(
                                'UPDATE clip_jobs SET status = %s, "finishedAt" = NOW(), error = NULL WHERE id = %s',
                                ("DONE", job["id"]),
                            )
                        conn.commit()
                    else:
                        process_job(conn, job)
                except Exception as exc:
                    msg = format_subprocess_error(exc)
                    log(f"job {job['id']} failed: {msg}")
                    traceback.print_exc()
                    if job.get("type") in ("RENDER_CLIP", "MUSIC", "THUMBNAIL", "DUB"):
                        if job.get("type") == "DUB":
                            payload = job.get("payload") or {}
                            if isinstance(payload, str):
                                payload = json.loads(payload)
                            dub_track_id = payload.get("dubTrackId")
                            if dub_track_id:
                                with conn.cursor() as cur:
                                    cur.execute(
                                        'UPDATE dub_tracks SET status=%s, error=%s WHERE id=%s',
                                        ("FAILED", msg[:4000], dub_track_id),
                                    )
                                conn.commit()
                        if job.get("type") == "RENDER_CLIP":
                            payload = job.get("payload") or {}
                            if isinstance(payload, str):
                                payload = json.loads(payload)
                            rid = payload.get("renderId")
                            if rid:
                                with conn.cursor() as cur:
                                    cur.execute(
                                        'UPDATE clip_renders SET status = %s, error = %s, "updatedAt" = NOW() WHERE id = %s',
                                        ("FAILED", msg[:4000], rid),
                                    )
                                conn.commit()
                        mark_generation_failed(conn, job, msg)
                    else:
                        post_progress(
                            job["id"],
                            {
                                "projectStatus": "FAILED",
                                "stage": "failed",
                                "progress": 0,
                                "error": msg[:500],
                                "jobStatus": "FAILED",
                            },
                        )
        except Exception as exc:
            log(f"worker loop error: {exc}")
            traceback.print_exc()
            time.sleep(5)


if __name__ == "__main__":
    main()
