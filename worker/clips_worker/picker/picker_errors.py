"""Loud picker / rank failures (no secrets in logs)."""
from __future__ import annotations

import json
import re
from typing import Any

from clips_worker.streamer.errors import RetryableError


def _sanitize_log_text(text: str, limit: int = 320) -> str:
    return re.sub(r"\s+", " ", (text or "").strip())[:limit]


def gemini_error_log_fields(body: str) -> tuple[str, dict[str, str]]:
    """Parse Gemini/Google API error JSON; extract quota fields (no API keys)."""
    quota: dict[str, str] = {}
    summary = _sanitize_log_text(body)
    try:
        data = json.loads(body)
    except (json.JSONDecodeError, TypeError):
        return summary, quota
    err = data.get("error") if isinstance(data, dict) else None
    if not isinstance(err, dict):
        return summary, quota
    if err.get("message"):
        summary = _sanitize_log_text(str(err["message"]))
    if err.get("status"):
        quota["errorStatus"] = str(err["status"])[:80]
    details = err.get("details") or []
    if not isinstance(details, list):
        return summary, quota
    for detail in details:
        if not isinstance(detail, dict):
            continue
        typ = str(detail.get("@type") or "")
        if "QuotaFailure" in typ:
            violations = detail.get("violations") or []
            if isinstance(violations, list):
                for v in violations:
                    if not isinstance(v, dict):
                        continue
                    if v.get("quotaId"):
                        quota["quotaId"] = str(v["quotaId"])[:120]
                    if v.get("quotaMetric"):
                        quota["quotaMetric"] = str(v["quotaMetric"])[:160]
                    if v.get("quotaValue") is not None:
                        quota["quotaValue"] = str(v["quotaValue"])[:40]
        if "RetryInfo" in typ and detail.get("retryDelay"):
            quota["retryDelay"] = str(detail["retryDelay"])[:32]
        if "ErrorInfo" in typ:
            meta = detail.get("metadata") or {}
            if isinstance(meta, dict):
                if meta.get("quota_metric") and "quotaMetric" not in quota:
                    quota["quotaMetric"] = str(meta["quota_metric"])[:160]
                if meta.get("quota_limit_value") and "quotaValue" not in quota:
                    quota["quotaValue"] = str(meta["quota_limit_value"])[:40]
                if meta.get("quota_limit") and "quotaLimit" not in quota:
                    quota["quotaLimit"] = str(meta["quota_limit"])[:80]
                if detail.get("reason"):
                    quota["reason"] = str(detail["reason"])[:80]
    return summary, quota


def log_picker_error(
    provider: str,
    message: str,
    status: int | str | None = None,
    *,
    quota: dict[str, str] | None = None,
) -> None:
    st = status if status is not None else "n/a"
    msg = _sanitize_log_text(message)
    extra = ""
    if quota:
        parts = [f"{k}={v}" for k, v in quota.items() if v]
        if parts:
            extra = " " + " ".join(parts)
    print(f"[clipper:picker_error] provider={provider} status={st} message={msg}{extra}", flush=True)


def parse_retry_delay_seconds(retry_delay: str | None) -> float | None:
    """Parse google.rpc.RetryInfo retryDelay (e.g. '34s' or '34.500s')."""
    if not retry_delay:
        return None
    m = re.match(r"^([\d.]+)s?$", str(retry_delay).strip(), re.I)
    if not m:
        return None
    try:
        return float(m.group(1))
    except ValueError:
        return None


class VideoPickerRetryableError(RetryableError):
    """Gemini video watch failed; job should requeue with backoff (no synthetic moments)."""

    def __init__(
        self,
        message: str,
        *,
        user_message: str | None = None,
        delay_seconds: int = 90,
    ) -> None:
        super().__init__(message)
        self.user_message = (
            user_message
            or "Video clip discovery is temporarily unavailable. We'll retry automatically."
        )
        self.delay_seconds = max(1, min(600, int(delay_seconds)))
