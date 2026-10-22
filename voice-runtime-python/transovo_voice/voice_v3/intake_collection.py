from __future__ import annotations

"""
Intake field → LiveKit collection mechanism mapping (Voice V3).

Passive multi-field capture uses the wizard-generated update_intake FunctionTool
(raw schema from Transovo). Active collection for a single missing value may use
LiveKit prebuilt tasks when invoked explicitly from session logic (GPT-Live
compatible paths only).
"""

from typing import Any, Literal

IntakeCollectionKind = Literal[
    "livekit_get_name",
    "livekit_get_email",
    "livekit_get_phone",
    "livekit_get_address",
    "livekit_get_dob",
    "livekit_function_tool",
]

# Maps compiled wizard semantic keys to LiveKit 1.8.2 prebuilt task families.
_STANDARD_FIELD_TO_COLLECTION: dict[str, IntakeCollectionKind] = {
    "name": "livekit_get_name",
    "full_name": "livekit_get_name",
    "email": "livekit_get_email",
    "phone": "livekit_get_phone",
    "service_reason": "livekit_function_tool",
    "address": "livekit_get_address",
    "dob": "livekit_get_dob",
    "date_of_birth": "livekit_get_dob",
}


def resolve_intake_collection_kind(field: dict[str, Any]) -> IntakeCollectionKind:
    """Resolve how to actively collect one wizard field when passive capture did not supply it."""
    explicit = str(field.get("collectionKind") or "").strip()
    if explicit in (
        "livekit_get_name",
        "livekit_get_email",
        "livekit_get_phone",
        "livekit_get_address",
        "livekit_get_dob",
        "livekit_function_tool",
    ):
        return explicit  # type: ignore[return-value]
    key = str(field.get("key") or "").strip().lower()
    field_type = str(field.get("type") or "").strip().lower()
    if key in _STANDARD_FIELD_TO_COLLECTION:
        return _STANDARD_FIELD_TO_COLLECTION[key]
    if field_type in ("email",):
        return "livekit_get_email"
    if field_type in ("phone", "tel"):
        return "livekit_get_phone"
    if field_type in ("name",):
        return "livekit_get_name"
    if field_type in ("address",):
        return "livekit_get_address"
    if field_type in ("date", "dob"):
        return "livekit_get_dob"
    return "livekit_function_tool"


def safe_custom_field_tool_name(stable_field_id: str) -> str:
    """Deterministic LiveKit function name for a wizard custom intake field."""
    safe = "".join(c if c.isalnum() or c == "_" else "_" for c in stable_field_id.strip())
    safe = safe.strip("_") or "field"
    return f"set_intake_{safe}"
