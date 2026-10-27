"""PROCESS_PROJECT payload / transcript helpers (import-safe for unit tests)."""
from __future__ import annotations

import json


def job_payload(job: dict) -> dict:
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    return payload if isinstance(payload, dict) else {}


def stored_transcript_words(project: dict) -> list[dict] | None:
    tw = project.get("transcriptWords")
    if not tw:
        return None
    if isinstance(tw, str):
        tw = json.loads(tw)
    if isinstance(tw, list) and tw:
        return tw
    return None


def project_layout_for_clip(project: dict, clip_index: int = 0) -> str:
    """Layout string used when reframing clip N (mirrors pipeline.build_clip_row)."""
    from clips_worker.render_clip import resolve_clip_layout

    settings = project.get("settings") or {}
    if isinstance(settings, str):
        settings = json.loads(settings)
    return resolve_clip_layout(settings, clip_index)


def load_transcript_words_from_storage(project: dict) -> list[dict] | None:
    key = project.get("transcriptKey")
    if not key:
        return None
    import tempfile
    from pathlib import Path

    from clips_worker.storage import download_object

    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        path = Path(f.name)
    try:
        download_object(key, path)
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, list) and data:
            return data
    except Exception:
        return None
    finally:
        path.unlink(missing_ok=True)
    return None


def persist_project_transcript_words(project: dict, words: list[dict]) -> bool:
    key = project.get("transcriptKey")
    if not key or not words:
        return False
    from clips_worker.storage import put_json

    put_json(key, words)
    return True


def transcript_progress_extras(project: dict, words: list[dict]) -> dict:
    """Avoid shipping large transcript JSON over progress when object storage holds it."""
    if persist_project_transcript_words(project, words):
        return {}
    if words:
        return {"transcriptWords": words}
    return {}


def resolve_transcript_for_job(project: dict, payload: dict) -> list[dict] | None:
    """Reuse persisted transcript on retry/resume; skip expensive ASR when safe."""
    if payload.get("force_retranscribe"):
        return None
    from_storage = load_transcript_words_from_storage(project)
    if from_storage:
        return from_storage
    stored = stored_transcript_words(project)
    if stored:
        return stored
    if payload.get("resume"):
        return stored
    return None
