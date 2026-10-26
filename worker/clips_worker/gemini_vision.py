"""Gemini vision for thumbnail planning (worker)."""
from __future__ import annotations

import json
import os
from typing import Any

import requests

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"


def _key() -> str:
    k = (os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_GEMINI_API_KEY") or "").strip()
    if not k:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    return k


def discover_model() -> str:
    configured = (os.environ.get("VISION_MODEL") or "").strip()
    if configured:
        return configured
    res = requests.get(f"{GEMINI_BASE}/models", params={"key": _key()}, timeout=30)
    res.raise_for_status()
    models = res.json().get("models") or []
    candidates = []
    for m in models:
        name = str(m.get("name", "")).replace("models/", "")
        methods = m.get("supportedGenerationMethods") or []
        if "flash-lite" in name.lower() and "generateContent" in methods:
            candidates.append(name)
    if not candidates:
        raise RuntimeError("no gemini flash-lite model found")
    return sorted(candidates)[-1]


def plan_thumbnail(
    frames: list[dict],
    transcript: str,
    title: str,
    title_override: str | None = None,
) -> dict[str, Any]:
    model = discover_model()
    schema = {
        "type": "object",
        "properties": {
            "bestFrameIndexes": {"type": "array", "items": {"type": "integer"}},
            "titleText": {"type": "string"},
            "prompts": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["bestFrameIndexes", "titleText", "prompts"],
    }
    parts: list[dict] = []
    import base64

    for f in frames:
        parts.append({"inline_data": {"mime_type": "image/jpeg", "data": base64.b64encode(f["jpeg"]).decode()}})
        parts.append({"text": f"Frame index {f['index']}"})
    parts.append(
        {
            "text": f"Clip title: {title}\nTranscript: {transcript[:2000]}\n"
            f"{f'Preferred title: {title_override}' if title_override else ''}\n"
            "Pick best 1-2 frame indexes. titleText max 5 words. Exactly 3 YouTube thumbnail prompts.",
        }
    )
    res = requests.post(
        f"{GEMINI_BASE}/models/{model}:generateContent",
        params={"key": _key()},
        json={
            "contents": [{"role": "user", "parts": parts}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseSchema": schema,
                "temperature": 0.4,
            },
        },
        timeout=90,
    )
    if not res.ok:
        raise RuntimeError(res.text[:400])
    data = res.json()
    text = data["candidates"][0]["content"]["parts"][0]["text"]
    plan = json.loads(text)
    plan["prompts"] = list(plan.get("prompts") or [])[:3]
    plan["bestFrameIndexes"] = list(plan.get("bestFrameIndexes") or [0])[:2]
    return plan
