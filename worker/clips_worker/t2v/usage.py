"""T2V ai_usage rows + [t2v:cost] logging (ElevenLabs voice/music, OpenAI/Gemini vision on web)."""
from __future__ import annotations

import json
import uuid
from typing import Any

# Matches new-app/lib/server/ai/elevenlabs-tts.ts
USD_PER_1K_CHARS: dict[str, float] = {
    "eleven_v4": 0.08,
    "eleven_multilingual_v2": 0.08,
    "eleven_v4_turbo": 0.04,
    "eleven_flash_v2_5": 0.04,
}


def elevenlabs_tts_cost_usd_micros(char_count: int, model_id: str) -> int:
    rate = USD_PER_1K_CHARS.get(model_id, 0.08)
    return int(round((max(0, char_count) / 1000.0) * rate * 1_000_000))


def log_t2v_cost(kind: str, payload: dict[str, Any]) -> None:
    safe = {k: v for k, v in payload.items() if v is not None}
    print(f"[t2v:cost] {kind} {json.dumps(safe, default=str)}", flush=True)


def insert_ai_usage(
    conn,
    *,
    workspace_id: str,
    project_id: str | None,
    clip_id: str | None,
    generation_id: str | None,
    provider: str,
    model: str,
    units: float,
    unit_type: str,
    cost_usd_micros: int,
) -> str:
    row_id = f"aiu_{uuid.uuid4().hex}"
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO ai_usage (
              id, "workspaceId", "projectId", "clipId", "generationId",
              provider, model, units, "unitType", "costUsdMicros", "createdAt"
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
            """,
            (
                row_id,
                workspace_id,
                project_id,
                clip_id,
                generation_id,
                provider,
                model,
                units,
                unit_type,
                cost_usd_micros,
            ),
        )
    return row_id


def record_t2v_voice_usage(
    conn,
    *,
    workspace_id: str,
    project_id: str | None,
    job_id: str | None,
    scene_id: str | None,
    model_id: str,
    char_count: int,
    cached: bool,
) -> None:
    if cached or char_count <= 0:
        return
    cost = elevenlabs_tts_cost_usd_micros(char_count, model_id)
    usage_id = insert_ai_usage(
        conn,
        workspace_id=workspace_id,
        project_id=project_id,
        clip_id=None,
        generation_id=None,
        provider="elevenlabs",
        model=model_id,
        units=float(char_count),
        unit_type="characters",
        cost_usd_micros=cost,
    )
    log_t2v_cost(
        "voice",
        {
            "usageId": usage_id,
            "workspaceId": workspace_id,
            "projectId": project_id,
            "jobId": job_id,
            "sceneId": scene_id,
            "model": model_id,
            "chars": char_count,
            "costUsdMicros": cost,
        },
    )


def record_t2v_music_usage(
    conn,
    *,
    workspace_id: str,
    project_id: str | None,
    job_id: str | None,
    generation_id: str,
    usage: dict[str, Any],
    clip_id: str | None,
) -> None:
    cost = int(usage.get("costUsdMicros") or 0)
    if cost <= 0:
        return
    usage_id = insert_ai_usage(
        conn,
        workspace_id=workspace_id,
        project_id=project_id,
        clip_id=clip_id,
        generation_id=generation_id,
        provider=str(usage.get("provider") or "elevenlabs"),
        model=str(usage.get("model") or "music_v1"),
        units=float(usage.get("units") or 0),
        unit_type=str(usage.get("unitType") or "seconds"),
        cost_usd_micros=cost,
    )
    log_t2v_cost(
        "music",
        {
            "usageId": usage_id,
            "workspaceId": workspace_id,
            "projectId": project_id,
            "jobId": job_id,
            "generationId": generation_id,
            "seconds": usage.get("units"),
            "costUsdMicros": cost,
        },
    )
