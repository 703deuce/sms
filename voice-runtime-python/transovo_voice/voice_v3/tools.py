from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any

from livekit.agents import function_tool
from livekit.agents.llm.tool_context import DuplicateScope, ToolError, ToolFlag
from livekit.agents.voice.events import RunContext

from transovo_voice.telemetry import log_event
from transovo_voice.voice_v3.intake_active_collection import run_active_intake_collection
from transovo_voice.voice_v3.tool_client import TransovoV3ToolClient
from transovo_voice.voice_v3.telephony_bridge import LiveKitTelephonyBridge
from transovo_voice.voice_v3.forensics import VoiceV3CallForensics
from transovo_voice.voice_v3.transfer_executor import execute_authorized_transfer_plan
from transovo_voice.voice_v3.tool_idle_filler import execute_with_idle_filler
from transovo_voice.voice_v3.live_context_hydration import apply_live_context_from_tool_result

COLLECT_INTAKE_FIELD_TOOL = "collect_intake_field"
_SET_INTAKE_PREFIX = "set_intake_"

logger = logging.getLogger("transovo-voice.voice_v3.tools")

_READ_TOOLS = frozenset({"find_availability", "find_appointment"})
# Writes are non-cancellable by default (no ToolFlag.CANCELLABLE). We do NOT call
# RunContext.disallow_interruptions() on GPT-Live — see docs/VOICE-V3-LIVEKIT-GPT-LIVE-INTERRUPTION-POLICY.md.
# end_call is LiveKit EndCallTool — not built here.
_SKIP_SCHEMA_TOOLS = frozenset({"end_call"})


def _tool_flags(name: str) -> ToolFlag:
    if name in _READ_TOOLS:
        return ToolFlag.CANCELLABLE
    return ToolFlag.NONE


def _duplicate_scope(_name: str) -> DuplicateScope:
    return "name_and_args"


def _on_duplicate(name: str) -> str:
    if name in _READ_TOOLS:
        return "replace"
    return "reject"


async def _execute_transovo_tool(
    *,
    tool_name: str,
    raw_arguments: dict[str, Any],
    context: RunContext,
    client: TransovoV3ToolClient,
    telephony: LiveKitTelephonyBridge | None,
    forensics: VoiceV3CallForensics | None = None,
) -> dict[str, Any]:
    fc_meta = getattr(context, "function_call", None)
    function_call_id = None
    if fc_meta is not None:
        function_call_id = getattr(fc_meta, "call_id", None) or getattr(fc_meta, "id", None)
    fc_id_str = str(function_call_id) if function_call_id else None
    if forensics:
        forensics.note_tool_started(tool_name, fc_id_str)
    started = time.perf_counter()

    result = await client.execute(
        tool_name=tool_name,
        arguments=raw_arguments,
        function_call_id=fc_id_str,
    )
    if isinstance(result, dict):
        result = apply_live_context_from_tool_result(result, context=context)

    if forensics:
        elapsed_ms = int((time.perf_counter() - started) * 1000)
        forensics.note_tool_completed(tool_name, fc_id_str, elapsed_ms, result)
        asyncio.create_task(forensics.maybe_checkpoint(client))

    if tool_name == "transfer_call" and telephony is not None:
        result = await execute_authorized_transfer_plan(result, telephony, context, client)

    return result


def _field_meta_by_key(intake_fields: list[dict[str, Any]], field_key: str) -> dict[str, Any] | None:
    for row in intake_fields:
        if str(row.get("key") or "") == field_key:
            return row
    return None


_PLACEHOLDER_PHONE_VALUES = frozenset({"null", "none", "n/a", "na", "undefined", ""})


def _phone_value_usable(value: Any) -> bool:
    if value is None:
        return False
    text = str(value).strip()
    if not text or text.lower() in _PLACEHOLDER_PHONE_VALUES:
        return False
    if len(text) <= 2 and not any(ch.isdigit() for ch in text):
        return False
    digits = "".join(ch for ch in text if ch.isdigit())
    return len(digits) >= 10


def _is_phone_intake_field(meta: dict[str, Any] | None) -> bool:
    if meta is None:
        return False
    return str(meta.get("type") or "").strip().lower() in ("phone", "tel")


async def _persist_active_phone_collection(
    *,
    field_key: str,
    context: RunContext,
    client: TransovoV3ToolClient,
    intake_fields: list[dict[str, Any]],
    reason: str,
) -> dict[str, Any]:
    logger.info("voice_v3_phone_collect_fallback field=%s reason=%s", field_key, reason)
    collected = await run_active_intake_collection(
        context,
        field_key=field_key,
        intake_fields=intake_fields,
    )
    result = await client.execute(tool_name="update_intake", arguments=collected)
    if isinstance(result, dict):
        return apply_live_context_from_tool_result(result, context=context)
    return result


async def _augment_update_intake_with_phone_collection(
    args: dict[str, Any],
    *,
    context: RunContext,
    client: TransovoV3ToolClient,
    intake_fields: list[dict[str, Any]],
) -> dict[str, Any]:
    """When the model bulk-saves intake with a bad phone string, run LiveKit GetPhoneNumberTask."""
    out = dict(args)
    for key, value in list(args.items()):
        field_key = str(key).strip()
        meta = _field_meta_by_key(intake_fields, field_key)
        if not _is_phone_intake_field(meta):
            continue
        if _phone_value_usable(value):
            continue
        collected = await run_active_intake_collection(
            context,
            field_key=field_key,
            intake_fields=intake_fields,
        )
        out.update(collected)
    return out


def _intake_field_key_from_set_tool(tool_name: str, intake_fields: list[dict[str, Any]]) -> str | None:
    if not tool_name.startswith(_SET_INTAKE_PREFIX):
        return None
    for row in intake_fields:
        if str(row.get("liveKitToolName") or "") == tool_name:
            return str(row.get("key") or "")
    suffix = tool_name[len(_SET_INTAKE_PREFIX) :]
    for row in intake_fields:
        key = str(row.get("key") or "")
        safe = "".join(c if c.isalnum() or c == "_" else "_" for c in key).strip("_")
        if safe == suffix:
            return key
    return None


async def _dispatch_intake_tool(
    *,
    tool_name: str,
    args: dict[str, Any],
    context: RunContext,
    client: TransovoV3ToolClient,
    intake_fields: list[dict[str, Any]],
) -> dict[str, Any]:
    if tool_name == COLLECT_INTAKE_FIELD_TOOL:
        field_key = str(args.get("field_key") or "").strip()
        if not field_key:
            raise ToolError("field_key is required for collect_intake_field.")
        collected = await run_active_intake_collection(
            context,
            field_key=field_key,
            intake_fields=intake_fields,
        )
        result = await client.execute(tool_name="update_intake", arguments=collected)
        if isinstance(result, dict):
            return apply_live_context_from_tool_result(result, context=context)
        return result

    field_key = _intake_field_key_from_set_tool(tool_name, intake_fields)
    if field_key:
        value = args.get("value")
        meta = _field_meta_by_key(intake_fields, field_key)
        if _is_phone_intake_field(meta) and not _phone_value_usable(value):
            return await _persist_active_phone_collection(
                field_key=field_key,
                context=context,
                client=client,
                intake_fields=intake_fields,
                reason="invalid_set_intake_value",
            )
        payload: dict[str, Any] = {field_key: value}
        result = await client.execute(tool_name="update_intake", arguments=payload)
        if isinstance(result, dict):
            return apply_live_context_from_tool_result(result, context=context)
        return result

    raise ToolError(f"Unknown intake tool: {tool_name}")


def build_livekit_tools(
    tool_schemas: list[dict[str, Any]],
    client: TransovoV3ToolClient,
    telephony: LiveKitTelephonyBridge | None = None,
    intake_fields: list[dict[str, Any]] | None = None,
    forensics: VoiceV3CallForensics | None = None,
) -> list[Any]:
    intake_meta = intake_fields or []
    tools: list[Any] = []

    for schema in tool_schemas:
        name = str(schema.get("name") or "").strip()
        if not name or name in _SKIP_SCHEMA_TOOLS:
            continue
        description = str(schema.get("description") or "")
        parameters = schema.get("parameters") or {"type": "object", "properties": {}}
        raw_schema = {
            "name": name,
            "description": description,
            "parameters": parameters,
        }

        async def _execute_raw(
            raw_arguments: dict[str, object],
            context: RunContext,
            *,
            _tool_name: str = name,
            _client: TransovoV3ToolClient = client,
            _telephony: LiveKitTelephonyBridge | None = telephony,
            _forensics: VoiceV3CallForensics | None = forensics,
        ) -> str:
            args: dict[str, Any]
            if isinstance(raw_arguments, str):
                try:
                    parsed = json.loads(raw_arguments)
                    args = parsed if isinstance(parsed, dict) else {}
                except json.JSONDecodeError:
                    args = {}
            elif isinstance(raw_arguments, dict):
                args = dict(raw_arguments)
            else:
                args = {}

            fc_meta = getattr(context, "function_call", None)
            function_call_id = None
            if fc_meta is not None:
                function_call_id = getattr(fc_meta, "call_id", None) or getattr(fc_meta, "id", None)
            fc_id_str = str(function_call_id) if function_call_id else None

            async def _run_tool() -> dict[str, Any]:
                if _tool_name == COLLECT_INTAKE_FIELD_TOOL or _tool_name.startswith(
                    _SET_INTAKE_PREFIX,
                ):
                    return await _dispatch_intake_tool(
                        tool_name=_tool_name,
                        args=args,
                        context=context,
                        client=_client,
                        intake_fields=intake_meta,
                    )
                if _tool_name == "update_intake" and intake_meta:
                    args = await _augment_update_intake_with_phone_collection(
                        args,
                        context=context,
                        client=_client,
                        intake_fields=intake_meta,
                    )
                return await _execute_transovo_tool(
                    tool_name=_tool_name,
                    raw_arguments=args,
                    context=context,
                    client=_client,
                    telephony=_telephony if _tool_name == "transfer_call" else None,
                    forensics=_forensics,
                )

            try:
                result = await execute_with_idle_filler(
                    context,
                    tool_name=_tool_name,
                    function_call_id=fc_id_str,
                    execute=_run_tool,
                )
            except asyncio.CancelledError:
                log_event(
                    "voice_v3_tool_cancelled",
                    extra={"tool": _tool_name},
                )
                raise
            except ToolError:
                raise
            except Exception:
                logger.exception("voice_v3_tool_unexpected_error tool=%s", _tool_name)
                raise ToolError("Tool execution failed. Try again or offer callback.") from None

            return TransovoV3ToolClient.serialize_tool_result(result)

        decorated = function_tool(
            _execute_raw,
            raw_schema=raw_schema,
            flags=_tool_flags(name),
            on_duplicate=_on_duplicate(name),
            duplicate_scope=_duplicate_scope(name),
        )
        tools.append(decorated)

    return tools
