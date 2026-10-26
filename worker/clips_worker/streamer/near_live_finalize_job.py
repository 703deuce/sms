"""STREAM_NEAR_LIVE_FINALIZE: after stream.offline — final VOD pass + dedupe hook."""
from __future__ import annotations

import json
import uuid

from psycopg2.extras import RealDictCursor

from clips_worker.streamer.near_live.helix import latest_archive_video
from clips_worker.streamer.usage import job_priority


def run_near_live_finalize_job(conn, job: dict, post_progress) -> None:
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    channel_id = payload.get("channelId")
    vod_id = payload.get("vodId")
    project_id = payload.get("projectId")
    if not vod_id or not project_id:
        raise RuntimeError("missing finalize payload")

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute('SELECT "externalId", platform FROM stream_channels WHERE id=%s', (channel_id,))
        ch = cur.fetchone()
        cur.execute('SELECT state FROM stream_vods WHERE id=%s', (vod_id,))
        vod = cur.fetchone()

    state = vod.get("state") or {}
    if isinstance(state, str):
        state = json.loads(state)
    state["nearLiveFinalize"] = True

    archive = None
    if ch and ch["platform"] == "twitch":
        try:
            archive = latest_archive_video(str(ch["externalId"]))
        except Exception:
            archive = None

    if archive:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE stream_vods
                SET url=%s, "externalId"=%s, "rangeStartMs"=0, "rangeEndMs"=NULL, state=%s::jsonb, "updatedAt"=NOW()
                WHERE id=%s
                """,
                (archive["url"], archive["id"], json.dumps(state), vod_id),
            )
        conn.commit()
        import_id = f"job_{uuid.uuid4().hex}"
        pri = job_priority(conn, "near_live")
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO clip_jobs (id, "projectId", type, status, payload, priority, "createdAt")
                VALUES (%s,%s,'STREAM_IMPORT','QUEUED',%s::jsonb,%s,NOW())
                """,
                (import_id, project_id, json.dumps({"vodId": vod_id, "nearLiveFinalize": True}), pri),
            )
        conn.commit()

    post_progress(
        job["id"],
        {"jobStatus": "DONE", "stage": "near_live_finalize", "projectStatus": "PREPARING"},
    )
