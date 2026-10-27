"""ClipAnything vision: OpenAI (CLIP_ANYTHING_VISION_MODEL) → Gemini Flash-Lite → local picker."""
from __future__ import annotations

import base64
import json
import os
import re
import socket
import time
import uuid
from typing import Any

import urllib.error
import urllib.request

LOG_PREFIX = "[clipper:anything]"

PLAYBOOK = """You are a ClipAnything editor. A good clip has a clear hook in the first 2 seconds
(action starting, reaction, surprise), a visible payoff, and a self-contained arc.
Skip long setup or dead air. Ideal length: 20–45s for action/vlog, up to 60s for tutorials.
Use the user's prompt when provided. Never name real people."""


def primary_vision_model() -> str:
    return (os.environ.get("CLIP_ANYTHING_VISION_MODEL") or "gpt-6-luna").strip() or "gpt-6-luna"


def vision_timeout_s() -> float:
    raw = (os.environ.get("CLIP_ANYTHING_VISION_TIMEOUT_S") or "120").strip()
    try:
        return max(10.0, float(raw))
    except ValueError:
        return 120.0


def openai_reasoning_effort(model: str) -> str | None:
    if not re.search(r"gpt-6", model, re.I):
        return None
    raw = (os.environ.get("CLIP_ANYTHING_VISION_REASONING_EFFORT") or "low").strip().lower()
    if raw in ("none", "low", "medium", "high"):
        return raw
    return "low"


def luna_token_cost_micros(prompt_tokens: int, completion_tokens: int) -> int:
    return int(round(prompt_tokens * 0.1 + completion_tokens * 0.5))


def rank_response_schema() -> dict[str, Any]:
    return {
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
            "required": [
                "candidateId",
                "start",
                "end",
                "title",
                "reason",
                "hook",
                "action",
                "payoff",
                "score",
            ],
        },
    }


def build_rank_user_parts(
    candidates: list[dict],
    *,
    user_prompt: str,
    max_clips: int,
    min_score: int,
    frame_budget: int = 300,
) -> list[dict[str, Any]]:
    want = min(max_clips, len(candidates))
    batch = candidates[: min(len(candidates), 24)]
    parts: list[dict[str, Any]] = [
        {
            "type": "text",
            "text": (
                f"{PLAYBOOK}\nReturn exactly {want} ranked clips when possible (never more than {want}). "
                f"Each clip score must be >= {min_score}. Sort best-first."
            ),
        },
    ]
    if user_prompt.strip():
        parts.append({"type": "text", "text": f"User prompt: {user_prompt.strip()}"})
    used_frames = 0
    for cand in batch:
        parts.append(
            {
                "type": "text",
                "text": (
                    f"Candidate {cand['id']}: {cand['start_s']:.1f}-{cand['end_s']:.1f}s, "
                    f"transcript: {cand.get('transcript', '')[:800]}"
                ),
            },
        )
        for fr in cand.get("frames") or []:
            if used_frames >= frame_budget:
                break
            jpeg = fr.get("jpeg")
            if not jpeg:
                continue
            b64 = base64.b64encode(jpeg).decode()
            parts.append(
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{b64}", "detail": "low"},
                },
            )
            parts.append({"type": "text", "text": f"frame {fr['index']}"})
            used_frames += 1
    return parts


def _log_usage_openai(
    conn,
    workspace_id: str,
    project_id: str | None,
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
) -> int:
    cost = luna_token_cost_micros(prompt_tokens, completion_tokens)
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO ai_usage (id, "workspaceId", "projectId", provider, model, units, "unitType", "costUsdMicros", "createdAt")
            VALUES (%s,%s,%s,'openai',%s,%s,'tokens',%s,NOW())
            """,
            (
                f"aiu_{uuid.uuid4().hex[:12]}",
                workspace_id,
                project_id,
                model,
                prompt_tokens + completion_tokens,
                cost,
            ),
        )
    conn.commit()
    return cost


def _log_line(
    *,
    project_id: str,
    model: str,
    provider: str,
    latency_ms: int,
    prompt_tokens: int,
    completion_tokens: int,
    cost_usd_micros: int,
    fallback: bool,
    fallback_reason: str | None,
    ranked_count: int,
) -> None:
    fb = f" fallback=true reason={fallback_reason!r}" if fallback else " fallback=false"
    print(
        f"{LOG_PREFIX} provider={provider} model={model} project={project_id} "
        f"latency_ms={latency_ms} prompt_tokens={prompt_tokens} completion_tokens={completion_tokens} "
        f"cost_usd_micros={cost_usd_micros} ranked={ranked_count}{fb}",
        flush=True,
    )


def rank_clipanything_openai(
    conn,
    *,
    workspace_id: str,
    project_id: str,
    candidates: list[dict],
    user_prompt: str,
    max_clips: int = 10,
    min_score: int = 40,
    model: str,
) -> list[dict[str, Any]]:
    key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    if not key:
        raise RuntimeError("OPENAI_API_KEY is not configured")

    array_schema = rank_response_schema()
    schema = {
        "type": "object",
        "properties": {"clips": array_schema},
        "required": ["clips"],
        "additionalProperties": False,
    }
    parts = build_rank_user_parts(
        candidates,
        user_prompt=user_prompt,
        max_clips=max_clips,
        min_score=min_score,
    )
    body: dict[str, Any] = {
        "model": model,
        "messages": [
            {"role": "system", "content": PLAYBOOK},
            {"role": "user", "content": parts},
        ],
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "clipanything_rank",
                "strict": True,
                "schema": schema,
            },
        },
        "max_completion_tokens": int(os.environ.get("CLIP_ANYTHING_VISION_MAX_TOKENS", "8192")),
    }
    effort = openai_reasoning_effort(model)
    if effort is not None:
        body["reasoning_effort"] = effort

    payload = json.dumps(body).encode()
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=payload,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    timeout = vision_timeout_s()
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode(errors="replace")[:500]
        raise RuntimeError(f"OpenAI HTTP {exc.code}: {raw}") from exc
    except (TimeoutError, socket.timeout) as exc:
        raise RuntimeError(f"OpenAI vision timed out after {timeout}s") from exc

    latency_ms = int((time.perf_counter() - t0) * 1000)
    content = data["choices"][0]["message"]["content"]
    parsed = json.loads(content)
    ranked = parsed.get("clips") if isinstance(parsed, dict) else parsed
    if not isinstance(ranked, list):
        raise RuntimeError("OpenAI ranking response was not a clips array")
    usage = data.get("usage") or {}
    prompt_tokens = int(usage.get("prompt_tokens") or 0)
    completion_tokens = int(usage.get("completion_tokens") or 0)
    cost = _log_usage_openai(conn, workspace_id, project_id, model, prompt_tokens, completion_tokens)
    _log_line(
        project_id=project_id,
        model=model,
        provider="openai",
        latency_ms=latency_ms,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        cost_usd_micros=cost,
        fallback=False,
        fallback_reason=None,
        ranked_count=len(ranked),
    )
    return ranked


def rank_clipanything_candidates_resilient(
    conn,
    *,
    workspace_id: str,
    project_id: str,
    candidates: list[dict],
    user_prompt: str,
    max_clips: int = 10,
    min_score: int = 40,
) -> list[dict[str, Any]]:
    """Primary Luna/OpenAI vision, then Gemini Flash-Lite; empty list → local picker in anything_picker."""
    model = primary_vision_model()
    primary_err: str | None = None

    if (os.environ.get("OPENAI_API_KEY") or "").strip():
        try:
            return rank_clipanything_openai(
                conn,
                workspace_id=workspace_id,
                project_id=project_id,
                candidates=candidates,
                user_prompt=user_prompt,
                max_clips=max_clips,
                min_score=min_score,
                model=model,
            )
        except Exception as exc:
            primary_err = str(exc)[:240]
            print(
                f"{LOG_PREFIX} primary_failed model={model} project={project_id} error={primary_err!r}",
                flush=True,
            )
    else:
        primary_err = "OPENAI_API_KEY missing"
        print(
            f"{LOG_PREFIX} primary_skipped model={model} project={project_id} reason={primary_err}",
            flush=True,
        )

    from clips_worker.gemini import rank_clipanything_candidates

    t0 = time.perf_counter()
    try:
        ranked = rank_clipanything_candidates(
            conn,
            workspace_id=workspace_id,
            project_id=project_id,
            candidates=candidates,
            user_prompt=user_prompt,
            max_clips=max_clips,
            min_score=min_score,
        )
    except Exception as exc:
        gemini_err = str(exc)[:240]
        print(
            f"{LOG_PREFIX} gemini_failed project={project_id} error={gemini_err!r} "
            f"primary_error={primary_err!r}",
            flush=True,
        )
        return []

    latency_ms = int((time.perf_counter() - t0) * 1000)
    print(
        f"{LOG_PREFIX} provider=gemini model=flash-lite project={project_id} latency_ms={latency_ms} "
        f"ranked={len(ranked)} fallback=true reason={primary_err!r}",
        flush=True,
    )
    return ranked
