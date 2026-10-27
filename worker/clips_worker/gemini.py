"""Gemini REST for ClipAnything vision ranking."""
from __future__ import annotations

import json
import os
import uuid
from typing import Any

import requests

from clips_worker.clip_anything_vision import PLAYBOOK, build_rank_user_parts, rank_response_schema
from clips_worker.gemini_vision import GEMINI_BASE, discover_model, _key


def _log_usage(conn, workspace_id: str, project_id: str | None, model: str, prompt_tokens: int, output_tokens: int) -> None:
    import psycopg2  # noqa: F401 — worker runtime dep
    in_micros = int((prompt_tokens / 1_000_000) * 0.25 * 1_000_000)
    out_micros = int((output_tokens / 1_000_000) * 1.5 * 1_000_000)
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO ai_usage (id, "workspaceId", "projectId", provider, model, units, "unitType", "costUsdMicros", "createdAt")
            VALUES (%s,%s,%s,'gemini',%s,%s,'tokens',%s,NOW())
            """,
            (
                f"aiu_{uuid.uuid4().hex[:12]}",
                workspace_id,
                project_id,
                model,
                prompt_tokens + output_tokens,
                in_micros + out_micros,
            ),
        )
    conn.commit()


def rank_clipanything_candidates(
    conn,
    *,
    workspace_id: str,
    project_id: str,
    candidates: list[dict],
    user_prompt: str,
    max_clips: int = 10,
    min_score: int = 40,
) -> list[dict[str, Any]]:
    """candidates: {id, start_s, end_s, transcript, frames:[{jpeg,index}]}"""
    model = discover_model()
    schema = rank_response_schema()
    openai_parts = build_rank_user_parts(
        candidates,
        user_prompt=user_prompt,
        max_clips=max_clips,
        min_score=min_score,
    )
    parts: list[dict] = []
    for p in openai_parts:
        if p.get("type") == "text":
            parts.append({"text": p["text"]})
        elif p.get("type") == "image_url":
            url = str(p.get("image_url", {}).get("url", ""))
            prefix = "data:image/jpeg;base64,"
            if url.startswith(prefix):
                parts.append(
                    {
                        "inline_data": {
                            "mime_type": "image/jpeg",
                            "data": url[len(prefix) :],
                        },
                    },
                )
            else:
                continue
        else:
            continue

    res = requests.post(
        f"{GEMINI_BASE}/models/{model}:generateContent",
        params={"key": _key()},
        json={
            "systemInstruction": {"parts": [{"text": PLAYBOOK}]},
            "contents": [{"role": "user", "parts": parts}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseSchema": schema,
            },
        },
        timeout=120,
    )
    if not res.ok:
        raise RuntimeError(res.text[:500])
    data = res.json()
    text = data["candidates"][0]["content"]["parts"][0]["text"]
    ranked = json.loads(text)
    usage = data.get("usageMetadata") or {}
    _log_usage(
        conn,
        workspace_id,
        project_id,
        model,
        int(usage.get("promptTokenCount") or 0),
        int(usage.get("candidatesTokenCount") or 0),
    )
    if not isinstance(ranked, list):
        raise RuntimeError("Gemini ranking response was not an array")
    return ranked
