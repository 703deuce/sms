"""Probe transovo-web reachability before LiveKit worker registers."""

from __future__ import annotations

import logging

import httpx

from transovo_voice.integrations.backend_client import resolve_backend_base_url
from transovo_voice.telemetry import log_event

logger = logging.getLogger("transovo-voice.boot")


def probe_backend_health(timeout_sec: float = 10.0) -> None:
    """Log loud failure if TRANSOVO_BACKEND_URL is unreachable (common 502 misconfig)."""
    try:
        base = resolve_backend_base_url()
    except RuntimeError as err:
        log_event("backend_health_probe_failed", extra={"error": str(err)})
        logger.error("%s", err)
        return

    health_url = f"{base}/api/health"
    internal_url = f"{base}/api/internal/voice-runtime"

    try:
        with httpx.Client(timeout=timeout_sec) as client:
            health = client.get(health_url)
            internal_get = client.get(internal_url)

        if health.status_code == 200:
            log_event(
                "backend_health_probe_ok",
                extra={
                    "backendUrl": base,
                    "health_status": health.status_code,
                    "internal_get_status": internal_get.status_code,
                },
            )
            if internal_get.status_code != 200:
                logger.warning(
                    "Internal route GET returned %s — expected 200 JSON probe at %s",
                    internal_get.status_code,
                    internal_url,
                )
            return

        snippet = (health.text or "")[:200].replace("\n", " ")
        log_event(
            "backend_health_probe_failed",
            extra={
                "backendUrl": base,
                "health_url": health_url,
                "status": health.status_code,
                "body": snippet,
            },
        )
        logger.error(
            "TRANSOVO_BACKEND_URL health check failed: GET %s → HTTP %s %r. "
            "Fix transovo-web Coolify app or set TRANSOVO_BACKEND_URL to the URL where /api/health returns 200.",
            health_url,
            health.status_code,
            snippet,
        )
    except httpx.HTTPError as err:
        log_event(
            "backend_health_probe_failed",
            extra={"backendUrl": base, "health_url": health_url, "error": str(err)},
        )
        logger.error(
            "TRANSOVO_BACKEND_URL unreachable: GET %s failed (%s). "
            "transovo-web may be down or domain does not point to the web container.",
            health_url,
            err,
        )
