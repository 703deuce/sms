"""One-off repair: re-queue STREAM_RENDER for a project (no secrets)."""
from __future__ import annotations

import json
import os
import sys
import uuid

import psycopg2
from psycopg2.extras import RealDictCursor

PROJECT = sys.argv[1] if len(sys.argv) > 1 else ""


def main() -> int:
    if not PROJECT:
        print("usage: repair_proj_render.py <projectId>")
        return 1
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute('SELECT id FROM stream_vods WHERE "projectId"=%s', (PROJECT,))
            vod = cur.fetchone()
            if not vod:
                print("repair_status=no_vod")
                return 1
            vod_id = vod["id"]
            cur.execute(
                'SELECT id, title FROM clips WHERE "projectId"=%s AND "deletedAt" IS NULL',
                (PROJECT,),
            )
            clips = cur.fetchall()
            cur.execute("SELECT state FROM stream_vods WHERE id=%s", (vod_id,))
            st = cur.fetchone()["state"] or {}
            if isinstance(st, str):
                st = json.loads(st)
            st.pop("segmentKeys", None)
            cur.execute(
                """
                UPDATE clips SET "sourceSegKey"=NULL, "previewKey"=NULL, "segmentKey"=NULL,
                  "posterKey"=NULL, "wordsKey"=NULL, "updatedAt"=NOW()
                WHERE "projectId"=%s AND "deletedAt" IS NULL
                """,
                (PROJECT,),
            )
            cur.execute(
                'UPDATE stream_vods SET state=%s::jsonb, "updatedAt"=NOW() WHERE id=%s',
                (json.dumps(st), vod_id),
            )
            cur.execute(
                """
                SELECT id FROM clip_jobs WHERE "projectId"=%s AND type='STREAM_RENDER'
                  AND status IN ('QUEUED','RUNNING') LIMIT 1
                """,
                (PROJECT,),
            )
            if cur.fetchone():
                print("repair_status=render_already_active")
            else:
                job_id = f"job_{uuid.uuid4().hex}"
                cur.execute(
                    """
                    INSERT INTO clip_jobs (id, "projectId", type, status, payload, priority, "createdAt")
                    VALUES (%s,%s,'STREAM_RENDER','QUEUED',%s::jsonb,10,NOW())
                    """,
                    (job_id, PROJECT, json.dumps({"vodId": vod_id})),
                )
                print(f"repair_status=render_enqueued jobId={job_id} clipCount={len(clips)}")
        conn.commit()
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
