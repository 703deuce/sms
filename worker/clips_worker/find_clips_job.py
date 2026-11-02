"""FIND_CLIPS job: picker + plan only; no render/reframe/project READY."""
from __future__ import annotations

import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from psycopg2.extras import Json

from clips_worker.process_helpers import job_payload, resolve_transcript_for_job
from clips_worker.reason_tag import clip_reason_ai_meta
from clips_worker.render_clip import slice_words

_MAX_FIND_PICKS = 30

_PROGRESS_DROP_KEYS = frozenset({"projectStatus", "stage", "progress", "projectError"})


def noop_mark_project_ready(conn, project_id: str, error: str | None = None) -> None:
    del conn, project_id, error


def make_find_progress(conn, job_id: str, post_progress: Callable[..., Any]):
    def find_progress(jid: str, payload: dict) -> None:
        if payload.get("projectStatus") == "READY":
            payload = {k: v for k, v in payload.items() if k != "projectStatus"}
        stage = payload.get("stage")
        progress = payload.get("progress")
        if stage is not None or progress is not None:
            merge: dict[str, Any] = {"find": {}}
            if stage is not None:
                merge["find"]["stage"] = stage
            if progress is not None:
                merge["find"]["progress"] = progress
            with conn.cursor() as cur:
                cur.execute(
                    'UPDATE clip_jobs SET payload = payload || %s::jsonb WHERE id = %s',
                    (Json(merge), job_id),
                )
            conn.commit()
        forwarded = {k: v for k, v in payload.items() if k not in _PROGRESS_DROP_KEYS}
        if forwarded:
            post_progress(jid, forwarded)

    return find_progress


def _pick_to_find_row(pick: dict, words: list[dict], mode: str | None) -> dict:
    start_ms = int(pick["start_ms"])
    end_ms = int(pick["end_ms"])
    clip_words = slice_words(words, start_ms, end_ms) if words else []
    ai = pick.get("aiMeta") or {}
    if clip_words:
        ai = {**ai, **clip_reason_ai_meta(pick, clip_words, mode)}
    tag = str(ai.get("reasonTag") or "speech")
    why = pick.get("reason") or pick.get("hook") or ""
    return {
        "startMs": start_ms,
        "endMs": end_ms,
        "score": float(pick.get("score") or 0),
        "title": str(pick.get("title") or "Clip"),
        "reasonTag": tag,
        "why": str(why)[:500] if why else None,
        "hook": str(pick.get("hook") or pick.get("title") or "")[:200],
    }


def persist_find_result(
    conn,
    job_id: str,
    planned: list[dict] | None,
    *,
    words: list[dict] | None = None,
    settings: dict | None = None,
) -> None:
    from clips_worker.content_detection import normalize_content_mode

    mode = normalize_content_mode((settings or {}).get("mode"))
    words = words or []
    capped = list(planned or [])[:_MAX_FIND_PICKS]
    picks = [_pick_to_find_row(p, words, mode) for p in capped]
    finished_at = datetime.now(timezone.utc).isoformat()
    merge = {
        "findResult": {
            "version": 1,
            "finishedAt": finished_at,
            "picks": picks,
        },
        "find": {"progress": 100, "stage": "done"},
    }
    with conn.cursor() as cur:
        cur.execute(
            'UPDATE clip_jobs SET payload = payload || %s::jsonb WHERE id = %s',
            (Json(merge), job_id),
        )
    conn.commit()


def handle_find_clips(conn, job: dict) -> None:
    from clips_worker.main import _mark_job_done, load_project, post_progress
    from clips_worker.pipeline import extract_wav_for_picker, run_m4_pipeline
    from clips_worker.probe import probe_duration
    from clips_worker.storage import download_object
    from clips_worker.transcribe_source import transcribe_video_file

    project = load_project(conn, job["projectId"])
    if project.get("status") == "CANCELED":
        post_progress(job["id"], {"jobStatus": "FAILED", "error": "canceled"})
        return

    key = project["source_key"]
    if not key:
        raise RuntimeError("missing source key")

    payload = job_payload(job)
    settings = project.get("settings") or {}
    if isinstance(settings, str):
        settings = json.loads(settings)
    override = payload.get("settingsOverride") or {}
    if isinstance(override, str):
        override = json.loads(override)
    merged_settings = {**settings, **override, "fullVideo": False}
    project = {**project, "settings": merged_settings}

    words = resolve_transcript_for_job(project, payload)
    find_progress = make_find_progress(conn, job["id"], post_progress)
    find_progress(job["id"], {"jobStatus": "RUNNING"})

    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        src = td_path / "source.mp4"
        download_object(key, src)
        _ = probe_duration(src)
        audio_wav = td_path / "audio.wav"
        extract_wav_for_picker(src, audio_wav)

        if words:
            find_progress(job["id"], {"jobStatus": "RUNNING", "transcriptWords": words})
        else:
            model = os.environ.get("ASR_MODEL", "small.en")
            words, tx_meta = transcribe_video_file(conn, project, src, model=model)
            find_progress(
                job["id"],
                {
                    "jobStatus": "RUNNING",
                    "transcriptWords": words,
                    **tx_meta.as_progress_fields(),
                },
            )

        run_m4_pipeline(
            conn,
            job["id"],
            project,
            words,
            key,
            find_progress,
            job=job,
            local_src=src,
            local_audio_wav=audio_wav,
            find_only=True,
        )

    _mark_job_done(conn, job["id"])
    post_progress(job["id"], {"jobStatus": "DONE"})
