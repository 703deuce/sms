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
from transovo_voice.voice_v3.intake_bridge import (
    COLLECT_CALLER_INTAKE_TOOL,
    execute_collect_caller_intake,
)
from transovo_voice.voice_v3.tool_client import TransovoV3ToolClient
from transovo_voice.voice_v3.telephony_bridge import LiveKitTelephonyBridge
from transovo_voice.voice_v3.forensics import VoiceV3CallForensics
from transovo_voice.voice_v3.transfer_executor import execute_authorized_transfer_plan
from transovo_voice.voice_v3.tool_idle_filler import (
    TRANSFER_FILLER_DELAY_SEC,
    TRANSFER_FILLER_INSTRUCTIONS,
    execute_with_idle_filler,
)
from transovo_voice.voice_v3.live_context_hydration import apply_live_context_from_tool_result

_LEGACY_COLLECT_INTAKE_FIELD_TOOL = "collect_intake_field"
_LEGACY_SET_INTAKE_PREFIX = "set_intake_"

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


def _is_retired_intake_tool(name: str) -> bool:
    return (
        name == "update_intake"
        or name == _LEGACY_COLLECT_INTAKE_FIELD_TOOL
        or name.startswith(_LEGACY_SET_INTAKE_PREFIX)
    )


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
        if not name or name in _SKIP_SCHEMA_TOOLS or _is_retired_intake_tool(name):
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
                if _tool_name == COLLECT_CALLER_INTAKE_TOOL:
                    return await execute_collect_caller_intake(
                        context=context,
                        client=_client,
                        intake_fields=intake_meta,
                        arguments=args,
                        function_call_id=fc_id_str,
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
                _filler_delay = (
                    TRANSFER_FILLER_DELAY_SEC if _tool_name == "transfer_call" else None
                )
                _filler_instructions = (
                    TRANSFER_FILLER_INSTRUCTIONS if _tool_name == "transfer_call" else None
                )
                result = await execute_with_idle_filler(
                    context,
                    tool_name=_tool_name,
                    function_call_id=fc_id_str,
                    execute=_run_tool,
                    filler_delay_sec=_filler_delay,
                    filler_instructions=_filler_instructions,
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
