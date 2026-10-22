from __future__ import annotations

import logging
from typing import Any

from livekit.agents.llm.tool_context import ToolError
from livekit.agents.voice.events import RunContext

from transovo_voice.voice_v3.intake_persist import (
    build_persist_update_fn,
    node_intake_values_from_state,
)
from transovo_voice.voice_v3.intake_task import IntakeTaskResult, run_intake_task
from transovo_voice.voice_v3.tool_client import TransovoV3ToolClient

logger = logging.getLogger("transovo-voice.voice_v3.intake_bridge")

COLLECT_CALLER_INTAKE_TOOL = "collect_caller_intake"


def _normalize_volunteered_values(raw: Any) -> dict[str, str]:
    out: dict[str, str] = {}
    if isinstance(raw, dict):
        for key, value in raw.items():
            k = str(key).strip()
            v = str(value or "").strip()
            if k and v:
                out[k] = v
        return out
    if isinstance(raw, list):
        for row in raw:
            if not isinstance(row, dict):
                continue
            k = str(row.get("key") or "").strip()
            v = str(row.get("value") or "").strip()
            if k and v:
                out[k] = v
    return out


async def _load_intake_state(
    client: TransovoV3ToolClient,
    state_args: dict[str, Any],
    function_call_id: str | None,
) -> dict[str, Any]:
    state_result = await client.execute(
        tool_name="get_intake_state",
        arguments=state_args,
        function_call_id=function_call_id,
    )
    if not state_result.get("ok", True):
        raise ToolError(state_result.get("message") or "Could not read intake state.")
    data = state_result.get("data") if isinstance(state_result.get("data"), dict) else state_result
    if not isinstance(data, dict):
        raise ToolError("Invalid intake state response.")
    return data


def _response_from_state(
    *,
    data: dict[str, Any],
    values: dict[str, str],
    complete: bool,
    declined: list[str] | None = None,
) -> dict[str, Any]:
    missing = data.get("missing_required_fields")
    if not isinstance(missing, list):
        missing = []
    return {
        "ok": True,
        "status": "INTAKE_COLLECTED" if complete else "INTAKE_PARTIAL",
        "data": {
            "values": values,
            "declined_fields": declined or [],
            "missing_required_fields": missing,
            "objective": data.get("objective"),
            "complete": complete,
            "state_version": data.get("state_version"),
        },
    }


async def execute_collect_caller_intake(
    *,
    context: RunContext,
    client: TransovoV3ToolClient,
    intake_fields: list[dict[str, Any]],
    arguments: dict[str, Any],
    function_call_id: str | None,
) -> dict[str, Any]:
    if not intake_fields:
        raise ToolError("No intake fields configured for this agent.")

    operation = arguments.get("operation")
    state_args: dict[str, Any] = {}
    if operation:
        state_args["operation"] = operation

    data = await _load_intake_state(client, state_args, function_call_id)

    existing = node_intake_values_from_state(data)
    fields_meta = data.get("intake_fields")
    if isinstance(fields_meta, list) and fields_meta:
        fields = fields_meta
    else:
        fields = intake_fields

    missing = data.get("missing_required_fields")
    required_keys = [str(k) for k in missing] if isinstance(missing, list) else []
    if not required_keys:
        for row in fields:
            if isinstance(row, dict) and row.get("required"):
                key = str(row.get("key") or "")
                if key:
                    required_keys.append(key)

    persist = build_persist_update_fn(client, context=context)
    caller_turn_hint = str(arguments.get("caller_turn_hint") or "").strip() or None
    field_keys = {
        str(row.get("key") or "").strip()
        for row in (fields if isinstance(fields, list) else intake_fields)
        if isinstance(row, dict) and row.get("key")
    }
    volunteered = _normalize_volunteered_values(arguments.get("volunteered_values"))
    if field_keys and volunteered:
        unknown = sorted(set(volunteered.keys()) - field_keys)
        if unknown:
            logger.warning("voice_v3_collect_caller_intake_unknown_volunteered_keys keys=%s", unknown)
            volunteered = {k: v for k, v in volunteered.items() if k in field_keys}

    if volunteered:
        logger.info(
            "voice_v3_collect_caller_intake_fast_path keys=%s",
            sorted(volunteered.keys()),
        )
        node_result = await persist(volunteered, function_call_id)
        if not node_result.get("ok", True) and node_result.get("status") == "error":
            raise ToolError(node_result.get("message") or "Could not save volunteered intake.")
        data = await _load_intake_state(client, state_args, function_call_id)
        existing = node_intake_values_from_state(data)
        missing = data.get("missing_required_fields")
        missing_list = [str(m) for m in missing] if isinstance(missing, list) else []
        if not missing_list:
            resp = _response_from_state(data=data, values=existing, complete=True)
            resp["data"]["persisted_volunteered_only"] = True
            return resp
        required_keys = missing_list

    missing_before = data.get("missing_required_fields")
    if isinstance(missing_before, list) and len(missing_before) == 0:
        return _response_from_state(
            data=data,
            values=existing,
            complete=True,
        )

    logger.info(
        "voice_v3_collect_caller_intake_task_start operation=%s required=%s",
        operation,
        required_keys,
    )

    task_result: IntakeTaskResult = await run_intake_task(
        context=context,
        fields=fields if isinstance(fields, list) else intake_fields,
        existing_values=existing,
        required_keys=required_keys,
        persist_update=persist,
        function_call_id=function_call_id,
        caller_turn_hint=caller_turn_hint,
    )

    out_data = await _load_intake_state(client, state_args, function_call_id)
    return _response_from_state(
        data=out_data,
        values=task_result.values,
        complete=task_result.complete,
        declined=task_result.declined_fields,
    )
