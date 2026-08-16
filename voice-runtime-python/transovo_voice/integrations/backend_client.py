from __future__ import annotations

import asyncio
import json
import os
import time
from typing import Any

import httpx

from transovo_voice.telemetry import log_event

INTERNAL_API_PATH = "/api/internal/voice-runtime"
_TRANSIENT_BACKEND_RETRY_DELAYS_SEC = (0.8, 1.6, 3.2, 5.0)


def _is_transient_backend_error(message: str) -> bool:
    lowered = message.lower()
    return "schema cache" in lowered or "pgrst002" in lowered


def resolve_backend_base_url() -> str:
    """Public or private base URL for the Transovo web/backend service."""
    base = os.getenv("TRANSOVO_BACKEND_URL", "").strip().rstrip("/")
    if not base:
        raise RuntimeError(
            "TRANSOVO_BACKEND_URL is required (e.g. https://app.transovo.ai or http://web:3000)",
        )
    return base


def resolve_internal_api_key() -> str:
    secret = (
        os.getenv("TRANSOVO_INTERNAL_API_KEY", "").strip()
        or os.getenv("VOICE_RUNTIME_INTERNAL_SECRET", "").strip()
        or os.getenv("INTEGRATION_SECRET_KEY", "").strip()
    )
    if not secret:
        raise RuntimeError(
            "TRANSOVO_INTERNAL_API_KEY (or VOICE_RUNTIME_INTERNAL_SECRET) is required",
        )
    return secret


def _sanitize_for_log(value: str, max_len: int = 200) -> str:
    text = value.replace("\n", " ").strip()
    if len(text) > max_len:
        return text[:max_len] + "…"
    return text


class TransovoBackend:
    """HTTP client for Transovo internal voice-runtime API (TypeScript backend)."""

    def __init__(self) -> None:
        self._base_url = resolve_backend_base_url()
        secret = resolve_internal_api_key()
        self._headers = {
            "Authorization": f"Bearer {secret}",
            "Content-Type": "application/json",
        }
        self._client = httpx.AsyncClient(timeout=60.0)

    async def close(self) -> None:
        await self._client.aclose()

    async def call(self, action: str, payload: dict[str, Any]) -> dict[str, Any]:
        url = f"{self._base_url}{INTERNAL_API_PATH}"
        started = time.perf_counter()
        log_event(
            "backend_request_started",
            extra={
                "endpoint": INTERNAL_API_PATH,
                "action": action,
                "backendUrl": self._base_url,
            },
        )

        last_error: str | None = None
        for attempt in range(len(_TRANSIENT_BACKEND_RETRY_DELAYS_SEC) + 1):
            try:
                resp = await self._client.post(
                    url,
                    headers=self._headers,
                    json={"action": action, "payload": payload},
                )
            except httpx.HTTPError as err:
                duration_ms = int((time.perf_counter() - started) * 1000)
                log_event(
                    "backend_request_failed",
                    extra={
                        "endpoint": INTERNAL_API_PATH,
                        "action": action,
                        "duration_ms": duration_ms,
                        "error": _sanitize_for_log(str(err)),
                    },
                )
                raise RuntimeError(
                    f"Backend request failed for action={action} url={url}: {err}",
                ) from err

            duration_ms = int((time.perf_counter() - started) * 1000)
            content_type = resp.headers.get("content-type", "")
            body_text = resp.text
            body_length = len(resp.content)

            log_event(
                "backend_response_received",
                extra={
                    "endpoint": INTERNAL_API_PATH,
                    "action": action,
                    "status": resp.status_code,
                    "content_type": content_type,
                    "body_length": body_length,
                    "duration_ms": duration_ms,
                    "attempt": attempt + 1,
                },
            )

            if not body_text.strip():
                raise RuntimeError(
                    f"Backend returned empty body for action={action} "
                    f"(HTTP {resp.status_code}) from {url}",
                )

            if "application/json" not in content_type.lower() and not body_text.lstrip().startswith(("{", "[")):
                snippet = _sanitize_for_log(body_text)
                raise RuntimeError(
                    f"Backend returned non-JSON for action={action} "
                    f"(HTTP {resp.status_code}, content-type={content_type!r}): {snippet!r}",
                )

            try:
                parsed = json.loads(body_text)
            except json.JSONDecodeError as err:
                snippet = _sanitize_for_log(body_text)
                raise RuntimeError(
                    f"Backend JSON decode failed for action={action} "
                    f"(HTTP {resp.status_code}): {snippet!r}",
                ) from err

            if not isinstance(parsed, dict):
                raise RuntimeError(
                    f"Backend returned JSON {type(parsed).__name__}, expected object "
                    f"for action={action} (HTTP {resp.status_code})",
                )

            if resp.status_code >= 400:
                error_msg = str(parsed.get("error") or f"HTTP {resp.status_code}")
                last_error = error_msg
                if (
                    _is_transient_backend_error(error_msg)
                    and attempt < len(_TRANSIENT_BACKEND_RETRY_DELAYS_SEC)
                ):
                    delay = _TRANSIENT_BACKEND_RETRY_DELAYS_SEC[attempt]
                    log_event(
                        "backend_transient_error_retry",
                        extra={
                            "action": action,
                            "attempt": attempt + 1,
                            "delay_sec": delay,
                            "error": _sanitize_for_log(error_msg),
                        },
                    )
                    await asyncio.sleep(delay)
                    continue

                hint = ""
                if resp.status_code == 502:
                    hint = (
                        f" Proxy returned 502 — verify GET {self._base_url}/api/health returns 200 "
                        "and TRANSOVO_BACKEND_URL matches the live transovo-web Coolify domain."
                    )
                raise RuntimeError(
                    f"Backend error for action={action} (HTTP {resp.status_code}): {error_msg}{hint}",
                )

            return parsed

        raise RuntimeError(
            f"Backend error for action={action} after retries: {last_error or 'unknown'}",
        )
