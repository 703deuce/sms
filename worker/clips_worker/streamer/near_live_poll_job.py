"""STREAM_NEAR_LIVE_POLL: poll in-progress Twitch archive; enqueue chunk STREAM_IMPORT."""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from psycopg2.extras import RealDictCursor

from clips_worker.streamer.errors import RetryableError
from clips_worker.streamer.near_live.chunk import plan_near_live_chunk
from clips_worker.streamer.near_live.helix import latest_archive_video
from clips_worker.streamer.usage import job_priority

POLL_MINUTES = 12


def _schedule_next_poll(conn, project_id: str, channel_id: str, vod_id: str) -> None:
    job_id = f"job_{uuid.uuid4().hex}"
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO clip_jobs (id, "projectId", type, status, payload, priority, "runAfter", "createdAt")
            VALUES (%s,%s,'STREAM_NEAR_LIVE_POLL','QUEUED',%s::jsonb,25,NOW() + (%s || ' minutes')::interval,NOW())
            """,
            (job_id, project_id, json.dumps({"channelId": channel_id, "vodId": vod_id, "projectId": project_id}), str(POLL_MINUTES)),
        )
    conn.commit()


def run_near_live_poll_job(conn, job: dict, post_progress) -> None:
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    channel_id = payload.get("channelId")
    vod_id = payload.get("vodId")
    project_id = payload.get("projectId")
    if not channel_id or not vod_id or not project_id:
        raise RuntimeError("missing near-live poll payload")

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute('SELECT "externalId", platform, "platformState" FROM stream_channels WHERE id=%s', (channel_id,))
        ch = cur.fetchone()
        cur.execute('SELECT * FROM stream_vods WHERE id=%s', (vod_id,))
        vod = dict(cur.fetchone() or {})

    if not ch or ch["platform"] != "twitch":
        post_progress(job["id"], {"jobStatus": "DONE"})
        return

    ps = ch.get("platformState") or {}
    if isinstance(ps, str):
        ps = json.loads(ps)
    nl = (ps.get("nearLive") or {}) if isinstance(ps, dict) else {}
    if nl.get("finalized"):
        post_progress(job["id"], {"jobStatus": "DONE"})
        return

    processed_end = int(nl.get("processedEndMs") or vod.get("state", {}).get("processedEndMs") or 0)
    if isinstance(vod.get("state"), str):
        vstate = json.loads(vod["state"])
    else:
        vstate = vod.get("state") or {}
    processed_end = int(vstate.get("processedEndMs") or processed_end)

    try:
        archive = latest_archive_video(str(ch["externalId"]))
    except Exception as exc:
        raise RetryableError(f"Near-live Helix poll failed: {exc}") from exc

    if not archive:
        _schedule_next_poll(conn, project_id, channel_id, vod_id)
        post_progress(job["id"], {"jobStatus": "DONE", "stage": "near_live_waiting_archive"})
        return

    plan = plan_near_live_chunk(int(archive["durationMs"]), processed_end)
    nl_update = {
        **nl,
        "archiveVideoId": archive["id"],
        "lastPollAt": datetime.now(timezone.utc).isoformat(),
    }

    if not plan:
        with conn.cursor() as cur:
            cur.execute(
                'UPDATE stream_channels SET "platformState"=%s::jsonb, "updatedAt"=NOW() WHERE id=%s',
                (json.dumps({**ps, "nearLive": nl_update}), channel_id),
            )
        conn.commit()
        _schedule_next_poll(conn, project_id, channel_id, vod_id)
        post_progress(job["id"], {"jobStatus": "DONE", "stage": "near_live_poll"})
        return

    start_ms, end_ms, watermark = plan
    url = archive["url"]
    vstate = {**vstate, "processedEndMs": watermark, "nearLiveChunk": {"startMs": start_ms, "endMs": end_ms}}
    nl_update["processedEndMs"] = watermark

    import_id = f"job_{uuid.uuid4().hex}"
    pri = job_priority(conn, "near_live")
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE stream_vods
            SET url=%s, "externalId"=%s, "rangeStartMs"=%s, "rangeEndMs"=%s, state=%s::jsonb, "updatedAt"=NOW()
            WHERE id=%s
            """,
            (url, archive["id"], start_ms, end_ms, json.dumps(vstate), vod_id),
        )
        cur.execute(
            'UPDATE stream_channels SET "platformState"=%s::jsonb, "updatedAt"=NOW() WHERE id=%s',
            (json.dumps({**ps, "nearLive": nl_update}), channel_id),
        )
        cur.execute(
            """
            INSERT INTO clip_jobs (id, "projectId", type, status, payload, priority, "createdAt")
            VALUES (%s,%s,'STREAM_IMPORT','QUEUED',%s::jsonb,%s,NOW())
            """,
            (import_id, project_id, json.dumps({"vodId": vod_id, "nearLiveChunk": True}), pri),
        )
    conn.commit()
    _schedule_next_poll(conn, project_id, channel_id, vod_id)
    post_progress(
        job["id"],
        {
            "jobStatus": "DONE",
            "stage": "near_live_chunk_queued",
            "projectStatus": "PREPARING",
            "progress": 10,
        },
    )
