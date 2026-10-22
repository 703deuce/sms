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

    logger.info(
        "voice_v3_collect_caller_intake_start operation=%s required=%s",
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
    )

    final_state = await client.execute(
        tool_name="get_intake_state",
        arguments=state_args,
        function_call_id=function_call_id,
    )
    out_data = (
        final_state.get("data")
        if isinstance(final_state.get("data"), dict)
        else final_state
    )
    if not isinstance(out_data, dict):
        out_data = {}

    return {
        "ok": True,
        "status": "INTAKE_COLLECTED" if task_result.complete else "INTAKE_PARTIAL",
        "data": {
            "values": task_result.values,
            "declined_fields": task_result.declined_fields,
            "missing_required_fields": out_data.get("missing_required_fields")
            or task_result.missing_required_fields,
            "objective": out_data.get("objective"),
            "complete": task_result.complete,
            "state_version": out_data.get("state_version"),
        },
    }
