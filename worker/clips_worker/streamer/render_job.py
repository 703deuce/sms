"""STREAM_RENDER: fetch padded segments, align, reframe each clip."""
from __future__ import annotations

import json
import tempfile
import uuid
from pathlib import Path

from psycopg2.extras import RealDictCursor

from clips_worker.heartbeat import Heartbeat
from clips_worker.pipeline import clip_keys, initial_clip_edits, mark_project_ready
from clips_worker.render_clip import ffmpeg_cut, poster_jpg, run_speakercrop, slice_words
from clips_worker.storage import download_object, put_json, upload_file
from clips_worker.streamer.align import align_segment_ms
from clips_worker.streamer.config import SCRATCH, SEGMENT_PAD_S, SOURCE_RETENTION_HOURS
from clips_worker.streamer.keys import clip_segment_key, stream_audio_key
from clips_worker.streamer.segments import cut_local_segment, download_segment


def _load_vod(conn, vod_id: str) -> dict:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT v.*, p."workspaceId", p.settings, p.id AS project_id, p."uploadId", p."transcriptKey"
            FROM stream_vods v
            JOIN clip_projects p ON p.id = v."projectId"
            WHERE v.id = %s
            """,
            (vod_id,),
        )
        row = cur.fetchone()
    if not row:
        raise RuntimeError("vod missing")
    return dict(row)


def _clips_for_project(conn, project_id: str) -> list[dict]:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT * FROM clips
            WHERE "projectId" = %s AND "deletedAt" IS NULL
            ORDER BY score DESC, "startMs" ASC
            """,
            (project_id,),
        )
        return [dict(r) for r in cur.fetchall()]


def run_stream_render_job(conn, job: dict, post_progress) -> None:
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    vod_id = payload.get("vodId")
    if not vod_id:
        raise RuntimeError("missing vodId")

    vod = _load_vod(conn, vod_id)
    workspace_id = vod["workspaceId"]
    project_id = vod["project_id"]
    settings = vod.get("settings") or {}
    if isinstance(settings, str):
        settings = json.loads(settings)
    url = vod.get("url")
    state = vod.get("state") or {}
    if isinstance(state, str):
        state = json.loads(state)
    audio_key = state.get("audioKey") or stream_audio_key(workspace_id, vod_id)

    clips = _clips_for_project(conn, project_id)
    if not clips:
        mark_project_ready(conn, project_id)
        post_progress(job["id"], {"projectStatus": "READY", "stage": "ready", "progress": 100, "jobStatus": "DONE"})
        return

    SCRATCH.mkdir(parents=True, exist_ok=True)
    total = len(clips)
    local_upload: Path | None = None

    with Heartbeat(job["id"], post_progress, every_s=45) as hb:
        with tempfile.TemporaryDirectory(dir=SCRATCH) as td:
            td_path = Path(td)
            audio_path = td_path / "audio.opus"
            download_object(audio_key, audio_path)

            if vod.get("platform") == "upload" and vod.get("uploadId"):
                up = td_path / "full.mp4"
                with conn.cursor() as cur:
                    cur.execute('SELECT key FROM clip_uploads WHERE id = %s', (vod["uploadId"],))
                    row = cur.fetchone()
                if row:
                    download_object(row[0], up)
                    local_upload = up
            transcript_key = vod.get("transcriptKey")

            for idx, clip in enumerate(clips):
                if clip.get("previewKey"):
                    continue
                clip_id = clip["id"]
                start_ms = int(clip["startMs"])
                end_ms = int(clip["endMs"])
                pad = SEGMENT_PAD_S
                seg_start_s = max(0.0, start_ms / 1000.0 - pad)
                seg_end_s = end_ms / 1000.0 + pad
                seg_path = td_path / f"seg_{clip_id}.mp4"

                if local_upload:
                    cut_local_segment(local_upload, seg_path, seg_start_s, seg_end_s)
                elif url:
                    download_segment(url, seg_path, seg_start_s, seg_end_s)
                else:
                    raise RuntimeError("no url or upload for segment fetch")

                true_start_ms, corr = align_segment_ms(seg_path, audio_path, seg_start_s, seg_end_s)
                true_end_ms = int(end_ms + (true_start_ms - int(seg_start_s * 1000)))

                seg_key = clip_segment_key(workspace_id, project_id, clip_id)
                upload_file(seg_key, seg_path, "video/mp4")

                offset_ms = true_start_ms
                rel_start = max(0, start_ms - offset_ms)
                rel_end = max(rel_start + 100, end_ms - offset_ms)

                words_path = td_path / f"words_{clip_id}.json"
                transcript_path = td_path / "transcript.json"
                if not transcript_key:
                    raise RuntimeError("missing transcriptKey")
                download_object(transcript_key, transcript_path)
                all_words = json.loads(transcript_path.read_text())
                clip_words = slice_words(all_words, start_ms, end_ms)
                words_path.write_text(json.dumps(clip_words))

                clip_file = td_path / f"clip_{clip_id}.mp4"
                ffmpeg_cut(seg_path, clip_file, rel_start, rel_end)
                out_mp4 = td_path / f"out_{clip_id}.mp4"
                crop_track = td_path / f"crop_{clip_id}.json"
                rendered = run_speakercrop(
                    clip_file,
                    out_mp4,
                    words_path,
                    settings,
                    td_path,
                    clip_start_ms=start_ms,
                    crop_track_out=crop_track,
                )
                poster = td_path / f"poster_{clip_id}.jpg"
                poster_jpg(rendered, poster)
                keys = clip_keys(workspace_id, project_id, clip_id)
                upload_file(keys["preview"], rendered, "video/mp4")
                upload_file(keys["poster"], poster, "image/jpeg")
                put_json(keys["words"], clip_words)
                crop_key = None
                if crop_track.exists():
                    upload_file(keys["crop_track"], crop_track, "application/json")
                    crop_key = keys["crop_track"]

                with conn.cursor() as cur:
                    cur.execute(
                        """
                        UPDATE clips SET
                          "previewKey"=%s, "posterKey"=%s, "wordsKey"=%s, "cropKey"=%s,
                          "sourceSegKey"=%s, "sourceSegStartMs"=%s, "sourceSegEndMs"=%s,
                          edits=%s::jsonb, "updatedAt"=NOW()
                        WHERE id=%s
                        """,
                        (
                            keys["preview"],
                            keys["poster"],
                            keys["words"],
                            crop_key,
                            seg_key,
                            true_start_ms,
                            true_end_ms,
                            json.dumps(initial_clip_edits(settings)),
                            clip_id,
                        ),
                    )
                conn.commit()

                pct = 65 + int(30 * (idx + 1) / total)
                hb.update(stage=f"Rendering {idx + 1}/{total}", progress=pct)
                post_progress(
                    job["id"],
                    {
                        "projectStatus": "RENDERING",
                        "stage": f"Rendering {idx + 1}/{total}",
                        "progress": pct,
                        "jobStatus": "RUNNING",
                    },
                )

    mark_project_ready(conn, project_id)
    cleanup_id = f"job_{uuid.uuid4().hex}"
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO clip_jobs (id, "projectId", type, status, payload, priority, "runAfter", "createdAt")
            VALUES (%s,%s,'STREAM_CLEANUP','QUEUED',%s::jsonb,0,NOW() + (%s || ' hours')::interval,NOW())
            """,
            (cleanup_id, project_id, json.dumps({"vodId": vod_id}), str(SOURCE_RETENTION_HOURS)),
        )
    conn.commit()
    post_progress(
        job["id"],
        {"projectStatus": "READY", "stage": "ready", "progress": 100, "jobStatus": "DONE"},
    )
