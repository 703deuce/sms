#!/usr/bin/env python3
"""Build check for clip_3307 per editor fix spec."""
from __future__ import annotations

import json
import os
import re
import sys
import tempfile
import time
import uuid
from pathlib import Path

import psycopg2
from psycopg2.extras import RealDictCursor

from clips_worker.caption_words import build_caption_words
from clips_worker.edits_render import build_srt, edits_version_hash, keep_segments, normalize_edits, words_after_edits
from clips_worker.probe import probe_duration
from clips_worker.render_job import load_source_words
from clips_worker.storage import download_object

CLIP_ID = "clip_3307d3a9dceb461d94cf7a3e25d7e521"


def duration_ms(edits: dict) -> int:
    segs = keep_segments(int(edits["trim"]["in"]), int(edits["trim"]["out"]), edits.get("cutRanges") or [])
    return sum(b - a for a, b in segs)


def srt_snippet(srt: str, needle: str, ctx: int = 2) -> str:
    blocks = re.split(r"\n\n+", srt.strip())
    for i, b in enumerate(blocks):
        if needle.lower() in b.lower():
            return "\n\n".join(blocks[max(0, i - ctx) : i + ctx + 1])
    return f"(no block matching {needle})"


def main() -> int:
    dsn = os.environ["DATABASE_URL"]
    with psycopg2.connect(dsn) as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT c.*, p."transcriptKey", p."transcriptWords"
                FROM clips c JOIN clip_projects p ON p.id = c."projectId"
                WHERE c.id = %s
                """,
                (CLIP_ID,),
            )
            clip = dict(cur.fetchone())

    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        words = load_source_words(
            {
                "clipId": CLIP_ID,
                "workspaceId": clip["workspaceId"],
                "projectId": clip["projectId"],
                "startMs": clip["startMs"],
                "transcriptKey": clip.get("transcriptKey"),
                "transcriptWords": clip.get("transcriptWords"),
            },
            td_path,
        )
        cs, ce = int(clip["startMs"]), int(clip["endMs"])
        comic = next(w for w in words if w["w"].lower().startswith("comic"))
        memory = next(w for w in words if "memory" in w["w"].lower())
        actually = next(w for w in words if w["w"].lower() == "actually")
        wi = int(actually.get("i", actually.get("idx", 0)))
        cut_lo = int(round(float(comic["s"]) * 1000))
        cut_hi = int(round(float(memory["e"]) * 1000))
        edits = normalize_edits(
            {
                "cutRanges": [[cut_lo, cut_hi]],
                "wordFixes": {str(wi): "TESTWORD"},
                "layout": {"mode": "speaker_follow", "shotOverrides": [{"i": 1, "focus": "B"}]},
                "trim": {"in": cs, "out": ce},
            },
            cs,
            ce,
        )
        expected_sec = duration_ms(edits) / 1000.0
        print("expected_duration_sec", round(expected_sec, 3))

        reframe_jid = "job_" + uuid.uuid4().hex[:12]
        with psycopg2.connect(dsn) as conn:
            with conn.cursor() as cur:
                cur.execute("UPDATE clips SET edits = %s::jsonb WHERE id = %s", (json.dumps(edits), CLIP_ID))
                cur.execute(
                    """
                    INSERT INTO clip_jobs (id, "projectId", "clipId", type, status, payload, "createdAt", "runAfter")
                    VALUES (%s, %s, %s, 'REFRAME_CROP', 'QUEUED', '{}'::jsonb, NOW(), NOW())
                    """,
                    (reframe_jid, clip["projectId"], CLIP_ID),
                )
                print("queued REFRAME_CROP", reframe_jid)
            conn.commit()
        for _ in range(180):
            time.sleep(5)
            with psycopg2.connect(dsn) as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT status, error FROM clip_jobs WHERE id = %s", (reframe_jid,))
                    row = cur.fetchone()
                    if row and row[0] == "DONE":
                        break
                    if row and row[0] == "FAILED":
                        print("REFRAME_FAILED", row[1])
                        return 1
        else:
            print("REFRAME_TIMEOUT")
            return 1

        crop_key = f"ws/{clip['workspaceId']}/projects/{clip['projectId']}/clips/{CLIP_ID}/crop_track.json"
        crop_path = td_path / "crop_track.json"
        download_object(crop_key, crop_path)
        track = json.loads(crop_path.read_text())
        print("crop_track x0[:10]", track["x0"][:10])
        print("crop_track x0_A[:10]", track["x0_A"][:10])
        print("crop_track x0_B[:10]", track["x0_B"][:10])

        h = edits_version_hash(edits)
        render_id = "rnd_" + uuid.uuid4().hex[:12]
        job_id = "job_" + uuid.uuid4().hex[:12]
        with psycopg2.connect(dsn) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO clip_renders (id, "clipId", "workspaceId", status, resolution, watermark, filename,
                      "editsVersionHash", "expiresAt", "createdAt", "updatedAt")
                    VALUES (%s, %s, %s, 'QUEUED', '720p', false, 'build-check.mp4', %s, NOW() + interval '7 days', NOW(), NOW())
                    """,
                    (render_id, CLIP_ID, clip["workspaceId"], h),
                )
                cur.execute(
                    """
                    INSERT INTO clip_jobs (id, "projectId", "clipId", type, status, payload, "createdAt", "runAfter")
                    VALUES (%s, %s, %s, 'RENDER_CLIP', 'QUEUED', %s::jsonb, NOW(), NOW())
                    """,
                    (job_id, clip["projectId"], CLIP_ID, json.dumps({"renderId": render_id})),
                )
            conn.commit()
        print("queued_render", render_id, job_id)

        out_key = None
        for _ in range(180):
            time.sleep(5)
            with psycopg2.connect(dsn) as conn:
                with conn.cursor() as cur:
                    cur.execute('SELECT status, "outputKey", error FROM clip_renders WHERE id = %s', (render_id,))
                    st, k, err = cur.fetchone()
                    if st == "READY" and k:
                        out_key = k
                        break
                    if st == "FAILED":
                        print("RENDER_FAILED", err)
                        return 1
        if not out_key:
            print("RENDER_TIMEOUT")
            return 1

        mp4 = td_path / "out.mp4"
        download_object(out_key, mp4)
        dur = probe_duration(mp4)
        print("output_duration_sec", round(dur, 3), "delta_sec", round(abs(dur - expected_sec), 3))

        remapped, _ = words_after_edits(words, edits)
        srt = build_srt(remapped)
        print("--- SRT around earliest ---")
        print(srt_snippet(srt, "earliest"))
        print("--- SRT around comic / TESTWORD ---")
        print(srt_snippet(srt, "TESTWORD"))
        print("comic_in_srt", "comic" in srt.lower())
        print("memory?_in_srt", "memory" in srt.lower())
        print("TESTWORD_in_srt", "TESTWORD" in srt)
        print("actually_in_srt", "actually" in srt.lower())
        return 0


if __name__ == "__main__":
    sys.exit(main())
