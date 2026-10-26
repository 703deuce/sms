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

from clips_worker.job_types import JOB_TYPES, job_types_sql_in
from clips_worker.streamer.lanes import lane_types_sql_in, worker_lane
from clips_worker.pipeline import run_m4_pipeline
from clips_worker.render_job import run_render_clip_job
from clips_worker.probe import format_subprocess_error, probe_duration
from clips_worker.storage import download_object
from clips_worker.transcribe_source import transcribe_video_file

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
            f"""
            SELECT count(*)::int FROM clip_jobs
            WHERE status = 'QUEUED' AND type IN ({lane_types_sql_in()})
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


def post_progress_resilient(job_id: str, payload: dict) -> None:
    """Progress posts must not abort long downloads on transient gateway timeouts."""
    try:
        post_progress(job_id, payload)
    except Exception as exc:
        log(f"progress post failed (continuing) job={job_id}: {exc}")


def claim_job(conn) -> dict | None:
    worker_id = os.environ.get("WORKER_ID", "worker-1")
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            f"""
            UPDATE clip_jobs
            SET status = 'RUNNING',
                "lockedBy" = %s,
                "lockedAt" = NOW(),
                attempts = attempts + 1
            WHERE id = (
              SELECT id FROM clip_jobs
              WHERE status = 'QUEUED'
                AND type IN ({lane_types_sql_in()})
                AND "runAfter" <= (NOW() AT TIME ZONE 'UTC')
                AND (
                  type <> 'STREAM_ANALYZE'
                  OR NOT EXISTS (
                    SELECT 1 FROM clip_jobs r
                    JOIN clip_projects p ON p.id = r."projectId"
                    WHERE r.status = 'RUNNING' AND r.type = 'STREAM_ANALYZE'
                      AND p."workspaceId" = (
                        SELECT p2."workspaceId" FROM clip_projects p2 WHERE p2.id = clip_jobs."projectId"
                      )
                  )
                )
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

        model = os.environ.get("ASR_MODEL", "small.en")
        words = transcribe_video_file(conn, project, src, model=model)

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

    run_m4_pipeline(conn, job["id"], project, words, key, post_progress, job=job)
    log(f"finished job={job['id']}")


def _mark_job_done(conn, job_id: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            'UPDATE clip_jobs SET status = %s, "finishedAt" = NOW(), error = NULL WHERE id = %s',
            ("DONE", job_id),
        )
    conn.commit()


def handle_render_clip(conn, job: dict) -> None:
    run_render_clip_job(conn, job, post_progress)


def handle_thumbnail(conn, job: dict) -> None:
    from clips_worker.thumbnail_job import run_thumbnail_job

    run_thumbnail_job(conn, job, post_progress)
    _mark_job_done(conn, job["id"])


def handle_dub(conn, job: dict) -> None:
    from clips_worker.dub_job import run_dub_job

    run_dub_job(conn, job, post_progress)
    _mark_job_done(conn, job["id"])


def handle_music(conn, job: dict) -> None:
    from clips_worker.music_job import run_music_job

    run_music_job(conn, job, post_progress)
    _mark_job_done(conn, job["id"])


def handle_reframe_crop(conn, job: dict) -> None:
    from clips_worker.reframe_crop import run_reframe_crop_job

    run_reframe_crop_job(conn, job)
    post_progress(job["id"], {"jobStatus": "DONE"})


def handle_stream_import(conn, job: dict) -> None:
    from clips_worker.streamer.import_job import run_stream_import_job

    run_stream_import_job(conn, job, post_progress_resilient)
    _mark_job_done(conn, job["id"])


def handle_stream_analyze(conn, job: dict) -> None:
    from clips_worker.streamer.analyze_job import run_stream_analyze_job

    run_stream_analyze_job(conn, job, post_progress_resilient)
    _mark_job_done(conn, job["id"])


def handle_stream_render(conn, job: dict) -> None:
    from clips_worker.streamer.render_job import run_stream_render_job

    run_stream_render_job(conn, job, post_progress)
    _mark_job_done(conn, job["id"])


def handle_stream_relayout(conn, job: dict) -> None:
    from clips_worker.streamer.relayout_job import run_stream_relayout_job

    run_stream_relayout_job(conn, job, post_progress)
    _mark_job_done(conn, job["id"])


def handle_stream_cleanup(conn, job: dict) -> None:
    from clips_worker.streamer.cleanup_job import run_stream_cleanup_job

    run_stream_cleanup_job(conn, job, post_progress)
    _mark_job_done(conn, job["id"])


def handle_stream_montage(conn, job: dict) -> None:
    from clips_worker.streamer.montage_job import run_stream_montage_job

    run_stream_montage_job(conn, job, post_progress)
    _mark_job_done(conn, job["id"])


def handle_stream_autopull(conn, job: dict) -> None:
    from clips_worker.streamer.autopull_job import run_stream_autopull_job

    run_stream_autopull_job(conn, job, post_progress)
    _mark_job_done(conn, job["id"])


def handle_stream_near_live_poll(conn, job: dict) -> None:
    from clips_worker.streamer.near_live_poll_job import run_near_live_poll_job

    run_near_live_poll_job(conn, job, post_progress)
    _mark_job_done(conn, job["id"])


def handle_stream_near_live_finalize(conn, job: dict) -> None:
    from clips_worker.streamer.near_live_finalize_job import run_near_live_finalize_job

    run_near_live_finalize_job(conn, job, post_progress)
    _mark_job_done(conn, job["id"])


def handle_stream_near_live_clip_ingest(conn, job: dict) -> None:
    from clips_worker.streamer.near_live_clip_ingest_job import run_near_live_clip_ingest_job

    run_near_live_clip_ingest_job(conn, job, post_progress)
    _mark_job_done(conn, job["id"])


def handle_import_url(conn, job: dict) -> None:
    from clips_worker.import_url import run_import_url_job

    project = load_project(conn, job["projectId"])
    run_import_url_job(conn, job, project, post_progress)
    _mark_job_done(conn, job["id"])


DISPATCH: dict[str, object] = {
    "IMPORT_URL": handle_import_url,
    "STREAM_IMPORT": handle_stream_import,
    "STREAM_ANALYZE": handle_stream_analyze,
    "STREAM_RENDER": handle_stream_render,
    "STREAM_RELAYOUT": handle_stream_relayout,
    "STREAM_CLEANUP": handle_stream_cleanup,
    "STREAM_MONTAGE": handle_stream_montage,
    "STREAM_AUTOPULL": handle_stream_autopull,
    "STREAM_NEAR_LIVE_POLL": handle_stream_near_live_poll,
    "STREAM_NEAR_LIVE_FINALIZE": handle_stream_near_live_finalize,
    "STREAM_NEAR_LIVE_CLIP_INGEST": handle_stream_near_live_clip_ingest,
    "PROCESS_PROJECT": process_job,
    "RENDER_CLIP": handle_render_clip,
    "REFRAME_CROP": handle_reframe_crop,
    "MUSIC": handle_music,
    "THUMBNAIL": handle_thumbnail,
    "DUB": handle_dub,
}


def main() -> None:
    from clips_worker.startup_check import validate_worker_env

    validate_worker_env()
    dsn = env("DATABASE_URL")
    host = db_host_label(dsn)
    log(
        f"clips-worker starting worker_id={os.environ.get('WORKER_ID', 'worker-1')} "
        f"lane={worker_lane()} db={host}"
    )
    log_models()
    log_picker_config()
    try:
        with psycopg2.connect(dsn) as conn:
            from clips_worker.boot_recovery import requeue_running_lane_jobs_on_boot

            requeue_running_lane_jobs_on_boot(conn)
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
                    if worker_lane() == "stream" and idle_polls % 60 == 1:
                        try:
                            from clips_worker.streamer.maintenance import maybe_run_streamer_maintenance

                            maybe_run_streamer_maintenance(conn)
                        except Exception as maint_exc:
                            log(f"streamer maintenance failed: {maint_exc}")
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
                    handler = DISPATCH.get(job.get("type") or "")
                    if not handler:
                        raise RuntimeError(f"unknown job type {job.get('type')}")
                    handler(conn, job)  # type: ignore[operator]
                except Exception as exc:
                    msg = format_subprocess_error(exc)
                    log(f"job {job['id']} failed: {msg}")
                    traceback.print_exc()
                    from clips_worker.streamer.errors import RetryableError

                    if isinstance(exc, RetryableError) and (job.get("type") or "").startswith("STREAM_"):
                        delay_s = min(300, 15 * max(1, int(job.get("attempts") or 1)))
                        with conn.cursor() as cur:
                            cur.execute(
                                """
                                UPDATE clip_jobs
                                SET status='QUEUED', "lockedBy"=NULL, "lockedAt"=NULL,
                                    "runAfter"=NOW() + (%s || ' seconds')::interval,
                                    error=%s
                                WHERE id=%s
                                """,
                                (str(delay_s), msg[:500], job["id"]),
                            )
                        conn.commit()
                        post_progress(
                            job["id"],
                            {
                                "jobStatus": "RUNNING",
                                "stage": "retrying",
                                "error": f"Retrying in {delay_s}s: {msg[:200]}",
                            },
                        )
                        continue
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
