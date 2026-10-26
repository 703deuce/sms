"""Ingest Helix !clip into project (poll until clip URL ready)."""
from __future__ import annotations

import json
import os
import uuid
import urllib.parse
import urllib.request

from psycopg2.extras import RealDictCursor

from clips_worker.streamer.errors import RetryableError
from clips_worker.streamer.near_live.dedupe import dedupe_project_clips


def _helix_get_clip(clip_id: str, token: str) -> dict | None:
    cid = os.environ["TWITCH_CLIENT_ID"]
    url = f"https://api.twitch.tv/helix/clips?id={urllib.parse.quote(clip_id)}"
    req = urllib.request.Request(url, headers={"Client-Id": cid, "Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read())
    return (data.get("data") or [None])[0]


def run_near_live_clip_ingest_job(conn, job: dict, post_progress) -> None:
    from clips_worker.streamer.autopull_job import _helix_app_token

    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    project_id = payload.get("projectId")
    clip_id = payload.get("twitchClipId")
    channel_id = payload.get("channelId")
    if not project_id or not clip_id:
        raise RuntimeError("missing clip ingest payload")

    token = _helix_app_token()
    try:
        clip = _helix_get_clip(clip_id, token)
    except Exception as exc:
        raise RetryableError(f"Helix clip lookup failed: {exc}") from exc

    if not clip or not clip.get("url"):
        raise RetryableError("Twitch clip not ready yet")

    vod_offset_ms = int(float(clip.get("vod_offset") or 0) * 1000)
    duration_ms = int(float(clip.get("duration") or 15) * 1000)
    start_ms = max(0, vod_offset_ms)
    end_ms = start_ms + max(3000, duration_ms)

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute('SELECT "workspaceId" FROM clip_projects WHERE id=%s', (project_id,))
        proj = cur.fetchone()
        cur.execute(
            """
            SELECT id FROM clips
            WHERE "projectId"=%s AND "deletedAt" IS NULL
              AND "aiMeta"#>>'{streamer,twitchClipId}' = %s
            LIMIT 1
            """,
            (project_id, clip_id),
        )
        existing = cur.fetchone()
    if not proj:
        raise RuntimeError("project missing")
    if existing:
        dedupe_project_clips(conn, project_id)
        post_progress(job["id"], {"jobStatus": "DONE", "stage": "twitch_clip_ingested"})
        return

    new_id = f"clip_{uuid.uuid4().hex}"
    ai_meta = {
        "streamer": {
            "reasons": ["!clip"],
            "source": "twitch_helix_clip",
            "twitchClipId": clip_id,
            "clipUrl": clip.get("url"),
        },
    }
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO clips (
              id, "projectId", "workspaceId", title, reason,
              "startMs", "endMs", score, scores, edits, "aiMeta",
              favorite, "createdAt", "updatedAt"
            ) VALUES (
              %s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s::jsonb,%s::jsonb,false,NOW(),NOW()
            )
            ON CONFLICT (id) DO NOTHING
            """,
            (
                new_id,
                project_id,
                proj["workspaceId"],
                clip.get("title") or "Chat !clip",
                "Captured from chat !clip",
                start_ms,
                end_ms,
                95,
                json.dumps({"chat": 1.0}),
                json.dumps({}),
                json.dumps(ai_meta),
            ),
        )
    conn.commit()
    dedupe_project_clips(conn, project_id)
    post_progress(job["id"], {"jobStatus": "DONE", "stage": "twitch_clip_ingested"})
