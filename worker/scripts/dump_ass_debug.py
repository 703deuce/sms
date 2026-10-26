#!/usr/bin/env python3
"""Dump ASS for a clip (run inside clips-worker container)."""
from __future__ import annotations

import json
import os
import sys
import tempfile
from pathlib import Path

import psycopg2
from psycopg2.extras import RealDictCursor

from clips_worker.captions_ass import build_ass
from clips_worker.edits_render import normalize_edits, words_after_edits
from clips_worker.render_job import load_source_words


def main() -> None:
    clip_id = sys.argv[1] if len(sys.argv) > 1 else "clip_62345181d555491ca5a2565ab770939b"
    preset_override = sys.argv[2] if len(sys.argv) > 2 else "boxed"
    out_path = Path(sys.argv[3] if len(sys.argv) > 3 else "/tmp/debug_clip.ass")

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT c.id, c.edits, c."startMs", c."endMs", c."projectId",
                   p."transcriptKey", p."transcriptWords", p.settings,
                   u.key AS source_key
            FROM clips c
            JOIN clip_projects p ON p.id = c."projectId"
            LEFT JOIN clip_uploads u ON u.id = p."uploadId"
            WHERE c.id = %s
            """,
            (clip_id,),
        )
        row = cur.fetchone()
    if not row:
        raise SystemExit(f"clip not found: {clip_id}")

    clip_start = int(row["startMs"])
    clip_end = int(row["endMs"])
    edits = normalize_edits(row["edits"], clip_start, clip_end)
    cap = dict(edits.get("captions") or {})
    cap["presetId"] = preset_override
    edits["captions"] = cap

    with tempfile.TemporaryDirectory() as td:
        ctx = dict(row)
        ctx["clipId"] = clip_id
        ctx["workspaceId"] = ""
        words = load_source_words(ctx, Path(td))

    remapped, _ = words_after_edits(words, edits)
    build_ass(remapped, cap, out_path, play_w=720, play_h=1280)
    print(out_path)
    text = out_path.read_text()
    print("---ASS_HEAD---")
    print("\n".join(text.splitlines()[:25]))
    print("---DIALOGUE---")
    for line in text.splitlines():
        if line.startswith("Dialogue:"):
            print(line)
            if sum(1 for _ in []) > 5:
                pass
    dlg = [l for l in text.splitlines() if l.startswith("Dialogue:")]
    print(f"dialogue_count={len(dlg)}")


if __name__ == "__main__":
    main()
