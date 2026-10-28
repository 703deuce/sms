"""Gemini vision for thumbnail planning (worker)."""
from __future__ import annotations

import json
import os
from typing import Any

import requests

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"

# Stable default for clipper text/vision/rank (thumbnails, LLM rank).
DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"

# Video-watch default (mixed_4min bake-off: prefer 3.8 Flash when quality ties).
DEFAULT_VIDEO_PICKER_MODEL = "gemini-3.8-flash"
DEFAULT_VIDEO_PICKER_FALLBACK_MODEL = "gemini-3.5-flash-lite"

# Paid list prices (USD per 1M tokens) for cost logging — see ai.google.dev/pricing.
GEMINI_USD_PER_1M_TOKENS: dict[str, tuple[float, float]] = {
    "gemini-2.5-flash": (0.10, 0.40),
    "gemini-3.8-flash": (0.75, 3.75),  # intro through 2026-12-31; then 1.50 / 7.50
    "gemini-3.5-flash-lite": (0.30, 2.50),
}


def gemini_token_pricing_usd(model: str) -> tuple[float, float]:
    """Return (input_usd_per_1m, output_usd_per_1m) for a model id."""
    low = (model or "").lower()
    for key, prices in GEMINI_USD_PER_1M_TOKENS.items():
        if key in low or low in key:
            return prices
    try:
        in_per_m = float(os.environ.get("VIDEO_PICKER_USD_PER_1M_INPUT", "0.10"))
        out_per_m = float(os.environ.get("VIDEO_PICKER_USD_PER_1M_OUTPUT", "0.40"))
    except ValueError:
        in_per_m, out_per_m = 0.10, 0.40
    return in_per_m, out_per_m

_GEMINI_MODEL_BLOCKLIST = ("preview", "omni", "tts", "image", "imagen", "experimental", "-exp")


def _key() -> str:
    k = (os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_GEMINI_API_KEY") or "").strip()
    if not k:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    return k


def _gemini_model_blocked(name: str) -> bool:
    low = (name or "").lower()
    return any(token in low for token in _GEMINI_MODEL_BLOCKLIST)


def resolve_gemini_model(
    *,
    env_var: str | None = None,
    fallback_env_vars: tuple[str, ...] = (),
    default: str = DEFAULT_GEMINI_MODEL,
) -> str:
    """Pinned Gemini model for clipper paths; no ListModels auto-pick."""
    candidates: list[str] = []
    if env_var:
        v = (os.environ.get(env_var) or "").strip()
        if v:
            candidates.append(v)
    for key in fallback_env_vars:
        v = (os.environ.get(key) or "").strip()
        if v:
            candidates.append(v)
            break
    for raw in candidates:
        if _gemini_model_blocked(raw):
            print(
                f"[clipper:gemini_model] blocked env model={raw!r} "
                f"reason=preview/omni/tts/image using={default}",
                flush=True,
            )
            continue
        return raw
    return default


def discover_model() -> str:
    """Text/vision rank, thumbnails, stream llm_rank Gemini fallback."""
    return resolve_gemini_model(
        env_var="GEMINI_MODEL",
        fallback_env_vars=("VISION_MODEL",),
        default=DEFAULT_GEMINI_MODEL,
    )


def discover_video_picker_model() -> str:
    """Gemini video-watch for regular/stream picker."""
    return resolve_gemini_model(
        env_var="VIDEO_PICKER_MODEL",
        default=DEFAULT_VIDEO_PICKER_MODEL,
    )


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
