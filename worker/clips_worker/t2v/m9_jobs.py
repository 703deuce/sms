"""T2V M9 worker jobs: deck extract, voice clone, scene AI image/video."""
from __future__ import annotations

import json
import secrets
import tempfile
import uuid
from pathlib import Path
from typing import Any

import requests

from clips_worker.storage import download_object, upload_file
from clips_worker.t2v.deck_extract import extract_deck
from clips_worker.t2v.draft_patch import patch_scene_media
from clips_worker.t2v.kie_tasks import (
    create_image_task,
    create_video_task,
    poll_kie_task,
    t2v_kie_callback_url,
)


def _payload(job: dict) -> dict:
    p = job.get("payload") or {}
    if isinstance(p, str):
        p = json.loads(p)
    return p


def _merge_payload(conn, job_id: str, patch: dict) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE clip_jobs SET payload = COALESCE(payload, '{}'::jsonb) || %s::jsonb WHERE id=%s",
            (json.dumps(patch), job_id),
        )
    conn.commit()


def _upload_bytes(key: str, data: bytes, mime: str) -> None:
    tmp = Path(f"/tmp/t2v-up-{secrets.token_hex(6)}")
    try:
        tmp.write_bytes(data)
        upload_file(key, tmp, mime)
    finally:
        tmp.unlink(missing_ok=True)


def run_t2v_extract_deck_job(conn, job: dict, progress) -> None:
    p = _payload(job)
    workspace_id = p["workspaceId"]
    upload_id = p["uploadId"]
    progress(job["id"], {"jobStatus": "RUNNING", "stage": "extract", "progress": 10})
    with conn.cursor() as cur:
        cur.execute(
            'SELECT key, filename FROM clip_uploads WHERE id=%s AND "workspaceId"=%s',
            (upload_id, workspace_id),
        )
        row = cur.fetchone()
    if not row:
        raise RuntimeError("upload_not_found")
    storage_key, filename = row[0], row[1] or "deck"
    suffix = Path(filename).suffix.lower() or ".pdf"
    with tempfile.TemporaryDirectory(prefix="t2v-deck-") as td:
        local = Path(td) / f"deck{suffix}"
        download_object(storage_key, local)
        result = extract_deck(local)
    _merge_payload(conn, job["id"], {"result": result})
    progress(job["id"], {"jobStatus": "DONE", "stage": "ready", "progress": 100})


def run_t2v_voice_clone_job(conn, job: dict, progress) -> None:
    from clips_worker.t2v.elevenlabs_tts import get_elevenlabs_api_key

    p = _payload(job)
    workspace_id = p["workspaceId"]
    sample_upload_id = p["sampleUploadId"]
    name = p["name"]
    progress(job["id"], {"jobStatus": "RUNNING", "stage": "clone", "progress": 20})
    with conn.cursor() as cur:
        cur.execute(
            'SELECT key, filename FROM clip_uploads WHERE id=%s AND "workspaceId"=%s',
            (sample_upload_id, workspace_id),
        )
        row = cur.fetchone()
    if not row:
        raise RuntimeError("sample_not_found")
    with tempfile.TemporaryDirectory(prefix="t2v-clone-") as td:
        sample = Path(td) / (row[1] or "sample.mp3")
        download_object(row[0], sample)
        api_key = get_elevenlabs_api_key()
        with sample.open("rb") as f:
            res = requests.post(
                "https://api.elevenlabs.io/v1/voices/add",
                headers={"xi-api-key": api_key},
                data={"name": name, "remove_background_noise": "true", "description": "T2V clone"},
                files={"files": (sample.name, f, "audio/mpeg")},
                timeout=180,
            )
        if not res.ok:
            raise RuntimeError(f"elevenlabs_clone_{res.status_code}: {res.text[:200]}")
        body = res.json()
        voice_id = str(body.get("voice_id") or "")
        if not voice_id:
            raise RuntimeError("elevenlabs_clone_missing_voice_id")
    saved_id = f"t2vsv_{uuid.uuid4().hex[:16]}"
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO t2v_saved_voices
              (id, "workspaceId", provider, "voiceId", name, "isClone", "consentAt", "consentById")
            VALUES (%s, %s, %s, %s, %s, true, %s::timestamptz, %s)
            ON CONFLICT ("workspaceId", provider, "voiceId") DO UPDATE
              SET name=EXCLUDED.name, "consentAt"=EXCLUDED."consentAt", "consentById"=EXCLUDED."consentById"
            """,
            (saved_id, workspace_id, "elevenlabs", voice_id, name, p.get("consentAt"), p.get("consentById")),
        )
    conn.commit()
    result = {"voiceId": voice_id, "previewUrl": None, "saved": {"voiceId": voice_id, "name": name}}
    _merge_payload(conn, job["id"], {"result": result})
    progress(job["id"], {"jobStatus": "DONE", "stage": "ready", "progress": 100})


def _download_url(url: str) -> bytes:
    r = requests.get(url, timeout=300, stream=True)
    r.raise_for_status()
    chunks: list[bytes] = []
    for chunk in r.iter_content(chunk_size=8 * 1024 * 1024):
        if chunk:
            chunks.append(chunk)
    return b"".join(chunks)


def _apply_ai_media(
    conn,
    job: dict,
    progress,
    *,
    provider: str,
    kind: str,
    mime: str,
    ext: str,
) -> None:
    p = _payload(job)
    workspace_id = p["workspaceId"]
    draft_id = p["draftId"]
    scene_id = p["sceneId"]
    prompt = p["prompt"]
    aspect = p.get("aspect") or "16:9"
    progress(job["id"], {"jobStatus": "RUNNING", "stage": "generate", "progress": 15})
    callback = t2v_kie_callback_url(job["id"])
    if provider == "ai_image":
        task_id = create_image_task(prompt, aspect, call_back_url=callback)
    else:
        task_id = create_video_task(prompt, aspect, call_back_url=callback)
    _merge_payload(conn, job["id"], {"kieTaskId": task_id})
    progress(job["id"], {"jobStatus": "RUNNING", "stage": "poll", "progress": 40})
    asset_url = poll_kie_task(task_id, conn=conn, job_id=job["id"])
    raw = _download_url(asset_url)
    storage_key = f"ws/{workspace_id}/t2v/scenes/{draft_id}/{scene_id}-{secrets.token_hex(8)}.{ext}"
    _upload_bytes(storage_key, raw, mime)
    media: dict[str, Any] = {
        "provider": provider,
        "kind": kind,
        "storageKey": storage_key,
        "query": prompt,
        "locked": True,
    }
    if kind == "video":
        media["durationMs"] = 5000
    patch_scene_media(conn, workspace_id=workspace_id, draft_id=draft_id, scene_id=scene_id, media=media)
    _merge_payload(conn, job["id"], {"result": {"media": media}})
    progress(job["id"], {"jobStatus": "DONE", "stage": "ready", "progress": 100})


def run_t2v_scene_ai_image_job(conn, job: dict, progress) -> None:
    _apply_ai_media(conn, job, progress, provider="ai_image", kind="image", mime="image/png", ext="png")


def run_t2v_scene_ai_video_job(conn, job: dict, progress) -> None:
    _apply_ai_media(conn, job, progress, provider="ai_video", kind="video", mime="video/mp4", ext="mp4")
