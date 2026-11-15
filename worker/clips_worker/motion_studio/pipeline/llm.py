"""OpenAI JSON calls for Motion Studio steps. One call per request: NO automatic retries (TEAM.md:
no automatic paid retries). Per-step metrics are returned for the activity log (no prompts/content)."""
from __future__ import annotations

import json
import os
import re
import time
import urllib.error
import urllib.request

from clips_worker.motion_studio.pipeline import config


class LLMError(RuntimeError):
    pass


def chat_json(step: str, system: str, user: str, *, max_tokens: int = 8000, timeout_s: float = 240) -> tuple[dict, dict]:
    model = config.model_for(step)
    metrics = {"step": step, "model": model, "ok": False}
    if config.mock():
        raise LLMError("mock mode: no LLM call")
    key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    if not key:
        raise LLMError("OPENAI_API_KEY is not configured")
    body = {"model": model, "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "response_format": {"type": "json_object"}}
    if re.search(r"gpt-[56]|^o[134]", model, re.I):
        body["max_completion_tokens"] = max_tokens
        if re.search(r"gpt-6", model, re.I):
            body["reasoning_effort"] = config.reasoning_for(step)
    else:
        body["max_tokens"] = max_tokens
        body["temperature"] = 0.4
    req = urllib.request.Request("https://api.openai.com/v1/chat/completions", data=json.dumps(body).encode(),
                                 headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"}, method="POST")
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        snippet = exc.read().decode(errors="replace")[:300]
        metrics.update({"ms": int((time.time() - t0) * 1000), "error": f"http_{exc.code}"})
        raise LLMError(f"OpenAI HTTP {exc.code}: {snippet}") from None
    except Exception as exc:  # noqa: BLE001
        metrics.update({"ms": int((time.time() - t0) * 1000), "error": type(exc).__name__})
        raise LLMError(f"OpenAI call failed: {type(exc).__name__}") from None
    usage = data.get("usage") or {}
    metrics.update({"ok": True, "ms": int((time.time() - t0) * 1000), "promptTokens": usage.get("prompt_tokens"),
                    "completionTokens": usage.get("completion_tokens")})
    content = (data.get("choices") or [{}])[0].get("message", {}).get("content") or "{}"
    try:
        return json.loads(content), metrics
    except ValueError:
        m = re.search(r"\{.*\}", content, re.S)
        if m:
            return json.loads(m.group(0)), metrics
        raise LLMError("model returned non-JSON") from None


def chat_text(step: str, system: str, user: str, *, max_tokens: int = 12000) -> tuple[str, dict]:
    """For scene code: JSON wrapper {"code": "..."} keeps one parsing path."""
    out, m = chat_json(step, system, user, max_tokens=max_tokens)
    return str(out.get("code") or ""), m
