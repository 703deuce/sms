"""MUSIC worker job: ElevenLabs compose + upload."""
from __future__ import annotations

import json
import tempfile
import uuid
from decimal import Decimal
from pathlib import Path

from clips_worker.elevenlabs import generate_music_for_length
from clips_worker.storage import upload_file


def run_music_job(conn, job: dict, post_progress) -> None:
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    generation_id = payload.get("generationId")
    if not generation_id:
        raise RuntimeError("missing generationId")

    with conn.cursor() as cur:
        cur.execute(
            'SELECT id, "workspaceId", "clipId", prompt, params, status FROM ai_generations WHERE id=%s',
            (generation_id,),
        )
        row = cur.fetchone()
    if not row:
        raise RuntimeError("generation not found")
    gen_id, workspace_id, clip_id, prompt, params, status = row
    if status == "READY":
        post_progress(job["id"], {"jobStatus": "DONE", "stage": "ready", "progress": 100})
        return

    if isinstance(params, str):
        params = json.loads(params)
    params = params or {}
    length_ms = int(params.get("lengthMs") or 30_000)
    instrumental = bool(params.get("instrumental", True))

    post_progress(job["id"], {"jobStatus": "RUNNING", "stage": "music", "progress": 20})
    with conn.cursor() as cur:
        cur.execute(
            'UPDATE ai_generations SET status=%s, "updatedAt"=NOW() WHERE id=%s',
            ("RUNNING", generation_id),
        )
    conn.commit()

    audio, usage = generate_music_for_length(str(prompt), length_ms, instrumental)
    t2v_project_id = params.get("t2vProjectId")
    if t2v_project_id:
        storage_key = f"ws/{workspace_id}/projects/{t2v_project_id}/t2v/music/{generation_id}.mp3"
    else:
        storage_key = f"ws/{workspace_id}/clips/{clip_id or 'none'}/music/{generation_id}.mp3"

    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
        tmp = Path(f.name)
        tmp.write_bytes(audio)
    try:
        upload_file(storage_key, tmp, "audio/mpeg")
    finally:
        tmp.unlink(missing_ok=True)

    cost_usd = Decimal(usage["costUsdMicros"]) / Decimal(1_000_000)
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE ai_generations
            SET status=%s, "storageKey"=%s, "costUsd"=%s, "updatedAt"=NOW()
            WHERE id=%s
            """,
            ("READY", storage_key, cost_usd, generation_id),
        )
        cur.execute(
            """
            INSERT INTO ai_usage (id, "workspaceId", "clipId", "generationId", provider, model, units, "unitType", "costUsdMicros", "createdAt")
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
            """,
            (
                f"aiu_{uuid.uuid4().hex}",
                workspace_id,
                clip_id,
                generation_id,
                usage["provider"],
                usage["model"],
                usage["units"],
                usage["unitType"],
                usage["costUsdMicros"],
            ),
        )
    if clip_id:
        with conn.cursor() as cur:
            cur.execute('SELECT edits FROM clips WHERE id=%s', (clip_id,))
            row = cur.fetchone()
            if row and row[0]:
                edits = row[0] if isinstance(row[0], dict) else json.loads(row[0])
            else:
                edits = {"v": 2, "trim": {"in": 0, "out": length_ms}, "cutRanges": [], "wordFixes": {}, "layout": {"mode": "speaker_follow", "shotOverrides": []}}
            audio = edits.get("audio") or {}
            audio["music"] = {
                "generationId": generation_id,
                "volume": 0.25,
                "duckDepth": 0.7,
                "fadeInMs": 500,
                "fadeOutMs": 1000,
            }
            edits["audio"] = audio
            cur.execute(
                'UPDATE clips SET edits=%s, "updatedAt"=NOW() WHERE id=%s',
                (json.dumps(edits), clip_id),
            )
    draft_id = params.get("draftId")
    if draft_id and t2v_project_id:
        with conn.cursor() as cur:
            cur.execute(
                'UPDATE t2v_drafts SET "musicReadyGenerationId"=%s, "updatedAt"=NOW() WHERE id=%s',
                (str(generation_id), draft_id),
            )
    conn.commit()
    post_progress(job["id"], {"jobStatus": "DONE", "stage": "ready", "progress": 100})
