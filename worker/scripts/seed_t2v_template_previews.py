#!/usr/bin/env python3
"""Render T2V template gallery previews via the real assemble/finalize pipeline.

Run from repo root (requires ffmpeg, DATABASE_URL, clip storage env):
  PYTHONPATH=worker python worker/scripts/seed_t2v_template_previews.py [--force]

Skips templates that already have previewKey unless --force.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import psycopg2
from psycopg2.extras import RealDictCursor

from clips_worker.render_clip import aspect_size
from clips_worker.storage import upload_file
from clips_worker.t2v.assemble import Scene, SceneMedia, assemble
from clips_worker.t2v.render_finalize import finalize_t2v_video


def _vo_clip(path: Path, seconds: float = 2.0) -> None:
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            f"sine=f=440:d={seconds}",
            "-ar",
            "48000",
            "-ac",
            "1",
            str(path),
        ],
        check=True,
    )


def _thumb_from_video(video: Path, thumb: Path) -> None:
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-i", str(video), "-vframes", "1", "-q:v", "4", str(thumb)],
        check=True,
    )


def _sample_document(template: dict) -> dict:
    settings = template.get("settings") or {}
    if isinstance(settings, str):
        settings = json.loads(settings)
    inner = settings.get("settings") or settings
    aspect = template.get("aspect") or inner.get("aspect") or "16:9"
    script = (template.get("sampleScript") or "A quick template preview.").strip()
    hook, rest = (script.split(".", 1) + [""])[:2]
    return {
        "settings": {"aspect": aspect, "brand": {"primaryColor": "#FACC15", "secondaryColor": "#D0D0D0"}},
        "scenes": [
            {
                "slot": 0,
                "texts": [
                    {
                        "kind": "title",
                        "text": hook.strip() or "Preview",
                        "startMs": 0,
                        "endMs": 1800,
                        "animation": "fade",
                    }
                ],
            },
            {
                "slot": 1,
                "texts": [
                    {
                        "kind": "subtitle",
                        "text": (rest or script).strip()[:120],
                        "startMs": 0,
                        "endMs": 2000,
                        "animation": "fade",
                    }
                ],
            },
        ],
    }


def render_template_preview(template: dict, out_mp4: Path) -> None:
    aspect = template["aspect"]
    w, h = aspect_size(aspect, "720p")
    document = _sample_document(template)
    with tempfile.TemporaryDirectory(prefix="t2v-tmpl-") as td:
        work = Path(td)
        vo = work / "vo.wav"
        _vo_clip(vo, 2.0)
        scenes = [
            Scene("a", 2.0, SceneMedia("color", color="0x1a1a2e"), "fade", 0.5, vo),
            Scene("b", 2.0, SceneMedia("color", color="0x16213e"), "fade", 0.5, None),
        ]
        asm = assemble(scenes, work / "asm", w=w, h=h, fps=24)
        finalize_t2v_video(
            asm["source"],
            out_mp4,
            document=document,
            scene_starts_ms=asm["sceneStartsMs"],
            w=w,
            h=h,
            work_dir=work / "post",
            workspace_id="",
            skip_brand_bookends=True,
        )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="Re-render even when previewKey exists")
    args = parser.parse_args()
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        print("DATABASE_URL required", file=sys.stderr)
        return 1

    conn = psycopg2.connect(dsn)
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, aspect, "previewKey", "thumbKey", settings, "sampleScript"
                FROM t2v_templates
                WHERE "workspaceId" IS NULL AND "isPublished" = true
                ORDER BY "sortOrder" ASC
                """
            )
            rows = list(cur.fetchall())
        done = 0
        for row in rows:
            preview_key = row.get("previewKey") or f"stock/t2v-templates/{row['id']}-preview.mp4"
            thumb_key = row.get("thumbKey") or f"stock/t2v-templates/{row['id']}-thumb.jpg"
            if not args.force and row.get("previewKey"):
                print(f"skip {row['id']} (previewKey set)")
                continue
            with tempfile.TemporaryDirectory(prefix="t2v-prev-") as td:
                mp4 = Path(td) / "preview.mp4"
                jpg = Path(td) / "thumb.jpg"
                render_template_preview(row, mp4)
                _thumb_from_video(mp4, jpg)
                upload_file(preview_key, mp4, "video/mp4")
                upload_file(thumb_key, jpg, "image/jpeg")
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE t2v_templates
                    SET "previewKey"=%s, "thumbKey"=%s, "updatedAt"=NOW()
                    WHERE id=%s
                    """,
                    (preview_key, thumb_key, row["id"]),
                )
            conn.commit()
            done += 1
            print(f"rendered {row['id']}")
        print(f"Done: {done} template previews")
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
