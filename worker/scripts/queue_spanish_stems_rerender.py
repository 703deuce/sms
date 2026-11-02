#!/usr/bin/env python3
"""Queue a fresh RENDER_CLIP for clip_9e3f8c03 (720p, stems) using current render cache hash."""
from __future__ import annotations

import json
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone

import psycopg2

from clips_worker.edits_render import edits_version_hash, normalize_edits
from clips_worker.render_pipeline import RENDER_PIPELINE_VERSION

CLIP_ID = os.environ.get("CLIP_ID", "clip_9e3f8c03d25643a18c69644f26af24fb")


def main() -> int:
    deliver = {
        "codec": "h264",
        "format": "mp4",
        "fps": "source",
        "quality": "standard",
        "stems": True,
    }
    deliver_json = json.dumps(deliver, sort_keys=True)
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()
    cur.execute(
        'select "workspaceId","projectId","startMs","endMs",edits,title from clips where id=%s',
        (CLIP_ID,),
    )
    row = cur.fetchone()
    if not row:
        print("clip not found", file=sys.stderr)
        return 1
    ws, pid, start, end, edits, title = row
    ne = normalize_edits(edits, int(start), int(end))
    eh = edits_version_hash(ne)
    material = f"{eh}:stems=1:{deliver_json}"
    h = f"{RENDER_PIPELINE_VERSION}:{material}:16:9:720p"
    print("pipeline", RENDER_PIPELINE_VERSION)
    print("hash", h)
    cur.execute(
        'select id, status from clip_renders where "clipId"=%s and "editsVersionHash"=%s order by "createdAt" desc limit 1',
        (CLIP_ID, h),
    )
    existing = cur.fetchone()
    if existing and existing[1] == "READY":
        print("already_ready", existing[0])
        return 0
    rid = "rnd_" + uuid.uuid4().hex
    jid = "job_" + uuid.uuid4().hex
    exp = datetime.now(timezone.utc) + timedelta(days=7)
    base = (title or "clip").replace("/", "-")[:80]
    fname = f"{base}.mp4"
    cur.execute(
        """
        insert into clip_renders (id,"clipId","workspaceId",status,resolution,format,"aspectRatio",watermark,filename,"editsVersionHash","expiresAt","createdAt","updatedAt")
        values (%(rid)s,%(cid)s,%(ws)s,'QUEUED','720p','mp4','16:9',false,%(fname)s,%(hash)s,%(exp)s,now(),now())
        """,
        {"rid": rid, "cid": CLIP_ID, "ws": ws, "fname": fname, "hash": h, "exp": exp},
    )
    payload = {
        "renderId": rid,
        "editsVersionHash": h,
        "deliver": deliver,
        "targetResolution": "720p",
    }
    cur.execute(
        """
        insert into clip_jobs (id,"projectId","clipId",type,status,payload,"createdAt")
        values (%(jid)s,%(pid)s,%(cid)s,'RENDER_CLIP','QUEUED',%(payload)s::jsonb,now())
        """,
        {"jid": jid, "pid": pid, "cid": CLIP_ID, "payload": json.dumps(payload)},
    )
    conn.commit()
    print("queued_render", rid)
    print("queued_job", jid)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
