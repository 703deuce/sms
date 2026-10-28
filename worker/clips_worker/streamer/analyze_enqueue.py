"""Idempotent STREAM_ANALYZE enqueue for rolling live ingest."""
from __future__ import annotations

import json
import uuid

from clips_worker.streamer.project_cancel import load_project_operator_cancelled
from clips_worker.streamer.usage import job_priority


def has_pending_stream_analyze(conn, project_id: str, vod_id: str) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT 1 FROM clip_jobs
            WHERE "projectId"=%s AND type='STREAM_ANALYZE' AND status IN ('QUEUED','RUNNING')
              AND payload->>'vodId'=%s
            LIMIT 1
            """,
            (project_id, vod_id),
        )
        return cur.fetchone() is not None


def enqueue_stream_analyze(
    conn,
    *,
    project_id: str,
    vod_id: str,
    workspace_id: str,
    triggered_by: str = "auto",
    source: str = "import",
    commit: bool = True,
    range_start_ms: int | None = None,
    range_end_ms: int | None = None,
    audio_key: str | None = None,
    allow_queue_behind_pending: bool = False,
) -> str | None:
    from clips_worker.decision_log import decision_log

    if load_project_operator_cancelled(conn, project_id):
        decision_log(
            "streamer",
            "analyze_enqueue_skipped",
            project_id=project_id,
            vod_id=vod_id,
            reason="operator_cancelled",
            source=source,
        )
        return None
    if not allow_queue_behind_pending and has_pending_stream_analyze(conn, project_id, vod_id):
        decision_log(
            "streamer",
            "analyze_enqueue_skipped",
            project_id=project_id,
            vod_id=vod_id,
            reason="analyze_already_pending",
            source=source,
        )
        return None
    pri = job_priority(conn, workspace_id, triggered_by)
    analyze_id = f"job_{uuid.uuid4().hex}"
    body: dict = {"vodId": vod_id}
    if range_start_ms is not None and range_end_ms is not None:
        body["rangeStartMs"] = int(range_start_ms)
        body["rangeEndMs"] = int(range_end_ms)
        body["windowOnly"] = True
    if audio_key:
        body["audioKey"] = str(audio_key)
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO clip_jobs (id, "projectId", type, status, payload, priority, "createdAt")
            VALUES (%s,%s,'STREAM_ANALYZE','QUEUED',%s::jsonb,%s,NOW())
            """,
            (analyze_id, project_id, json.dumps(body), pri),
        )
    if commit:
        conn.commit()
    decision_log(
        "streamer",
        "analyze_enqueued",
        id=analyze_id,
        project_id=project_id,
        vod_id=vod_id,
        source=source,
        rangeStartMs=range_start_ms,
        rangeEndMs=range_end_ms,
        audioKey=audio_key,
        queuedBehindPending=allow_queue_behind_pending,
    )
    return analyze_id
