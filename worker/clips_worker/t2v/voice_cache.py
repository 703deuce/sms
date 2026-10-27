"""Shared T2V voice cache (same rows + storage keys as new-app getOrSynthesizeVoiceClip).

Canonical synthesis path: new-app scene voice API (`lib/server/t2v/voice-cache.ts` + `elevenlabs-tts.ts`).
Worker calls this module during T2V_ASSEMBLE only — cache lookup first, ElevenLabs on miss.
Never compute cache hash in Python; use scene.voice.hash from the draft (computed in TypeScript).
"""
from __future__ import annotations

import json
import secrets
from pathlib import Path
from typing import Any

from clips_worker.t2v.elevenlabs_tts import tts_with_timestamps
from clips_worker.t2v.keys import voice_storage_key
from clips_worker.t2v.tts_alignment import duration_ms_from_alignment
from clips_worker.t2v.usage import elevenlabs_tts_cost_usd_micros, record_t2v_voice_usage


def get_or_synthesize_voice_clip(
    conn,
    *,
    workspace_id: str,
    text: str,
    voice: dict[str, Any],
    voice_hash: str,
    previous_text: str | None = None,
    next_text: str | None = None,
    project_id: str | None = None,
    job_id: str | None = None,
    scene_id: str | None = None,
) -> dict[str, Any]:
    """Returns {clipId, storageKey, durationMs, alignment, hash, cached, modelId}."""
    if not voice_hash:
        raise ValueError("voice_hash required (use draft scene.voice.hash from TypeScript ttsHash)")

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, "storageKey", "durationMs", alignment, "modelId"
            FROM t2v_voice_clips
            WHERE "workspaceId" = %s AND hash = %s
            """,
            (workspace_id, voice_hash),
        )
        row = cur.fetchone()
    if row:
        clip_id, storage_key, duration_ms, alignment, model_id = row
        if isinstance(alignment, str):
            alignment = json.loads(alignment)
        return {
            "clipId": clip_id,
            "storageKey": storage_key,
            "durationMs": duration_ms,
            "alignment": alignment,
            "hash": voice_hash,
            "cached": True,
            "modelId": model_id,
        }

    audio, alignment, model_id = tts_with_timestamps(
        text,
        voice,
        previous_text=previous_text,
        next_text=next_text,
    )
    duration_ms = duration_ms_from_alignment(alignment)
    storage_key = voice_storage_key(voice_hash)
    from clips_worker.storage import upload_file

    tmp = Path(f"/tmp/t2v-vo-{secrets.token_hex(8)}.mp3")
    try:
        tmp.write_bytes(audio)
        upload_file(storage_key, tmp, "audio/mpeg")
    finally:
        tmp.unlink(missing_ok=True)

    clip_id = f"t2v_{secrets.token_hex(12)}"
    chars = len(text.strip())
    cost_micros = elevenlabs_tts_cost_usd_micros(chars, model_id)
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO t2v_voice_clips
              (id, "workspaceId", hash, provider, "voiceId", "modelId", text, "storageKey",
               "durationMs", alignment, chars, "costUsdMicros")
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s)
            ON CONFLICT ("workspaceId", hash) DO NOTHING
            """,
            (
                clip_id,
                workspace_id,
                voice_hash,
                "elevenlabs",
                voice["voiceId"],
                model_id,
                text,
                storage_key,
                duration_ms,
                json.dumps(alignment),
                chars,
                cost_micros,
            ),
        )
        cur.execute(
            """
            SELECT id FROM t2v_voice_clips WHERE "workspaceId" = %s AND hash = %s
            """,
            (workspace_id, voice_hash),
        )
        clip_id = cur.fetchone()[0]
    record_t2v_voice_usage(
        conn,
        workspace_id=workspace_id,
        project_id=project_id,
        job_id=job_id,
        scene_id=scene_id,
        model_id=model_id,
        char_count=chars,
        cached=False,
    )
    conn.commit()

    return {
        "clipId": clip_id,
        "storageKey": storage_key,
        "durationMs": duration_ms,
        "alignment": alignment,
        "hash": voice_hash,
        "cached": False,
        "modelId": model_id,
    }


def download_voice_clip(storage_key: str, dest: Path) -> Path:
    from clips_worker.storage import download_object

    download_object(storage_key, dest)
    return dest
