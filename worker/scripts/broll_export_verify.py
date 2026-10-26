#!/usr/bin/env python3
"""Enqueue RENDER_CLIP for a clip and verify B-roll pixels in output."""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import time
import uuid
from pathlib import Path

import psycopg2

from clips_worker.storage import download_object


def main() -> int:
    clip_id = os.environ.get("CLIP_ID", "clip_62345181d555491ca5a2565ab770939b")
    dsn = os.environ["DATABASE_URL"]
    with psycopg2.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute('select id,"projectId","workspaceId",edits from clips where id=%s', (clip_id,))
            row = cur.fetchone()
            if not row:
                print("clip missing")
                return 1
            _, project_id, workspace_id, edits = row
            edits = edits if isinstance(edits, dict) else json.loads(edits)
            h = __import__("hashlib").sha256(json.dumps(edits, sort_keys=True).encode()).hexdigest()
            render_id = "rnd_" + uuid.uuid4().hex[:12]
            job_id = "job_" + uuid.uuid4().hex[:12]
            cur.execute(
                """
                insert into clip_renders (id,"clipId","workspaceId",status,resolution,watermark,filename,
                  "editsVersionHash","expiresAt","createdAt","updatedAt")
                values (%s,%s,%s,'QUEUED','720p',false,'broll-verify.mp4',%s,now()+interval '7 days',now(),now())
                """,
                (render_id, clip_id, workspace_id, h),
            )
            cur.execute(
                """
                insert into clip_jobs (id,"projectId","clipId",type,status,payload,"createdAt","runAfter")
                values (%s,%s,%s,'RENDER_CLIP','QUEUED',%s::jsonb,now(),now())
                """,
                (job_id, project_id, clip_id, json.dumps({"renderId": render_id})),
            )
        conn.commit()
    print("queued", render_id, job_id)
    key = None
    err = None
    st = None
    for _ in range(180):
        time.sleep(5)
        with psycopg2.connect(dsn) as conn:
            with conn.cursor() as cur:
                cur.execute('select status,"outputKey",error from clip_renders where id=%s', (render_id,))
                st, key, err = cur.fetchone()
                if st == "READY" and key:
                    break
                if st == "FAILED":
                    break
    print("status", st)
    if err:
        print("error", err[:2000])
    if st != "READY" or not key:
        return 2
    with tempfile.TemporaryDirectory() as td:
        mp4 = Path(td) / "out.mp4"
        download_object(key, mp4)

        def pix(t: float) -> tuple[int, int, int]:
            raw = subprocess.check_output(
                [
                    "ffmpeg",
                    "-v",
                    "error",
                    "-ss",
                    str(t),
                    "-i",
                    str(mp4),
                    "-frames:v",
                    "1",
                    "-f",
                    "rawvideo",
                    "-pix_fmt",
                    "rgb24",
                    "-",
                ],
            )
            return raw[0], raw[1], raw[2]

        p1 = pix(1.0)
        p45 = pix(4.5)
        print("rgb@1.0", p1, "rgb@4.5", p45, "diff", p1 != p45, "size", mp4.stat().st_size)
        return 0 if p1 != p45 else 3


if __name__ == "__main__":
    raise SystemExit(main())
