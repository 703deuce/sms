"""M4 pipeline: find clips, reframe, render, persist."""
from __future__ import annotations

import json
import subprocess
import tempfile
import uuid
from pathlib import Path

from clips_worker.anything_picker import pick_anything_clips
from clips_worker.picker import pick_talking_clips
from clips_worker.render_clip import ffmpeg_cut, poster_jpg, run_speakercrop, slice_words
from clips_worker.storage import download_object, put_json, upload_file


def clip_keys(workspace_id: str, project_id: str, clip_id: str) -> dict[str, str]:
    base = f"ws/{workspace_id}/projects/{project_id}/clips/{clip_id}"
    return {
        "preview": f"{base}/preview.mp4",
        "poster": f"{base}/poster.jpg",
        "words": f"{base}/words.json",
        "crop_track": f"{base}/crop_track.json",
    }


def insert_clips_batch(conn, rows: list[dict]) -> None:
    if not rows:
        return
    with conn.cursor() as cur:
        for row in rows:
            cur.execute(
                """
                INSERT INTO clips (
                  id, "projectId", "workspaceId", title, reason,
                  "startMs", "endMs", score, scores,
                  "previewKey", "posterKey", "wordsKey", edits, "aiMeta",
                  favorite, "createdAt", "updatedAt"
                ) VALUES (
                  %s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s,%s,%s,%s::jsonb,%s::jsonb,false,NOW(),NOW()
                )
                ON CONFLICT (id) DO NOTHING
                """,
                (
                    row["id"],
                    row["projectId"],
                    row["workspaceId"],
                    row["title"],
                    row.get("reason"),
                    row["startMs"],
                    row["endMs"],
                    row["score"],
                    json.dumps(row.get("scores") or {}),
                    row.get("previewKey"),
                    row.get("posterKey"),
                    row.get("wordsKey"),
                    json.dumps(row.get("edits") or {}),
                    json.dumps(row.get("aiMeta") or {}),
                ),
            )
    conn.commit()


def mark_project_ready(conn, project_id: str, error: str | None = None) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE clip_projects
            SET status = 'READY', stage = 'ready', progress = 100, error = %s, "updatedAt" = NOW()
            WHERE id = %s
            """,
            (error, project_id),
        )
    conn.commit()


def run_m4_pipeline(
    conn,
    job_id: str,
    project: dict,
    words: list[dict],
    source_key: str,
    post_progress,
) -> None:
    settings = project.get("settings") or {}
    if isinstance(settings, str):
        settings = json.loads(settings)
    workspace_id = project["workspaceId"]
    project_id = project["id"]
    range_start = int(project.get("rangeStartMs") or 0)
    range_end = int(project.get("rangeEndMs") or 0)

    mode = settings.get("mode") or "talking"
    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        src = td_path / "source.mp4"
        download_object(source_key, src)
        audio_wav = td_path / "audio.wav"
        subprocess.check_call(
            ["ffmpeg", "-y", "-v", "error", "-i", str(src), "-ac", "1", "-ar", "16000", str(audio_wav)],
        )
        if mode == "anything":
            post_progress(
                job_id,
                {"projectStatus": "SCANNING", "stage": "scanning", "progress": 55, "jobStatus": "RUNNING"},
            )
            picks, picker_message = pick_anything_clips(
                conn,
                src,
                words,
                settings,
                range_start,
                range_end,
                workspace_id,
                project_id,
                td_path,
            )
            post_progress(
                job_id,
                {"projectStatus": "FINDING_CLIPS", "stage": "vision_rank", "progress": 58, "jobStatus": "RUNNING"},
            )
        else:
            post_progress(
                job_id,
                {"projectStatus": "FINDING_CLIPS", "stage": "finding_clips", "progress": 52, "jobStatus": "RUNNING"},
            )
            post_progress(job_id, {"projectStatus": "FINDING_CLIPS", "stage": "picker_pass1", "progress": 52, "jobStatus": "RUNNING"})
            picks, picker_message = pick_talking_clips(words, str(audio_wav), settings, range_start, range_end)
            post_progress(job_id, {"projectStatus": "FINDING_CLIPS", "stage": "picker_done", "progress": 55, "jobStatus": "RUNNING"})

        if not picks:
            empty_msg = picker_message or "No complete, self-contained moments found."
            mark_project_ready(conn, project_id, error=empty_msg)
            post_progress(
                job_id,
                {
                    "projectStatus": "READY",
                    "stage": "ready",
                    "progress": 100,
                    "jobStatus": "DONE",
                    "error": empty_msg,
                },
            )
            return

        total = max(1, len(picks))
        clip_rows: list[dict] = []
        for idx, pick in enumerate(picks):
            post_progress(
                job_id,
                {
                    "projectStatus": "REFRAMING",
                    "stage": f"reframe_{idx + 1}_of_{total}",
                    "progress": 55 + int(30 * idx / total),
                    "jobStatus": "RUNNING",
                },
            )
            clip_id = f"clip_{uuid.uuid4().hex}"
            clip_file = td_path / f"clip_{idx}.mp4"
            ffmpeg_cut(src, clip_file, pick["start_ms"], pick["end_ms"])
            clip_words = slice_words(words, pick["start_ms"], pick["end_ms"])
            words_path = td_path / f"words_{idx}.json"
            words_path.write_text(json.dumps(clip_words))

            out_mp4 = td_path / f"out_{idx}.mp4"
            crop_track_path = td_path / f"crop_track_{idx}.json"
            reframe_settings = dict(settings)
            ai_meta = pick.get("aiMeta") or {}
            if mode == "anything":
                from clips_worker.subject_reframe import (
                    has_face_and_speech,
                    write_motion_crop_track,
                )

                clip_words = json.loads(words_path.read_text())
                if has_face_and_speech(clip_file, clip_words):
                    rendered = run_speakercrop(
                        clip_file,
                        out_mp4,
                        words_path,
                        reframe_settings,
                        td_path,
                        clip_start_ms=pick["start_ms"],
                        crop_track_out=crop_track_path,
                    )
                else:
                    wide = write_motion_crop_track(
                        clip_file,
                        crop_track_path,
                        ai_meta,
                        pick["start_ms"],
                        td_path / f"motion_{idx}",
                    )
                    if wide:
                        reframe_settings["layout"] = "fit"
                    rendered = run_speakercrop(
                        clip_file,
                        out_mp4,
                        words_path,
                        reframe_settings,
                        td_path,
                        clip_start_ms=pick["start_ms"],
                        crop_track_out=crop_track_path,
                    )
                    if crop_track_path.exists() and not wide:
                        write_motion_crop_track(
                            clip_file,
                            crop_track_path,
                            ai_meta,
                            pick["start_ms"],
                            td_path / f"motion_{idx}",
                        )
            else:
                rendered = run_speakercrop(
                    clip_file,
                    out_mp4,
                    words_path,
                    reframe_settings,
                    td_path,
                    clip_start_ms=pick["start_ms"],
                    crop_track_out=crop_track_path,
                )
            poster = td_path / f"poster_{idx}.jpg"
            poster_jpg(rendered, poster)

            keys = clip_keys(workspace_id, project_id, clip_id)
            upload_file(keys["preview"], rendered, "video/mp4")
            upload_file(keys["poster"], poster, "image/jpeg")
            put_json(keys["words"], clip_words)
            if crop_track_path.exists():
                upload_file(keys["crop_track"], crop_track_path, "application/json")

            clip_rows.append(
                {
                    "id": clip_id,
                    "projectId": project_id,
                    "workspaceId": workspace_id,
                    "title": pick["title"],
                    "reason": pick.get("reason") or pick.get("hook"),
                    "startMs": pick["start_ms"],
                    "endMs": pick["end_ms"],
                    "score": pick["score"],
                    "scores": pick.get("scores") or {},
                    "previewKey": keys["preview"],
                    "posterKey": keys["poster"],
                    "wordsKey": keys["words"],
                    "edits": {"captions": settings.get("captions", {})},
                    "aiMeta": pick.get("aiMeta") or {"hook": pick.get("hook")},
                }
            )
            post_progress(
                job_id,
                {
                    "projectStatus": "RENDERING",
                    "stage": f"render_{idx + 1}_of_{total}",
                    "progress": 85 + int(14 * (idx + 1) / total),
                    "jobStatus": "RUNNING",
                },
            )

        insert_clips_batch(conn, clip_rows)
        mark_project_ready(conn, project_id)
        post_progress(
            job_id,
            {"projectStatus": "READY", "stage": "ready", "progress": 100, "jobStatus": "DONE", "error": None},
        )
