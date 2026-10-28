"""REPLACE_CLIP: alternate moment after user dislike (regular clipper)."""
from __future__ import annotations

import json
import tempfile
import uuid
from pathlib import Path

from psycopg2.extras import RealDictCursor

from clips_worker.clip_ai_meta import finalize_clip_ai_meta
from clips_worker.main import load_project
from clips_worker.clip_polish import apply_clip_polish_initial
from clips_worker.pipeline import (
    clip_keys,
    extract_wav_for_picker,
    initial_clip_edits,
    insert_clips_batch,
    reframe_clip_preview,
    _finalize_regular_clip_edits,
)
from clips_worker.picker import pick_talking_clips
from clips_worker.process_helpers import resolve_transcript_for_job
from clips_worker.render_clip import ffmpeg_cut, poster_jpg, resolve_clip_layout, slice_words
from clips_worker.storage import download_object, put_json, upload_file


def _overlap_ratio(a0: int, a1: int, b0: int, b1: int) -> float:
    overlap = max(0, min(a1, b1) - max(a0, b0))
    span = max(1, min(a1 - a0, b1 - b0))
    return overlap / span


def _is_hidden(meta) -> bool:
    if not meta:
        return False
    if isinstance(meta, str):
        try:
            meta = json.loads(meta)
        except json.JSONDecodeError:
            return False
    return bool((meta or {}).get("userHidden"))


def _occupied_spans(conn, project_id: str, skip_clip_id: str) -> list[tuple[int, int]]:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT id, "startMs", "endMs", "aiMeta"
            FROM clips
            WHERE "projectId" = %s AND "deletedAt" IS NULL
            """,
            (project_id,),
        )
        rows = cur.fetchall()
    spans: list[tuple[int, int]] = []
    for row in rows:
        if row["id"] == skip_clip_id:
            continue
        if _is_hidden(row.get("aiMeta")):
            continue
        spans.append((int(row["startMs"]), int(row["endMs"])))
    return spans


def _pick_replacement(picks: list[dict], spans: list[tuple[int, int]]) -> dict | None:
    ranked = sorted(picks, key=lambda p: int(p.get("score") or 0), reverse=True)
    for pick in ranked:
        s, e = int(pick["start_ms"]), int(pick["end_ms"])
        if any(_overlap_ratio(s, e, a, b) >= 0.35 for a, b in spans):
            continue
        return pick
    return None


def run_replace_clip_job(conn, job: dict, post_progress) -> None:
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    replaced_id = payload.get("replacedClipId")
    if not replaced_id:
        raise RuntimeError("missing replacedClipId")

    project = load_project(conn, job["projectId"])
    workspace_id = project["workspaceId"]
    project_id = project["id"]
    key = project.get("source_key")
    if not key:
        raise RuntimeError("missing source key")

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            'SELECT * FROM clips WHERE id = %s AND "projectId" = %s AND "deletedAt" IS NULL',
            (replaced_id, project_id),
        )
        old = cur.fetchone()
    if not old:
        print(
            f"[clipper:replace] project={project_id} replacedClipId={replaced_id} status=skip reason=not_found",
            flush=True,
        )
        return

    settings = project.get("settings") or {}
    if isinstance(settings, str):
        settings = json.loads(settings)
    from clips_worker.target_clip_len import enrich_settings_with_clip_length

    settings = enrich_settings_with_clip_length(settings, payload)
    words = resolve_transcript_for_job(project, {})
    range_start = int(project.get("rangeStartMs") or 0)
    range_end = int(project.get("rangeEndMs") or 0) or int(project.get("durationMs") or 0)

    post_progress(job["id"], {"jobStatus": "RUNNING", "stage": "replace_pick", "progress": 20})

    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        src = td_path / "source.mp4"
        download_object(key, src)
        audio_wav = td_path / "audio.wav"
        extract_wav_for_picker(src, audio_wav)
        picks, msg = pick_talking_clips(words, str(audio_wav), settings, range_start, range_end)
        spans = _occupied_spans(conn, project_id, replaced_id)
        pick = _pick_replacement(picks, spans)
        if not pick:
            print(
                f"[clipper:replace] project={project_id} replacedClipId={replaced_id} status=empty message={msg!r}",
                flush=True,
            )
            post_progress(job["id"], {"jobStatus": "DONE", "stage": "replace_empty", "progress": 100})
            return

        clip_id = f"clip_{uuid.uuid4().hex}"
        clip_file = td_path / "clip.mp4"
        ffmpeg_cut(src, clip_file, pick["start_ms"], pick["end_ms"])
        clip_words = slice_words(words, pick["start_ms"], pick["end_ms"])
        words_path = td_path / "words.json"
        words_path.write_text(json.dumps(clip_words))
        out_mp4 = td_path / "out.mp4"
        crop_track_path = td_path / "crop.json"
        ai_meta = dict(pick.get("aiMeta") or {})
        ai_meta["replacementFor"] = replaced_id
        ai_meta["userFeedback"] = None
        idx = 99
        resolved_layout = resolve_clip_layout(settings, idx)
        clip_settings = {**settings, "layout": resolved_layout}
        rendered, crop_method, _ = reframe_clip_preview(
            clip_file,
            out_mp4,
            words_path,
            clip_settings,
            td_path / "work",
            pick["start_ms"],
            crop_track_path,
            ai_meta,
            clip_index=idx,
            conn=conn,
            workspace_id=workspace_id,
            project_id=project_id,
            clip_id=clip_id,
        )
        poster = td_path / "poster.jpg"
        poster_jpg(rendered, poster)
        keys = clip_keys(workspace_id, project_id, clip_id)
        upload_file(keys["preview"], rendered, "video/mp4")
        upload_file(keys["poster"], poster, "image/jpeg")
        put_json(keys["words"], clip_words)
        crop_key = None
        if crop_track_path.exists():
            upload_file(keys["crop_track"], crop_track_path, "application/json")
            crop_key = keys["crop_track"]
        ai_meta_out = finalize_clip_ai_meta(pick, ai_meta, crop_method, resolved_layout)
        row = {
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
            "edits": _finalize_regular_clip_edits(
                apply_clip_polish_initial(
                    initial_clip_edits(settings),
                    pick,
                    clip_words,
                    settings,
                ),
                clip_file,
                clip_words,
                settings,
                settings.get("mode") or "talking",
            ),
            "aiMeta": ai_meta_out,
        }
        insert_clips_batch(conn, [row])

    print(
        f"[clipper:replace] project={project_id} replacedClipId={replaced_id} newClipId={clip_id} "
        f"startMs={pick['start_ms']} endMs={pick['end_ms']}",
        flush=True,
    )
    post_progress(job["id"], {"jobStatus": "DONE", "stage": "replace_done", "progress": 100, "newClipId": clip_id})
