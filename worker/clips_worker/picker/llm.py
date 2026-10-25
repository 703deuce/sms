"""OpenAI gpt-6-luna JSON calls for clip picker."""
from __future__ import annotations

import json
import os
import urllib.request
from typing import Any


def model_id() -> str:
    return os.environ.get("CLIP_LLM_MODEL", "gpt-6-luna").strip() or "gpt-6-luna"


def chat_json(system: str, user: str, schema: dict[str, Any], schema_name: str = "response") -> dict[str, Any]:
    key = os.environ["OPENAI_API_KEY"]
    body = json.dumps(
        {
            "model": model_id(),
            "temperature": 0.3,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "response_format": {
                "type": "json_schema",
                "json_schema": {"name": schema_name, "strict": True, "schema": schema},
            },
        }
    ).encode()
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=body,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        data = json.loads(resp.read())
    content = data["choices"][0]["message"]["content"]
    return json.loads(content)
