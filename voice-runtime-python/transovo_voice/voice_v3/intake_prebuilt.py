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
from livekit.agents.llm import ChatContext
from livekit.agents.llm.tool_context import ToolError
from livekit.agents.voice.agent import AgentTask

from transovo_voice.voice_v3.intake_collection import IntakeCollectionKind, resolve_intake_collection_kind

logger = logging.getLogger("transovo-voice.voice_v3.intake_prebuilt")


def _chat_copy(chat_ctx: ChatContext | None) -> ChatContext | None:
    if chat_ctx is None:
        return None
    return chat_ctx.copy(exclude_instructions=True)


def _extract_prebuilt_value(kind: IntakeCollectionKind, result: Any) -> str:
    if kind == "livekit_get_name":
        parts = [
            getattr(result, "first_name", None),
            getattr(result, "middle_name", None),
            getattr(result, "last_name", None),
        ]
        name = " ".join(p for p in parts if p)
        if name.strip():
            return name.strip()
        raise ToolError("Name collection did not return a usable value.")
    if kind == "livekit_get_email":
        return str(getattr(result, "email_address", "") or "").strip()
    if kind == "livekit_get_phone":
        return str(getattr(result, "phone_number", "") or "").strip()
    if kind == "livekit_get_address":
        return str(getattr(result, "address", "") or "").strip()
    if kind == "livekit_get_dob":
        return str(getattr(result, "date_of_birth", "") or "").strip()
    raise ToolError("No prebuilt collector for this field kind.")


async def run_prebuilt_collector_for_field(
    *,
    parent: AgentTask[Any],
    field_meta: dict[str, Any],
    field_key: str,
) -> str:
    kind = resolve_intake_collection_kind(field_meta)
    if kind == "livekit_function_tool":
        raise ToolError(f"Field {field_key} has no LiveKit prebuilt collector.")

    chat_ctx = _chat_copy(parent.chat_ctx)
    label = str(field_meta.get("label") or field_key)
    logger.info("voice_v3_prebuilt_collect field=%s kind=%s", field_key, kind)

    common = {
        "chat_ctx": chat_ctx,
        "require_explicit_ask": False,
    }
    if kind == "livekit_get_phone":
        task = GetPhoneNumberTask(require_confirmation=True, **common)
    elif kind == "livekit_get_email":
        task = GetEmailTask(require_confirmation=True, **common)
    elif kind == "livekit_get_address":
        task = GetAddressTask(require_confirmation=True, **common)
    elif kind == "livekit_get_dob":
        task = GetDOBTask(**common)
    elif kind == "livekit_get_name":
        task = GetNameTask(first_name=True, last_name=True, **common)
    else:
        raise ToolError(f"Unsupported collector kind: {kind}")

    result = await task
    value = _extract_prebuilt_value(kind, result)
    if not value:
        raise ToolError(f"Could not collect {label}.")
    return value
