"""STREAM_RELAYOUT: re-render clips after manual layout change (S8)."""
from __future__ import annotations

import json

from clips_worker.streamer.render_job import run_stream_render_job


def run_stream_relayout_job(conn, job: dict, post_progress) -> None:
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    clip_ids = payload.get("clipIds")
    if clip_ids:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE clips SET "previewKey" = NULL, "posterKey" = NULL, "updatedAt" = NOW()
                WHERE "projectId" = %s AND id = ANY(%s)
                """,
                (job["projectId"], clip_ids),
            )
        conn.commit()
    else:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE clips SET "previewKey" = NULL, "posterKey" = NULL, "updatedAt" = NOW()
                WHERE "projectId" = %s AND "deletedAt" IS NULL
                """,
                (job["projectId"],),
            )
        conn.commit()
    run_stream_render_job(conn, job, post_progress)
