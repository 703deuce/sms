"""Clips CPU worker: claim ClipJob rows, PREPARING + TRANSCRIBING (faster-whisper)."""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

import boto3
import psycopg2
from psycopg2.extras import RealDictCursor

PROTOTYPE = Path(__file__).resolve().parents[1] / "prototype" / "v3"
TRANSCRIBE = PROTOTYPE / "transcribe.py"


def env(name: str, default: str | None = None) -> str:
    v = os.environ.get(name, default)
    if not v:
        raise RuntimeError(f"Missing env {name}")
    return v


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
    with urllib.request.urlopen(req, timeout=120) as resp:
        resp.read()


def s3_client():
    return boto3.client(
        "s3",
        endpoint_url=os.environ.get("S3_ENDPOINT"),
        aws_access_key_id=env("S3_ACCESS_KEY_ID"),
        aws_secret_access_key=env("S3_SECRET_ACCESS_KEY"),
        region_name=os.environ.get("S3_REGION", "us-east-1"),
    )


def claim_job(conn) -> dict | None:
    worker_id = os.environ.get("WORKER_ID", "worker-1")
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            UPDATE clip_jobs
            SET status = 'RUNNING', locked_by = %s, locked_at = NOW(), attempts = attempts + 1
            WHERE id = (
              SELECT id FROM clip_jobs
              WHERE status = 'QUEUED' AND type = 'PROCESS_PROJECT' AND run_after <= NOW()
              ORDER BY priority DESC, run_after ASC
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
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        text=True,
    ).strip()
    return float(out)


def process_job(conn, job: dict) -> None:
    project = load_project(conn, job["projectId"])
    if project.get("status") == "CANCELED":
        post_progress(job["id"], {"jobStatus": "FAILED", "error": "canceled"})
        return

    bucket = env("S3_BUCKET")
    client = s3_client()
    key = project["source_key"]
    if not key:
        raise RuntimeError("missing source key")

    post_progress(
        job["id"],
        {"projectStatus": "PREPARING", "stage": "preparing", "progress": 2, "jobStatus": "RUNNING"},
    )

    with tempfile.TemporaryDirectory() as td:
        src = Path(td) / "source.mp4"
        client.download_file(bucket, key, str(src))
        post_progress(job["id"], {"projectStatus": "PREPARING", "stage": "preparing", "progress": 8})

        duration = ffprobe_duration(src)
        post_progress(
            job["id"],
            {"projectStatus": "TRANSCRIBING", "stage": "transcribing", "progress": 12, "jobStatus": "RUNNING"},
        )

        words_path = Path(td) / "words.json"
        model = os.environ.get("ASR_MODEL", "small")
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

        # M3 stops after transcript; later milestones continue pipeline.
        post_progress(
            job["id"],
            {
                "projectStatus": "FINDING_CLIPS",
                "stage": "transcript_ready",
                "progress": 45,
                "transcriptWords": words,
                "jobStatus": "DONE",
            },
        )


def main() -> None:
    dsn = env("DATABASE_URL")
    while True:
        try:
            with psycopg2.connect(dsn) as conn:
                job = claim_job(conn)
                if not job:
                    time.sleep(2)
                    continue
                try:
                    process_job(conn, job)
                except Exception as exc:  # noqa: BLE001
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
        except Exception:
            time.sleep(5)


if __name__ == "__main__":
    main()
