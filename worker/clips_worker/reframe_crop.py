"""Regenerate crop_track.json for an existing clip."""
from __future__ import annotations

import json
import tempfile
from pathlib import Path

from psycopg2.extras import RealDictCursor

from clips_worker.render_clip import ffmpeg_cut, run_speakercrop, slice_words
from clips_worker.storage import download_object, upload_file


def crop_track_key(workspace_id: str, project_id: str, clip_id: str) -> str:
    return f"ws/{workspace_id}/projects/{project_id}/clips/{clip_id}/crop_track.json"


def run_reframe_crop_job(conn, job: dict) -> None:
    clip_id = job.get("clipId")
    if not clip_id:
        raise RuntimeError("missing clipId")
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT c.id, c."startMs", c."endMs", c."projectId", c."workspaceId",
                   p.settings, p."transcriptKey", p."transcriptWords", u.key AS source_key
            FROM clips c
            JOIN clip_projects p ON p.id = c."projectId"
            LEFT JOIN clip_uploads u ON u.id = p."uploadId"
            WHERE c.id = %s
            """,
            (clip_id,),
        )
        clip = cur.fetchone()
    if not clip:
        raise RuntimeError("clip not found")
    clip = dict(clip)
    settings = clip.get("settings") or {}
    if isinstance(settings, str):
        settings = json.loads(settings)
    source_key = clip.get("source_key")
    if not source_key:
        raise RuntimeError("missing source")

    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        src = td_path / "source.mp4"
        download_object(source_key, src)
        clip_file = td_path / "clip.mp4"
        ffmpeg_cut(src, clip_file, int(clip["startMs"]), int(clip["endMs"]))
        words: list[dict] = []
        if clip.get("transcriptKey"):
            tp = td_path / "transcript.json"
            download_object(clip["transcriptKey"], tp)
            words = json.loads(tp.read_text())
        elif clip.get("transcriptWords"):
            tw = clip["transcriptWords"]
            if isinstance(tw, str):
                tw = json.loads(tw)
            words = list(tw) if isinstance(tw, list) else []
        for pos, w in enumerate(words):
            if "i" not in w:
                w["i"] = w.get("idx", pos)
        clip_words = slice_words(words, int(clip["startMs"]), int(clip["endMs"]))
        words_path = td_path / "words.json"
        words_path.write_text(json.dumps(clip_words))
        crop_out = td_path / "crop_track.json"
        dummy = td_path / "noop.mp4"
        run_speakercrop(
            clip_file,
            dummy,
            words_path,
            settings,
            td_path,
            clip_start_ms=int(clip["startMs"]),
            crop_track_out=crop_out,
            no_render=True,
        )
        key = crop_track_key(clip["workspaceId"], clip["projectId"], clip_id)
        upload_file(key, crop_out, "application/json")

    with conn.cursor() as cur:
        cur.execute(
            "UPDATE clip_jobs SET status = %s, \"finishedAt\" = NOW(), error = NULL WHERE id = %s",
            ("DONE", job["id"]),
        )
    conn.commit()
