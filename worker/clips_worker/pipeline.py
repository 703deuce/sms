"""M4 pipeline: find clips, reframe, render, persist."""
from __future__ import annotations

import json
import subprocess
import tempfile
import uuid
from pathlib import Path

from clips_worker.anything_picker import pick_anything_clips
from clips_worker.picker import pick_talking_clips
from clips_worker.bounded_pool import run_bounded_indexed_pool
from clips_worker.render_clip import ffmpeg_cut, poster_jpg, run_speakercrop, slice_words
from clips_worker.render_concurrency import clips_render_concurrency
from clips_worker.probe import probe_duration
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
                  "previewKey", "posterKey", "wordsKey", "cropKey", edits, "aiMeta",
                  favorite, "createdAt", "updatedAt"
                ) VALUES (
                  %s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s,%s,%s,%s,%s::jsonb,%s::jsonb,false,NOW(),NOW()
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
                    row.get("cropKey"),
                    json.dumps(row.get("edits") or {}),
                    json.dumps(row.get("aiMeta") or {}),
                ),
            )
    conn.commit()


def write_fit_blur_crop_track(video: Path, crop_out: Path, clip_start_ms: int) -> None:
    """Static wide crop track (x0=-1) for fit-blur fallback."""
    import subprocess as sp

    out = sp.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height,r_frame_rate",
            "-of",
            "json",
            str(video),
        ],
        text=True,
    )
    data = json.loads(out)["streams"][0]
    w, h = int(data["width"]), int(data["height"])
    fps_s = str(data.get("r_frame_rate", "30/1"))
    if "/" in fps_s:
        a, b = fps_s.split("/")
        fps = float(a) / max(1.0, float(b))
    else:
        fps = float(fps_s)
    dur_ms = int(
        float(
            sp.check_output(
                [
                    "ffprobe",
                    "-v",
                    "error",
                    "-show_entries",
                    "format=duration",
                    "-of",
                    "default=noprint_wrappers=1:nokey=1",
                    str(video),
                ],
                text=True,
            ).strip()
        )
        * 1000
    )
    n = max(1, int(dur_ms / 1000 * fps))
    track = {
        "v": 1,
        "W": w,
        "H": h,
        "cw": w,
        "fps": fps,
        "t0_ms": clip_start_ms,
        "x0": [-1] * n,
        "x0_A": [-1] * n,
        "x0_B": [-1] * n,
        "shots": [{"start_ms": clip_start_ms, "end_ms": clip_start_ms + dur_ms, "spk": "A"}],
    }
    crop_out.write_text(json.dumps(track, separators=(",", ":")))


def reframe_clip_preview(
    clip_file: Path,
    out_mp4: Path,
    words_path: Path,
    settings: dict,
    work_dir: Path,
    clip_start_ms: int,
    crop_track_path: Path,
    ai_meta: dict,
    *,
    motion_subject: bool,
) -> tuple[Path, str, dict]:
    """Pick speaker-follow vs fit-blur based on sustained face presence."""
    from clips_worker.subject_reframe import has_face_and_speech, write_motion_crop_track

    reframe_settings = dict(settings)
    clip_words = json.loads(words_path.read_text())
    crop_method = "speaker_follow"

    if has_face_and_speech(clip_file, clip_words):
        rendered = run_speakercrop(
            clip_file,
            out_mp4,
            words_path,
            reframe_settings,
            work_dir,
            clip_start_ms=clip_start_ms,
            crop_track_out=crop_track_path,
        )
        return rendered, crop_method, reframe_settings

    if motion_subject:
        wide = write_motion_crop_track(
            clip_file,
            crop_track_path,
            ai_meta,
            clip_start_ms,
            work_dir / "motion",
        )
        if wide:
            crop_method = "fit_blur"
            reframe_settings = {**reframe_settings, "layout": "fit"}
            write_fit_blur_crop_track(clip_file, crop_track_path, clip_start_ms)
        else:
            crop_method = "subject_follow"
    else:
        crop_method = "fit_blur"
        reframe_settings = {**reframe_settings, "layout": "fit"}
        write_fit_blur_crop_track(clip_file, crop_track_path, clip_start_ms)

    rendered = run_speakercrop(
        clip_file,
        out_mp4,
        words_path,
        reframe_settings,
        work_dir,
        clip_start_ms=clip_start_ms,
        crop_track_out=crop_track_path,
    )
    if not crop_track_path.exists():
        write_fit_blur_crop_track(clip_file, crop_track_path, clip_start_ms)
        crop_method = "fit_blur"
        reframe_settings = {**reframe_settings, "layout": "fit"}
    return rendered, crop_method, reframe_settings


def initial_clip_edits(settings: dict) -> dict:
    brand = settings.get("brand") or {}
    cap = dict(settings.get("captions") or {})
    cap_preset = brand.get("captionPreset") or {}
    if isinstance(cap_preset, dict):
        cap = {**cap, **cap_preset}
    edits: dict = {"captions": cap}
    if brand:
        edits["brand"] = {
            "templateId": brand.get("templateId"),
            "logoKey": brand.get("logoKey"),
            "logoPosition": brand.get("logoPosition"),
            "logoSizePct": brand.get("logoSizePct"),
            "logoOpacity": brand.get("logoOpacity"),
            "primaryColor": brand.get("primaryColor"),
        }
    return edits


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
    job: dict | None = None,
) -> None:
    settings = project.get("settings") or {}
    if isinstance(settings, str):
        settings = json.loads(settings)
    if settings.get("streamer"):
        settings = {**settings, "genre": "gaming_stream"}
    job_payload = {}
    if job:
        job_payload = job.get("payload") or {}
        if isinstance(job_payload, str):
            job_payload = json.loads(job_payload)
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
        if job_payload.get("singleClip"):
            dur_ms = int(round(probe_duration(src) * 1000))
            start_ms = range_start
            end_ms = range_end if range_end > range_start else dur_ms
            picks = [
                {
                    "start_ms": start_ms,
                    "end_ms": end_ms,
                    "score": 100,
                    "title": project.get("title") or "Clip",
                    "reason": "Imported clip",
                    "hook": "Imported clip",
                }
            ]
            picker_message = None
        elif mode == "anything":
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
        elif settings.get("streamer") and not job_payload.get("singleClip"):
            from clips_worker.streamer.keys import stream_signals_key
            from clips_worker.streamer.rank import rank_moments

            post_progress(
                job_id,
                {"projectStatus": "FINDING_CLIPS", "stage": "Finding moments", "progress": 52, "jobStatus": "RUNNING"},
            )
            dur_ms = range_end if range_end > range_start else int(round(probe_duration(src) * 1000))
            fusion_picks, signals_payload = rank_moments(
                audio_path=audio_wav,
                words=words,
                duration_ms=dur_ms,
                settings=settings,
            )
            picks = [
                {
                    "start_ms": p.start_ms,
                    "end_ms": p.end_ms,
                    "score": p.score,
                    "title": p.title,
                    "reason": p.hook,
                    "hook": p.hook,
                    "scores": p.scores,
                    "aiMeta": p.ai_meta,
                }
                for p in fusion_picks
            ]
            picker_message = None
            with conn.cursor() as cur:
                cur.execute('SELECT id FROM stream_vods WHERE "projectId" = %s LIMIT 1', (project_id,))
                row = cur.fetchone()
            if row:
                sig_key = stream_signals_key(workspace_id, row[0])
                put_json(sig_key, signals_payload)
                with conn.cursor() as cur:
                    cur.execute(
                        'UPDATE stream_vods SET "signalsKey" = %s, "updatedAt" = NOW() WHERE id = %s',
                        (sig_key, row[0]),
                    )
                conn.commit()
            post_progress(job_id, {"projectStatus": "FINDING_CLIPS", "stage": "picker_done", "progress": 55, "jobStatus": "RUNNING"})
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
        render_conc = clips_render_concurrency()

        def on_reframe_start(idx: int, clip_total: int) -> None:
            post_progress(
                job_id,
                {
                    "projectStatus": "REFRAMING",
                    "stage": f"reframe_{idx + 1}_of_{clip_total}",
                    "progress": 55 + int(30 * idx / clip_total),
                    "jobStatus": "RUNNING",
                },
            )

        def build_clip_row(idx: int) -> dict:
            pick = picks[idx]
            clip_id = f"clip_{uuid.uuid4().hex}"
            clip_file = td_path / f"clip_{idx}.mp4"
            ffmpeg_cut(src, clip_file, pick["start_ms"], pick["end_ms"])
            clip_words = slice_words(words, pick["start_ms"], pick["end_ms"])
            words_path = td_path / f"words_{idx}.json"
            words_path.write_text(json.dumps(clip_words))

            out_mp4 = td_path / f"out_{idx}.mp4"
            crop_track_path = td_path / f"crop_track_{idx}.json"
            ai_meta = pick.get("aiMeta") or {}
            rendered, crop_method, _reframe_settings = reframe_clip_preview(
                clip_file,
                out_mp4,
                words_path,
                settings,
                td_path / f"reframe_work_{idx}",
                pick["start_ms"],
                crop_track_path,
                ai_meta,
                motion_subject=mode == "anything",
            )
            poster = td_path / f"poster_{idx}.jpg"
            poster_jpg(rendered, poster)

            keys = clip_keys(workspace_id, project_id, clip_id)
            upload_file(keys["preview"], rendered, "video/mp4")
            upload_file(keys["poster"], poster, "image/jpeg")
            put_json(keys["words"], clip_words)
            crop_key = None
            if crop_track_path.exists():
                upload_file(keys["crop_track"], crop_track_path, "application/json")
                crop_key = keys["crop_track"]
            elif mode == "anything":
                raise RuntimeError(f"ClipAnything clip missing crop track: {clip_id}")

            ai_meta_out = {**(pick.get("aiMeta") or {}), "cropMethod": crop_method}
            if mode == "anything" and not crop_key:
                raise RuntimeError(f"ClipAnything clip missing cropKey: {clip_id}")

            return {
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
                "cropKey": crop_key,
                "edits": initial_clip_edits(settings),
                "aiMeta": ai_meta_out if mode == "anything" else (pick.get("aiMeta") or {"hook": pick.get("hook")}),
            }

        clip_rows = run_bounded_indexed_pool(total, render_conc, build_clip_row, on_start=on_reframe_start)

        for idx in range(total):
            post_progress(
                job_id,
                {
                    "projectStatus": "RENDERING",
                    "stage": f"render_{idx + 1}_of_{total}",
                    "progress": 85 + int(14 * (idx + 1) / total),
                    "jobStatus": "RUNNING",
                },
            )

        if mode == "anything":
            for row in clip_rows:
                if not row.get("cropKey"):
                    raise RuntimeError(f"pipeline invariant: missing cropKey for clip {row.get('id')}")

        insert_clips_batch(conn, clip_rows)
        if clip_rows:
            poster = clip_rows[0].get("posterKey")
            if poster:
                with conn.cursor() as cur:
                    cur.execute(
                        'UPDATE clip_projects SET "thumbKey" = %s, "updatedAt" = NOW() WHERE id = %s',
                        (poster, project_id),
                    )
                conn.commit()
        mark_project_ready(conn, project_id)
        post_progress(
            job_id,
            {"projectStatus": "READY", "stage": "ready", "progress": 100, "jobStatus": "DONE", "error": None},
        )
