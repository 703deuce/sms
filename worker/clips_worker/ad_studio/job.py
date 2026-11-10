"""B3e: create only the durable silent canvas for an Ad Studio timeline.

KIE and ElevenLabs calls remain in the existing web helpers, never this worker.
No PROCESS_PROJECT job or short-form clipper is started. The regular render
worker processes the finished editor timeline after the web queues RENDER_CLIP.
"""
from __future__ import annotations

import json
import tempfile
from pathlib import Path


def run_ad_studio_job(conn, job: dict) -> None:
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    run_id = str(payload.get("runId") or "").strip()
    job_id = str(job["id"])
    project_id = str(job.get("projectId") or "")
    print(f"[ad-studio:b3] worker_canvas_begin job={job_id} run={run_id} project={project_id}", flush=True)
    if not run_id or not project_id:
        raise ValueError("Missing Ad Studio run or destination project id")

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT r.status, r."projectId", p.settings, p."uploadId",
                   u.key, u.status
            FROM "AdStudioRun" r
            JOIN clip_projects p ON p.id=r."projectId"
            JOIN clip_uploads u ON u.id=p."uploadId"
            WHERE r.id=%s AND p.id=%s
            """,
            (run_id, project_id),
        )
        row = cur.fetchone()
    # Never hold a DB transaction while doing ffmpeg or network storage I/O.
    conn.commit()
    if not row:
        raise ValueError("Ad Studio destination canvas was not found")
    status, recorded_project_id, settings, upload_id, storage_key, upload_status = row
    if status == "cancelled":
        print(f"[ad-studio:b3] worker_cancelled job={job_id} run={run_id}", flush=True)
        return
    if status not in ("stitching", "generating"):
        raise ValueError("Ad Studio run is not ready for canvas creation")
    if upload_status == "COMPLETE":
        print(f"[ad-studio:b3] worker_canvas_already_complete job={job_id} run={run_id}", flush=True)
        return
    if isinstance(settings, str):
        settings = json.loads(settings)
    if not isinstance(settings, dict) or not storage_key:
        raise ValueError("Ad Studio canvas settings are missing")
    from clips_worker.blank_project import make_blank_video
    from clips_worker.storage import upload_file

    duration_ms = int(payload.get("durationMs") or 0)
    if duration_ms not in (15000, 30000):
        raise ValueError("Ad Studio canvas must be 15 or 30 seconds")
    aspect = settings.get("aspectRatio") or "9:16"
    with tempfile.TemporaryDirectory(prefix="ad_studio_canvas_") as td:
        output = Path(td) / "ad-canvas.mp4"
        print(f"[ad-studio:b3] worker_canvas_encode_begin job={job_id} aspect={aspect} durationMs={duration_ms}", flush=True)
        width, height = make_blank_video(output, aspect, duration_ms)
        print(f"[ad-studio:b3] worker_canvas_encode_complete job={job_id} size={output.stat().st_size}", flush=True)
        # Recheck cancellation before uploading.
        with conn.cursor() as cur:
            cur.execute('SELECT status FROM "AdStudioRun" WHERE id=%s', (run_id,))
            check = cur.fetchone()
        conn.commit()
        if not check or check[0] == "cancelled":
            print(f"[ad-studio:b3] worker_canvas_skip_after_cancel run={run_id}", flush=True)
            return
        print(f"[ad-studio:b3] worker_canvas_upload_begin job={job_id}", flush=True)
        upload_file(storage_key, output, "video/mp4")
        print(f"[ad-studio:b3] worker_canvas_upload_complete job={job_id}", flush=True)
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE clip_uploads
                SET status='COMPLETE', bytes=%s, "durationMs"=%s, width=%s, height=%s
                WHERE id=%s AND status='PENDING'
                """,
                (output.stat().st_size, duration_ms, width, height, upload_id),
            )
            cur.execute(
                """
                UPDATE clip_projects SET status='READY', stage='ready', progress=100
                WHERE id=%s AND status='QUEUED'
                """,
                (project_id,),
            )
        conn.commit()
    print(f"[ad-studio:b3] worker_canvas_ready job={job_id} run={run_id} project={project_id}", flush=True)
