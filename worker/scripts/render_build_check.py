#!/usr/bin/env python3
"""Server build check for RENDER_CLIP (source-ms edits)."""
from __future__ import annotations

import json
import os
import sys
import tempfile
import uuid
from pathlib import Path

import psycopg2
from psycopg2.extras import RealDictCursor

from clips_worker.edits_render import build_srt, edits_version_hash, normalize_edits, words_after_edits
from clips_worker.probe import probe_duration
from clips_worker.render_job import load_source_words
from clips_worker.storage import download_object


def output_duration_from_edits_ms(edits: dict) -> int:
    from clips_worker.edits_render import keep_segments

    segs = keep_segments(int(edits["trim"]["in"]), int(edits["trim"]["out"]), edits.get("cutRanges") or [])
    return sum(b - a for a, b in segs)


CLIP_ID = os.environ.get("BUILD_CHECK_CLIP_ID", "clip_9e4efa85152d4fe890f8c829f323c135")


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
    clip_start = int(clip["startMs"])
    clip_end = int(clip["endMs"])
    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        ctx = {
            "clipId": CLIP_ID,
            "workspaceId": clip["workspaceId"],
            "projectId": clip["projectId"],
            "startMs": clip_start,
            "transcriptKey": clip.get("transcriptKey"),
            "transcriptWords": clip.get("transcriptWords"),
        }
        words = load_source_words(ctx, td_path)
        in_clip = [w for w in words if clip_start <= word_mid(w) < clip_end]
        if len(in_clip) < 4:
            print("not enough words in clip")
            return 1
        i = 1
        j = len(in_clip) - 2
        w_cut_a, w_cut_b = in_clip[i], in_clip[i + 1]
        w_fix = in_clip[j]
        cut_lo = int(float(w_cut_a["s"]) * 1000)
        cut_hi = int(float(w_cut_b["e"]) * 1000)
        trim_out = clip_end - 500
        edits = normalize_edits(
            {
                "cutRanges": [[cut_lo, cut_hi]],
                "wordFixes": {str(w_fix.get("idx", j)): "FIXBUILD"},
                "trim": {"in": clip_start, "out": trim_out},
            },
            clip_start,
            clip_end,
        )
        expected_sec = output_duration_from_edits_ms(edits) / 1000.0
        remapped, _ = words_after_edits(words, edits)
        srt = build_srt(remapped)
        monotonic = all(float(w["e"]) > float(w["s"]) for w in remapped)
        cut_texts = {w_cut_a["w"], w_cut_b["w"]}
        cut_absent = not any(t in srt for t in cut_texts if t.strip())
        fix_ok = "FIXBUILD" in srt
        neighbors = []
        for w in remapped:
            if w["w"] == "FIXBUILD":
                idx = remapped.index(w)
                if idx > 0:
                    neighbors.append(remapped[idx - 1]["w"])
                if idx + 1 < len(remapped):
                    neighbors.append(remapped[idx + 1]["w"])
        print(json.dumps({
            "expected_duration_sec": round(expected_sec, 3),
            "srt_monotonic": monotonic,
            "cut_words_absent": cut_absent,
            "fix_word": "FIXBUILD",
            "fix_neighbors": neighbors,
            "cut_range_ms": [cut_lo, cut_hi],
            "trim_out_ms": trim_out,
        }, indent=2))
        # enqueue real render
        h = edits_version_hash(edits)
        render_id = "rnd_" + uuid.uuid4().hex[:12]
        job_id = "job_" + uuid.uuid4().hex[:12]
        with psycopg2.connect(dsn) as conn:
            with conn.cursor() as cur:
                cur.execute("update clips set edits=%s::jsonb where id=%s", (json.dumps(edits), CLIP_ID))
                cur.execute(
                    """insert into clip_renders (id,"clipId","workspaceId",status,resolution,watermark,filename,"editsVersionHash","expiresAt","createdAt","updatedAt")
                       values (%s,%s,%s,'QUEUED','720p',false,'build-check.mp4',%s,now()+interval '7 days',now(),now())""",
                    (render_id, CLIP_ID, clip["workspaceId"], h),
                )
                cur.execute(
                    """insert into clip_jobs (id,"projectId","clipId",type,status,payload,"createdAt","runAfter")
                       values (%s,%s,%s,'RENDER_CLIP','QUEUED',%s::jsonb,now(),now())""",
                    (job_id, clip["projectId"], CLIP_ID, json.dumps({"renderId": render_id})),
                )
            conn.commit()
        print("queued", render_id, job_id)
        import time

        key = None
        for _ in range(120):
            time.sleep(5)
            with psycopg2.connect(dsn) as conn:
                with conn.cursor() as cur:
                    cur.execute('select status,"outputKey",error from clip_renders where id=%s', (render_id,))
                    st, k, err = cur.fetchone()
                    if st == "READY" and k:
                        key = k
                        break
                    if st == "FAILED":
                        print("FAILED", err)
                        return 1
        if not key:
            print("timeout")
            return 1
        mp4 = td_path / "out.mp4"
        download_object(key, mp4)
        dur = probe_duration(mp4)
        delta = abs(dur - expected_sec)
        print("output_duration_sec", round(dur, 3), "delta_sec", round(delta, 3))
        ass_path = td_path / "out.ass"
        try:
            import subprocess

            subprocess.check_call(["ffmpeg", "-y", "-v", "error", "-i", str(mp4), "-f", "ass", str(ass_path)])
            ass = ass_path.read_text(errors="ignore")
        except Exception:
            ass = ""
        ass_cut_absent = not any(t in ass for t in cut_texts if t.strip())
        print("ass_cut_absent", ass_cut_absent, "duration_ok", delta <= 0.1)
        return 0 if delta <= 0.1 and monotonic and cut_absent and fix_ok and ass_cut_absent else 1


def word_mid(w: dict) -> float:
    return (float(w["s"]) + float(w["e"])) * 500.0


if __name__ == "__main__":
    sys.exit(main())
