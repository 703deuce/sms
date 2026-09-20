from __future__ import annotations

import logging
from typing import Any

from livekit.agents.beta.workflows import (
    GetAddressTask,
    GetDOBTask,
    GetEmailTask,
    GetNameTask,
    GetPhoneNumberTask,
)
from livekit.agents.llm.tool_context import ToolError
from livekit.agents.types import NOT_GIVEN
from livekit.agents.voice.events import RunContext

from transovo_voice.voice_v3.intake_collection import resolve_intake_collection_kind

logger = logging.getLogger("transovo-voice.voice_v3.intake_active")

_TASK_BY_KIND: dict[str, type] = {
    "livekit_get_name": GetNameTask,
    "livekit_get_email": GetEmailTask,
    "livekit_get_phone": GetPhoneNumberTask,
    "livekit_get_address": GetAddressTask,
    "livekit_get_dob": GetDOBTask,
}


def _field_meta_by_key(fields: list[dict[str, Any]], field_key: str) -> dict[str, Any] | None:
    for row in fields:
        if str(row.get("key") or "") == field_key:
            return row
    return None


def _extract_value_from_task_result(kind: str, result: Any) -> str:
    if kind == "livekit_get_name":
        parts = [
            getattr(result, "first_name", None),
            getattr(result, "middle_name", None),
            getattr(result, "last_name", None),
        ]
        name = " ".join(p for p in parts if p)
        if name.strip():
            return name.strip()
        raise ToolError("Active name collection did not return a usable value.")
    if kind == "livekit_get_email" and hasattr(result, "email_address"):
        return str(result.email_address)
    if kind == "livekit_get_phone" and hasattr(result, "phone_number"):
        return str(result.phone_number)
    if kind == "livekit_get_address" and hasattr(result, "address"):
        return str(result.address)
    if kind == "livekit_get_dob" and hasattr(result, "date_of_birth"):
        return str(result.date_of_birth)
    raise ToolError("Active intake collection did not return a usable value.")


async def run_active_intake_collection(
    ctx: RunContext,
    *,
    field_key: str,
    intake_fields: list[dict[str, Any]],
) -> dict[str, str]:
    """Run a LiveKit prebuilt collection task for one missing field (GPT-Live session)."""
    meta = _field_meta_by_key(intake_fields, field_key)
    if meta is None:
        raise ToolError(f"Unknown intake field: {field_key}")

    kind = resolve_intake_collection_kind(meta)
    task_cls = _TASK_BY_KIND.get(kind)
    if task_cls is None:
        raise ToolError(
            f"Field {field_key} has no LiveKit active-collection task; use set_intake_* or update_intake.",
        )

    label = str(meta.get("label") or field_key)
    logger.info("voice_v3_active_intake_start field=%s kind=%s", field_key, kind)

    try:
        async with ctx.foreground():
            task = task_cls(
                llm=NOT_GIVEN,
                stt=NOT_GIVEN,
                vad=NOT_GIVEN,
                tts=NOT_GIVEN,
                extra_instructions=f"Collect the caller's {label} for this business. Field id: {field_key}.",
            )
            result = await task
    except Exception as exc:
        logger.exception("voice_v3_active_intake_failed field=%s", field_key)
        raise ToolError(f"Could not collect {label}: {exc}") from exc

    value = _extract_value_from_task_result(kind, result)
    return {field_key: value}
