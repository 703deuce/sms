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

CATEGORY_STYLE: dict[str, dict[str, str]] = {
    "explainer": {"bg1": "0x0f172a", "bg2": "0x1e3a8a", "primary": "#F8FAFC", "muted": "#93C5FD", "font": "DejaVu Sans"},
    "listicle": {"bg1": "0x1a0533", "bg2": "0x7c3aed", "primary": "#FDE047", "muted": "#E9D5FF", "font": "DejaVu Sans"},
    "promo": {"bg1": "0x450a0a", "bg2": "0xdc2626", "primary": "#FFFFFF", "muted": "#FECACA", "font": "DejaVu Sans"},
    "news": {"bg1": "0x111827", "bg2": "0x374151", "primary": "#F9FAFB", "muted": "#9CA3AF", "font": "DejaVu Sans"},
    "tutorial": {"bg1": "0x064e3b", "bg2": "0x059669", "primary": "#ECFDF5", "muted": "#6EE7B7", "font": "DejaVu Sans"},
    "quote": {"bg1": "0x18181b", "bg2": "0x3f3f46", "primary": "#FAFAFA", "muted": "#A1A1AA", "font": "DejaVu Serif"},
    "story": {"bg1": "0x312e81", "bg2": "0x6366f1", "primary": "#EEF2FF", "muted": "#C7D2FE", "font": "DejaVu Sans"},
}


def _vo_clip(path: Path, seconds: float = 2.2) -> None:
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            f"sine=f=523:d={seconds}",
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
    category = str(template.get("category") or "explainer")
    style = CATEGORY_STYLE.get(category, CATEGORY_STYLE["explainer"])
    tone = str(inner.get("tone") or category)
    captions = inner.get("captionsEnabled", True)
    script = (template.get("sampleScript") or "Hook fast. Deliver value. End with a clear next step.").strip()
    parts = [p.strip() for p in script.replace("!", ".").split(".") if p.strip()]
    hook = parts[0] if parts else template.get("name", "Preview")
    body = ". ".join(parts[1:3]) if len(parts) > 1 else script
    return {
        "settings": {
            "aspect": aspect,
            "tone": tone,
            "captions": {"enabled": captions, "presetId": "bold_pop", "burnIn": True},
            "brand": {
                "primaryColor": style["primary"],
                "secondaryColor": style["muted"],
                "fontFamily": style["font"],
                "titleFont": style["font"],
            },
        },
        "scenes": [
            {
                "slot": 0,
                "texts": [
                    {
                        "kind": "title",
                        "text": hook[:80],
                        "startMs": 0,
                        "endMs": 2000,
                        "animation": "fade",
                    }
                ],
            },
            {
                "slot": 1,
                "texts": [
                    {
                        "kind": "lower_third",
                        "text": str(template.get("name") or "Template"),
                        "subtitle": body[:100],
                        "startMs": 0,
                        "endMs": 2400,
                        "animation": "fade",
                    }
                ],
            },
            {
                "slot": 2,
                "texts": [
                    {
                        "kind": "title",
                        "text": tone.capitalize(),
                        "subtitle": aspect,
                        "startMs": 0,
                        "endMs": 1600,
                        "animation": "slide_up",
                    }
                ],
            },
        ],
    }


def render_template_preview(template: dict, out_mp4: Path) -> None:
    aspect = template["aspect"]
    w, h = aspect_size(aspect, "720p")
    document = _sample_document(template)
    category = str(template.get("category") or "explainer")
    style = CATEGORY_STYLE.get(category, CATEGORY_STYLE["explainer"])
    patch = template.get("settings") or {}
    if isinstance(patch, str):
        patch = json.loads(patch)
    trans_ms = int((patch.get("defaultTransitions") or {}).get("transitionMs") or 500)
    trans_s = trans_ms / 1000.0
    with tempfile.TemporaryDirectory(prefix="t2v-tmpl-") as td:
        work = Path(td)
        vo = work / "vo.wav"
        _vo_clip(vo, 2.2)
        scenes = [
            Scene("a", 2.2, SceneMedia("color", color=style["bg1"]), "fade", trans_s, vo),
            Scene("b", 2.4, SceneMedia("color", color=style["bg2"]), "fade", trans_s, None),
            Scene("c", 1.8, SceneMedia("color", color=style["bg1"]), "fade", trans_s, None),
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
                SELECT id, name, category, aspect, "previewKey", "thumbKey", settings, "sampleScript"
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
