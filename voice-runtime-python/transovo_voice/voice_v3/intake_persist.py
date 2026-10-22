from __future__ import annotations

from typing import Any, Awaitable, Callable

from transovo_voice.voice_v3.live_context_hydration import apply_live_context_from_tool_result
from transovo_voice.voice_v3.tool_client import TransovoV3ToolClient

PersistUpdateFn = Callable[[dict[str, Any], str | None], Awaitable[dict[str, Any]]]


def build_persist_update_fn(
    client: TransovoV3ToolClient,
    *,
    context: Any | None = None,
) -> PersistUpdateFn:
    async def persist_update(arguments: dict[str, Any], function_call_id: str | None) -> dict[str, Any]:
        result = await client.execute(
            tool_name="update_intake",
            arguments=arguments,
            function_call_id=function_call_id,
        )
        if isinstance(result, dict) and context is not None:
            return apply_live_context_from_tool_result(result, context=context)
        return result if isinstance(result, dict) else {"ok": False}

    return persist_update


def node_intake_values_from_state(state: dict[str, Any]) -> dict[str, str]:
    raw = state.get("values") or {}
    if not isinstance(raw, dict):
        return {}
    out: dict[str, str] = {}
    for key, row in raw.items():
        if isinstance(row, str) and row.strip():
            out[str(key)] = row.strip()
            continue
        if isinstance(row, dict):
            val = str(row.get("value") or "").strip()
            if val:
                out[str(key)] = val
    return out
