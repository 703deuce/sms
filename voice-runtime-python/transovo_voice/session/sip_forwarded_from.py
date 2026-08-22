"""Forwarded-from extraction for LiveKit SIP participant attributes."""

from __future__ import annotations

import re

_FORWARD_KEY = re.compile(r"diversion|forward|history-info|redirected", re.I)
_SIP_URI = re.compile(r"sip:([^@>;]+)", re.I)
_TEL_URI = re.compile(r"tel:([^;>]+)", re.I)


def _normalize_e164(raw: str | None) -> str | None:
    if not raw:
        return None
    value = raw.strip()
    sip_match = _SIP_URI.search(value)
    tel_match = _TEL_URI.search(value)
    candidate = (sip_match.group(1) if sip_match else None) or (
        tel_match.group(1) if tel_match else value
    )
    candidate = candidate.strip()
    digits = re.sub(r"\D", "", candidate)
    if not digits:
        return None
    if candidate.startswith("+"):
        return candidate
    if len(digits) == 10:
        return f"+1{digits}"
    if len(digits) == 11 and digits.startswith("1"):
        return f"+{digits}"
    return f"+{digits}" if digits else None


def extract_forwarded_from_sip_attributes(
    attrs: dict[str, str],
) -> tuple[str | None, str | None]:
    """Return (forwardedFromE164, diversionHeaderRaw)."""
    for key, value in attrs.items():
        if not _FORWARD_KEY.search(key):
            continue
        raw = str(value or "").strip()[:500]
        if not raw:
            continue
        normalized = _normalize_e164(raw)
        if normalized or raw:
            return normalized, raw
    return None, None
