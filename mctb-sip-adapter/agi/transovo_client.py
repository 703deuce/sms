"""HTTP client for Transovo /api/internal/voice-runtime (same contract as Python voice worker)."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any


def _backend_base() -> str:
    base = os.environ.get("TRANSOVO_BACKEND_URL", "").strip().rstrip("/")
    if not base:
        raise RuntimeError("TRANSOVO_BACKEND_URL is required")
    return base


def _api_key() -> str:
    secret = (
        os.environ.get("TRANSOVO_INTERNAL_API_KEY", "").strip()
        or os.environ.get("VOICE_RUNTIME_INTERNAL_SECRET", "").strip()
        or os.environ.get("INTEGRATION_SECRET_KEY", "").strip()
    )
    if not secret:
        raise RuntimeError("TRANSOVO_INTERNAL_API_KEY is required")
    return secret


def voice_runtime_call(action: str, payload: dict[str, Any]) -> dict[str, Any]:
    url = f"{_backend_base()}/api/internal/voice-runtime"
    body = json.dumps({"action": action, "payload": payload}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {_api_key()}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            raw = resp.read().decode("utf-8")
    except urllib.error.HTTPError as err:
        detail = err.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"voice-runtime HTTP {err.code}: {detail[:500]}") from err
    except urllib.error.URLError as err:
        raise RuntimeError(f"voice-runtime unreachable: {err}") from err

    parsed = json.loads(raw)
    if not isinstance(parsed, dict):
        raise RuntimeError("voice-runtime returned non-object JSON")
    return parsed


def mirror_trace(event: str, fields: dict[str, Any]) -> None:
    try:
        voice_runtime_call(
            "mctb_sip_e2e_trace",
            {
                "payload": {
                    "source": "asterisk_sip_adapter",
                    "event": event,
                    **fields,
                },
            },
        )
    except Exception:
        # Trace mirroring must never break the call.
        pass
