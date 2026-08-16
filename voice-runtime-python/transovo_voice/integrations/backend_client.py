from __future__ import annotations

import json
import os
from typing import Any

import httpx


def resolve_internal_base_url() -> str:
    """Base URL for same-container calls to /api/internal/voice-runtime."""
    explicit = os.getenv("VOICE_RUNTIME_INTERNAL_URL", "").strip()
    if explicit:
        return explicit.rstrip("/")

    port = os.getenv("PORT", "3000").strip() or "3000"
    return f"http://127.0.0.1:{port}"


class TransovoBackend:
    """HTTP client for Transovo internal voice-runtime API (TypeScript backend)."""

    def __init__(self) -> None:
        self._base_url = resolve_internal_base_url()
        secret = (
            os.getenv("VOICE_RUNTIME_INTERNAL_SECRET", "").strip()
            or os.getenv("INTEGRATION_SECRET_KEY", "").strip()
        )
        if not secret:
            raise RuntimeError("VOICE_RUNTIME_INTERNAL_SECRET or INTEGRATION_SECRET_KEY required")
        self._headers = {
            "Authorization": f"Bearer {secret}",
            "Content-Type": "application/json",
        }
        self._client = httpx.AsyncClient(timeout=60.0)

    async def close(self) -> None:
        await self._client.aclose()

    async def call(self, action: str, payload: dict[str, Any]) -> dict[str, Any]:
        url = f"{self._base_url}/api/internal/voice-runtime"
        resp = await self._client.post(
            url,
            headers=self._headers,
            json={"action": action, "payload": payload},
        )
        body_text = resp.text
        data: dict[str, Any]
        if body_text.strip():
            try:
                parsed = json.loads(body_text)
            except json.JSONDecodeError as err:
                snippet = body_text[:500].replace("\n", " ")
                raise RuntimeError(
                    f"Internal API returned non-JSON (HTTP {resp.status_code}) from {url}: "
                    f"{snippet!r}",
                ) from err
            if not isinstance(parsed, dict):
                raise RuntimeError(
                    f"Internal API returned JSON {type(parsed).__name__}, expected object "
                    f"(HTTP {resp.status_code}) from {url}",
                )
            data = parsed
        else:
            raise RuntimeError(
                f"Internal API returned empty body (HTTP {resp.status_code}) from {url}",
            )

        if resp.status_code >= 400:
            raise RuntimeError(data.get("error") or f"HTTP {resp.status_code}")
        return data
