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


def _response_format(schema: dict | None, schema_name: str | None) -> dict:
    """Use strict json_schema when a contract is provided.

    Same shape as clips_worker/picker/llm.py, which already calls gpt-6-luna
    with response_format.json_schema.strict. When no schema is given, keep
    json_object so existing callers stay valid.
    """
    if schema:
        return {
            "type": "json_schema",
            "json_schema": {
                "name": (schema_name or "response")[:64],
                "strict": True,
                "schema": schema,
            },
        }
    return {"type": "json_object"}


def chat_json(step: str, system: str, user: str, *, max_tokens: int = 8000, timeout_s: float = 240,
              schema: dict | None = None, schema_name: str | None = None) -> tuple[dict, dict]:
    model = config.model_for(step)
    metrics = {"step": step, "model": model, "ok": False}
    if config.mock():
        raise LLMError("mock mode: no LLM call")
    key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    if not key:
        raise LLMError("OPENAI_API_KEY is not configured")
    body = {"model": model, "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "response_format": _response_format(schema, schema_name)}
    if schema:
        metrics["schema"] = schema_name or "response"
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
    details = (usage.get("completion_tokens_details") or {})
    choice = (data.get("choices") or [{}])[0]
    msg = choice.get("message") or {}
    content = msg.get("content")
    if isinstance(content, list):
        content = "".join((p.get("text") if isinstance(p, dict) else str(p)) or "" for p in content)
    content = content or ""
    metrics.update({"ok": True, "ms": int((time.time() - t0) * 1000), "promptTokens": usage.get("prompt_tokens"),
                    "completionTokens": usage.get("completion_tokens"),
                    "reasoningTokens": details.get("reasoning_tokens"),
                    "finishReason": choice.get("finish_reason"),
                    "contentChars": len(content)})
    if not content.strip():
        raise LLMError(f"model returned empty content (finish={choice.get('finish_reason')}, "
                       f"completion_tokens={usage.get('completion_tokens')}, "
                       f"reasoning_tokens={details.get('reasoning_tokens')})")
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
