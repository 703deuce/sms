"""THUMBNAIL job: sample frames → Gemini → Kie Nano Banana (3 variants)."""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import tempfile
import uuid
from pathlib import Path

from clips_worker.frame_sampler import sample_frames
from clips_worker.gemini_vision import plan_thumbnail
from clips_worker.kie_image import create_image_task, upload_jpeg
from clips_worker.render_job import load_render_context, load_source_words
from clips_worker.edits_render import normalize_edits, render_edited_clip
from clips_worker.render_clip import ffmpeg_cut
from clips_worker.storage import download_object


def sign_generation(generation_id: str) -> str:
    secret = os.environ.get("KIE_CALLBACK_SECRET", "").strip()
    if not secret:
        raise RuntimeError("KIE_CALLBACK_SECRET missing")
    return hmac.new(secret.encode(), generation_id.encode(), hashlib.sha256).hexdigest()


def run_thumbnail_job(conn, job: dict, post_progress) -> None:
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    clip_id = payload.get("clipId") or job.get("clipId")
    aspect = payload.get("aspect") or "9:16"
    title_override = payload.get("titleOverride")
    if aspect not in ("9:16", "16:9"):
        aspect = "9:16"

    with conn.cursor() as cur:
        cur.execute(
            'SELECT c.id, c."projectId", c."workspaceId", c.title, c."startMs", c."endMs", c.edits, p.settings, p."transcriptKey", p."transcriptWords", u.key AS source_key FROM clips c JOIN clip_projects p ON p.id=c."projectId" LEFT JOIN clip_uploads u ON u.id=p."uploadId" WHERE c.id=%s',
            (clip_id,),
        )
        row = cur.fetchone()
    if not row:
        raise RuntimeError("clip not found")
    clip_id, project_id, workspace_id, title, start_ms, end_ms, edits, settings, tkey, twords, source_key = row
    clip_start, clip_end = int(start_ms), int(end_ms)
    edits = normalize_edits(edits, clip_start, clip_end)
    settings = settings if isinstance(settings, dict) else json.loads(settings or "{}")

    post_progress(job["id"], {"jobStatus": "RUNNING", "stage": "thumbnail", "progress": 10})

    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        if not source_key:
            raise RuntimeError("missing source")
        src = td_path / "source.mp4"
        download_object(source_key, src)
        clip_file = td_path / "clip.mp4"
        ffmpeg_cut(src, clip_file, clip_start, clip_end)
        words = load_source_words(
            {
                "clipId": clip_id,
                "workspaceId": workspace_id,
                "projectId": project_id,
                "startMs": clip_start,
                "transcriptKey": tkey,
                "transcriptWords": twords,
            },
            td_path,
        )
        out_mp4 = td_path / "edited.mp4"
        render_edited_clip(
            clip_file,
            out_mp4,
            words,
            edits,
            clip_start,
            clip_end,
            {**settings, "captions": {"enabled": False}},
            td_path,
            broll_specs=None,
            audio_assets=None,
        )
        from clips_worker.probe import probe_duration

        dur = probe_duration(out_mp4)
        frames = sample_frames(out_mp4, td_path / "frames", duration_s=dur)
        transcript = " ".join(w.get("w", "") for w in words[:80])
        plan = plan_thumbnail(frames, transcript, title, title_override)
        best_i = int(plan["bestFrameIndexes"][0])
        ref = frames[min(best_i, len(frames) - 1)]["jpeg"]
        source_ms = int(best_i * (dur / max(len(frames), 1)) * 1000)
        image_url = upload_jpeg(ref, workspace_id, "thumb-ref")
        app_url = os.environ["APP_URL"].rstrip("/")

        for i, prompt in enumerate(plan["prompts"][:3]):
            gen_id = f"gen_{uuid.uuid4().hex}"
            thumb_id = f"th_{uuid.uuid4().hex[:12]}"
            sig = sign_generation(gen_id)
            callback = f"{app_url}/api/clips/kie/callback?g={gen_id}&s={sig}"
            task_id = create_image_task(prompt, [image_url], aspect, callback)
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO ai_generations (id, "workspaceId", "clipId", kind, status, provider, "providerTaskId", prompt, params, "createdAt", "updatedAt")
                    VALUES (%s,%s,%s,'THUMBNAIL','RUNNING','kie',%s,%s,%s::jsonb,NOW(),NOW())
                    """,
                    (
                        gen_id,
                        workspace_id,
                        clip_id,
                        task_id,
                        prompt,
                        json.dumps({"aspect": aspect, "variant": i, "sourceFrameMs": source_ms}),
                    ),
                )
                cur.execute(
                    """
                    INSERT INTO clip_thumbnails (id, "workspaceId", "clipId", "generationId", aspect, "sourceFrameMs", prompt, "titleText", picked, "createdAt")
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,false,NOW())
                    """,
                    (thumb_id, workspace_id, clip_id, gen_id, aspect, source_ms, prompt, plan.get("titleText")),
                )
            conn.commit()
    post_progress(job["id"], {"jobStatus": "DONE", "stage": "ready", "progress": 100})
