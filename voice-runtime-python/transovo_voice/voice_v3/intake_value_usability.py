from __future__ import annotations

import re
from typing import Any

from transovo_voice.voice_v3.intake_collection import IntakeCollectionKind, resolve_intake_collection_kind

_PLACEHOLDER_VALUES = frozenset(
    {
        "null",
        "none",
        "n/a",
        "na",
        "undefined",
        "unknown",
        "not provided",
        "not applicable",
    }
)

_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def _text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _is_placeholder(text: str) -> bool:
    if not text:
        return True
    lower = text.lower()
    if lower in _PLACEHOLDER_VALUES:
        return True
    if len(text) <= 2 and not any(ch.isdigit() for ch in text):
        return True
    return False


def passive_intake_value_usable(kind: IntakeCollectionKind, value: Any) -> bool:
    """Whether a passively captured value is good enough to skip LiveKit active collection."""
    if kind == "livekit_function_tool":
        return True

    text = _text(value)
    if _is_placeholder(text):
        return False

    if kind == "livekit_get_phone":
        digits = "".join(ch for ch in text if ch.isdigit())
        return len(digits) >= 10

    if kind == "livekit_get_email":
        return bool(_EMAIL_RE.match(text.lower()))

    if kind == "livekit_get_name":
        return len(text) >= 2 and any(ch.isalpha() for ch in text)

    if kind == "livekit_get_address":
        return len(text) >= 5

    if kind == "livekit_get_dob":
        digits = sum(ch.isdigit() for ch in text)
        return digits >= 6

    return True


def collection_kind_for_field_meta(meta: dict[str, Any] | None) -> IntakeCollectionKind:
    if meta is None:
        return "livekit_function_tool"
    return resolve_intake_collection_kind(meta)


def field_needs_active_collection(meta: dict[str, Any] | None, value: Any) -> bool:
    kind = collection_kind_for_field_meta(meta)
    if kind == "livekit_function_tool":
        return False
    return not passive_intake_value_usable(kind, value)
