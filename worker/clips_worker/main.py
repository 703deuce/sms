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
        core_ok = bool(load_core_rubric())
        log(f"picker config loaded core_rubric={core_ok} genres={','.join(genres) or '(none)'}")
    except Exception as exc:
        log(f"picker config load failed: {exc}")


def count_queued_jobs(conn) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT count(*)::int FROM clip_jobs
            WHERE status = 'QUEUED' AND type = 'PROCESS_PROJECT'
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
                AND type = 'PROCESS_PROJECT'
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


def ffprobe_duration(path: Path) -> float:
    out = subprocess.check_output(
        [
            "ffmpeg",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        text=True,
    ).strip()
    return float(out)


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

        _ = ffprobe_duration(src)
        post_progress(
            job["id"],
            {"projectStatus": "TRANSCRIBING", "stage": "transcribing", "progress": 12, "jobStatus": "RUNNING"},
        )

        words_path = Path(td) / "words.json"
        model = os.environ.get("ASR_MODEL", "small.en")
        subprocess.check_call([sys.executable, str(TRANSCRIBE), str(src), str(words_path), model])
        words = json.loads(words_path.read_text())

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
                    process_job(conn, job)
                except Exception as exc:
                    log(f"job {job['id']} failed: {exc}")
                    traceback.print_exc()
                    post_progress(
                        job["id"],
                        {
                            "projectStatus": "FAILED",
                            "stage": "failed",
                            "progress": 0,
                            "error": str(exc)[:500],
                            "jobStatus": "FAILED",
                        },
                    )
        except Exception as exc:
            log(f"worker loop error: {exc}")
            traceback.print_exc()
            time.sleep(5)


if __name__ == "__main__":
    main()
