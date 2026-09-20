from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass
from typing import Any

from livekit.agents import JobContext, function_tool
from livekit.agents.llm.tool_context import DuplicateScope, ToolError, ToolFlag
from livekit.agents.voice.events import RunContext

from transovo_voice.telemetry import log_event
from transovo_voice.voice_v3.intake_active_collection import run_active_intake_collection
from transovo_voice.voice_v3.tool_client import TransovoV3ToolClient

COLLECT_INTAKE_FIELD_TOOL = "collect_intake_field"
_SET_INTAKE_PREFIX = "set_intake_"

logger = logging.getLogger("transovo-voice.voice_v3.tools")

_READ_TOOLS = frozenset({"find_availability", "find_appointment"})
# Writes are non-cancellable by default (no ToolFlag.CANCELLABLE). We do NOT call
# RunContext.disallow_interruptions() on GPT-Live — see docs/VOICE-V3-LIVEKIT-GPT-LIVE-INTERRUPTION-POLICY.md.
# end_call is LiveKit EndCallTool — not built here.
_SKIP_SCHEMA_TOOLS = frozenset({"end_call"})


@dataclass(frozen=True)
class LiveKitTelephonyBridge:
    job_ctx: JobContext
    sip_participant_identity: str


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


def _normalize_transfer_to(destination: str) -> str:
    dest = destination.strip()
    if dest.startswith("tel:") or dest.startswith("sip:"):
        return dest
    if dest.startswith("+") or (dest and dest[0].isdigit()):
        return f"tel:{dest}"
    return dest


async def _execute_transovo_tool(
    *,
    tool_name: str,
    raw_arguments: dict[str, Any],
    context: RunContext,
    client: TransovoV3ToolClient,
    telephony: LiveKitTelephonyBridge | None,
) -> dict[str, Any]:
    fc_meta = getattr(context, "function_call", None)
    function_call_id = None
    if fc_meta is not None:
        function_call_id = getattr(fc_meta, "call_id", None) or getattr(fc_meta, "id", None)

    result = await client.execute(
        tool_name=tool_name,
        arguments=raw_arguments,
        function_call_id=str(function_call_id) if function_call_id else None,
    )

    if tool_name == "transfer_call" and telephony is not None:
        await _maybe_execute_livekit_transfer(result, telephony)

    return result


async def _maybe_execute_livekit_transfer(
    result: dict[str, Any],
    telephony: LiveKitTelephonyBridge,
) -> None:
    if not result.get("ok"):
        return
    status = str(result.get("status") or "")
    if status not in ("transfer_requested", "ok"):
        data = result.get("data")
        if isinstance(data, dict) and data.get("destination"):
            status = "transfer_requested"
        else:
            return
    data = result.get("data") if isinstance(result.get("data"), dict) else {}
    destination = str(data.get("destination") or "").strip()
    if not destination:
        return

    transfer_to = _normalize_transfer_to(destination)
    log_event(
        "voice_v3_livekit_transfer_starting",
        extra={
            "participant": telephony.sip_participant_identity,
            "transfer_to": transfer_to,
            "destination_id": data.get("destination_id"),
        },
    )
    try:
        fut = telephony.job_ctx.transfer_sip_participant(
            telephony.sip_participant_identity,
            transfer_to,
            play_dialtone=False,
        )
        await asyncio.wait_for(fut, timeout=45.0)
        log_event("voice_v3_livekit_transfer_completed", extra={"transfer_to": transfer_to})
    except asyncio.TimeoutError:
        logger.exception("voice_v3_livekit_transfer_timeout")
        raise ToolError("Transfer timed out. Offer callback or try again.") from None
    except Exception as exc:
        logger.exception("voice_v3_livekit_transfer_failed")
        raise ToolError(f"Transfer failed: {exc}") from exc


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
        return await client.execute(tool_name="update_intake", arguments=collected)

    field_key = _intake_field_key_from_set_tool(tool_name, intake_fields)
    if field_key:
        value = args.get("value")
        payload: dict[str, Any] = {field_key: value}
        return await client.execute(tool_name="update_intake", arguments=payload)

    raise ToolError(f"Unknown intake tool: {tool_name}")


def build_livekit_tools(
    tool_schemas: list[dict[str, Any]],
    client: TransovoV3ToolClient,
    telephony: LiveKitTelephonyBridge | None = None,
    intake_fields: list[dict[str, Any]] | None = None,
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

            try:
                if _tool_name == COLLECT_INTAKE_FIELD_TOOL or _tool_name.startswith(
                    _SET_INTAKE_PREFIX,
                ):
                    result = await _dispatch_intake_tool(
                        tool_name=_tool_name,
                        args=args,
                        context=context,
                        client=_client,
                        intake_fields=intake_meta,
                    )
                else:
                    result = await _execute_transovo_tool(
                        tool_name=_tool_name,
                        raw_arguments=args,
                        context=context,
                        client=_client,
                        telephony=_telephony if _tool_name == "transfer_call" else None,
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
