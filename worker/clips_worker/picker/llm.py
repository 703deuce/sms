"""OpenAI gpt-6-luna JSON calls for clip picker."""
from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from typing import Any


def model_id() -> str:
    return os.environ.get("CLIP_LLM_MODEL", "gpt-6-luna").strip() or "gpt-6-luna"


def _request_body(system: str, user: str, schema: dict[str, Any], schema_name: str) -> dict[str, Any]:
    model = model_id()
    body: dict[str, Any] = {
        "model": model,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "response_format": {
            "type": "json_schema",
            "json_schema": {"name": schema_name, "strict": True, "schema": schema},
        },
    }
    max_tok = int(os.environ.get("CLIP_LLM_MAX_TOKENS", "4096"))
    if re.search(r"gpt-[56]|^o[134]", model, re.I):
        body["max_completion_tokens"] = max_tok
        if re.search(r"gpt-6", model, re.I):
            body["reasoning_effort"] = os.environ.get("CLIP_LLM_REASONING_EFFORT", "none")
    else:
        body["max_tokens"] = max_tok
        body["temperature"] = 0.3
    return body


def chat_json(system: str, user: str, schema: dict[str, Any], schema_name: str = "response") -> dict[str, Any]:
    key = os.environ["OPENAI_API_KEY"]
    payload = json.dumps(_request_body(system, user, schema, schema_name)).encode()
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=payload,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode(errors="replace")
        snippet = raw[:500]
        print(f"openai chat_json HTTP {exc.code}: {snippet}", flush=True)
        raise RuntimeError(f"OpenAI HTTP {exc.code}: {snippet}") from exc
    content = data["choices"][0]["message"]["content"]
    return json.loads(content)
