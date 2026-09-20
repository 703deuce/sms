from __future__ import annotations

import json
from typing import Any, Callable

from livekit.agents import function_tool
from livekit.agents.llm.tool_context import DuplicateScope, ToolFlag

from transovo_voice.voice_v3.tool_client import TransovoV3ToolClient

_READ_TOOLS = frozenset({"find_availability", "find_appointment"})
_WRITE_TOOLS = frozenset(
    {
        "book_appointment",
        "reschedule_appointment",
        "cancel_appointment",
        "request_callback",
        "send_booking_link",
    },
)


def _tool_flags(name: str) -> ToolFlag:
    if name in _READ_TOOLS:
        return ToolFlag.CANCELLABLE
    return ToolFlag.NONE


def _duplicate_scope(_name: str) -> DuplicateScope:
    # livekit-agents 1.8.x: DuplicateScope is Literal["name", "name_and_args"], not an enum.
    return "name_and_args"


def build_livekit_tools(
    tool_schemas: list[dict[str, Any]],
    client: TransovoV3ToolClient,
) -> list[Any]:
    tools: list[Any] = []

    for schema in tool_schemas:
        name = str(schema.get("name") or "").strip()
        if not name:
            continue
        description = str(schema.get("description") or "")
        parameters = schema.get("parameters") or {"type": "object", "properties": {}}
        raw_schema = {
            "name": name,
            "description": description,
            "parameters": parameters,
        }

        async def _execute_raw(
            raw_arguments: dict[str, Any],
            *,
            _tool_name: str = name,
            _client: TransovoV3ToolClient = client,
        ) -> str:
            if isinstance(raw_arguments, str):
                try:
                    raw_arguments = json.loads(raw_arguments)
                except json.JSONDecodeError:
                    raw_arguments = {}
            if not isinstance(raw_arguments, dict):
                raw_arguments = {}
            result = await _client.execute(tool_name=_tool_name, arguments=raw_arguments)
            return TransovoV3ToolClient.serialize_tool_result(result)

        decorated = function_tool(
            _execute_raw,
            raw_schema=raw_schema,
            flags=_tool_flags(name),
            on_duplicate="reject",
            duplicate_scope=_duplicate_scope(name),
        )
        tools.append(decorated)

    return tools
