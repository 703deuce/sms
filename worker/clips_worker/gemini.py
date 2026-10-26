"""Gemini REST for ClipAnything vision ranking."""
from __future__ import annotations

import base64
import json
import os
import uuid
from typing import Any

import requests

from clips_worker.gemini_vision import GEMINI_BASE, discover_model, _key

PLAYBOOK = """You are a ClipAnything editor. A good clip has a clear hook in the first 2 seconds
(action starting, reaction, surprise), a visible payoff, and a self-contained arc.
Skip long setup or dead air. Ideal length: 20–45s for action/vlog, up to 60s for tutorials.
Use the user's prompt when provided. Never name real people."""


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
    schema = {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "candidateId": {"type": "string"},
                "start": {"type": "number"},
                "end": {"type": "number"},
                "title": {"type": "string"},
                "reason": {"type": "string"},
                "hook": {"type": "string"},
                "action": {"type": "string"},
                "payoff": {"type": "string"},
                "score": {"type": "integer"},
                "subjectBox": {
                    "type": "object",
                    "properties": {
                        "x": {"type": "number"},
                        "y": {"type": "number"},
                        "w": {"type": "number"},
                        "h": {"type": "number"},
                    },
                },
            },
            "required": ["candidateId", "start", "end", "title", "reason", "hook", "action", "payoff", "score"],
        },
    }

    want = min(max_clips, len(candidates))
    batch = candidates[: min(len(candidates), 24)]
    frame_budget = 300
    parts: list[dict] = [
        {
            "text": (
                f"{PLAYBOOK}\nReturn exactly {want} ranked clips when possible (never more than {want}). "
                f"Each clip score must be >= {min_score}. Sort best-first."
            ),
        },
    ]
    if user_prompt.strip():
        parts.append({"text": f"User prompt: {user_prompt.strip()}"})
    used_frames = 0
    for cand in batch:
        parts.append(
            {
                "text": (
                    f"Candidate {cand['id']}: {cand['start_s']:.1f}-{cand['end_s']:.1f}s, "
                    f"transcript: {cand.get('transcript', '')[:800]}"
                ),
            },
        )
        for fr in cand.get("frames") or []:
            if used_frames >= frame_budget:
                break
            parts.append(
                {
                    "inline_data": {
                        "mime_type": "image/jpeg",
                        "data": base64.b64encode(fr["jpeg"]).decode(),
                    },
                },
            )
            parts.append({"text": f"frame {fr['index']}"})
            used_frames += 1

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
