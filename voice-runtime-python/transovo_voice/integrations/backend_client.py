from __future__ import annotations

import os
from typing import Any

import httpx


class TransovoBackend:
    """HTTP client for Transovo internal voice-runtime API (TypeScript backend)."""

    def __init__(self) -> None:
        base = (
            os.getenv("APP_URL", "").strip()
            or os.getenv("NEXT_PUBLIC_APP_URL", "").strip()
            or f"http://127.0.0.1:{os.getenv('PORT', '3000')}"
        ).rstrip("/")
        self._base_url = base
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
        data = resp.json()
        if resp.status_code >= 400:
            raise RuntimeError(data.get("error") or f"HTTP {resp.status_code}")
        return data
