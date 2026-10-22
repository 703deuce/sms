from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from livekit.agents.llm import ChatContext
from livekit.agents.llm.tool_context import ToolError, function_tool
from livekit.agents.voice.agent import AgentTask

from transovo_voice.voice_v3.intake_collection import resolve_intake_collection_kind
from transovo_voice.voice_v3.intake_persist import PersistUpdateFn
from transovo_voice.voice_v3.intake_prebuilt import run_prebuilt_collector_for_field

logger = logging.getLogger("transovo-voice.voice_v3.intake_task")


@dataclass
class IntakeTaskResult:
    values: dict[str, str] = field(default_factory=dict)
    declined_fields: list[str] = field(default_factory=list)
    missing_required_fields: list[str] = field(default_factory=list)
    complete: bool = False
    last_node_result: dict[str, Any] | None = None


def build_intake_instructions(
    fields: list[dict[str, Any]],
    existing_values: dict[str, str],
    required_keys: set[str],
) -> str:
    lines = [
        "You are collecting configured caller information for this business.",
        "Scan the conversation history for facts the caller already provided.",
        "When the caller supplies one or more configured fields (in any order), call record_intake_values with all clear values at once.",
        "Do not invent or guess values. Do not re-ask for fields already saved.",
        "For phone, email, name, address, or date of birth that need spoken confirmation or correction, use clarify_field_using_livekit for that field only.",
        "When all required fields for this operation are saved, call finish_intake_collection.",
        "",
        "Configured fields:",
    ]
    for meta in fields:
        key = str(meta.get("key") or "")
        label = str(meta.get("label") or key)
        req = "required" if key in required_keys else "optional"
        desc = str(meta.get("description") or "").strip()
        existing = existing_values.get(key)
        status = f'already saved: "{existing}"' if existing else "missing"
        lines.append(f"- {key} ({label}, {req}, {meta.get('type', 'text')}): {status}. {desc}")
    return "\n".join(lines)


class IntakeTask(AgentTask[IntakeTaskResult]):
    """Wizard-driven multi-field intake using LiveKit AgentTask + Node persistence."""

    def __init__(
        self,
        *,
        fields: list[dict[str, Any]],
        existing_values: dict[str, str],
        required_keys: list[str],
        persist_update: PersistUpdateFn,
        chat_ctx: ChatContext | None,
        function_call_id: str | None = None,
    ) -> None:
        self._field_list = fields
        self._fields = {str(f.get("key") or ""): f for f in fields if f.get("key")}
        self._values = dict(existing_values)
        self._required_keys = {k for k in required_keys if k}
        self._persist_update = persist_update
        self._function_call_id = function_call_id
        self._declined: list[str] = []
        self._last_node: dict[str, Any] | None = None

        @function_tool(
            name="record_intake_values",
            description="Record one or more caller-provided intake fields by configured field key.",
        )
        async def record_intake_values(values: dict[str, str]) -> str:
            return await self._record_intake_values(values)

        @function_tool(
            name="clarify_field_using_livekit",
            description=(
                "Run LiveKit spoken collection for one field (phone, email, name, address, DOB) "
                "when confirmation or structured capture is needed."
            ),
        )
        async def clarify_field_using_livekit(field_key: str) -> str:
            return await self._clarify_field(field_key)

        @function_tool(
            name="decline_intake_field",
            description="Record that the caller declined to provide an optional field.",
        )
        async def decline_intake_field(field_key: str) -> str:
            key = field_key.strip()
            if key in self._required_keys:
                raise ToolError(f"{key} is required and cannot be declined.")
            if key not in self._fields:
                raise ToolError(f"Unknown field: {field_key}")
            if key not in self._declined:
                self._declined.append(key)
            return f"Marked {key} as declined."

        @function_tool(
            name="finish_intake_collection",
            description="Finish intake when required fields are saved or the caller changes goals.",
        )
        async def finish_intake_collection() -> str:
            missing = self._missing_required()
            if missing and not self.done():
                raise ToolError(
                    f"Still missing required fields: {', '.join(missing)}. "
                    "Collect them or help the caller continue another way.",
                )
            self._complete_now()
            return "Intake collection complete."

        super().__init__(
            instructions=build_intake_instructions(fields, existing_values, self._required_keys),
            chat_ctx=chat_ctx,
            tools=[
                record_intake_values,
                clarify_field_using_livekit,
                decline_intake_field,
                finish_intake_collection,
            ],
        )

    def _missing_required(self) -> list[str]:
        missing: list[str] = []
        for key in sorted(self._required_keys):
            if key in self._declined:
                missing.append(key)
                continue
            if not str(self._values.get(key) or "").strip():
                missing.append(key)
        return missing

    async def _apply_node_result(self, node_result: dict[str, Any]) -> str:
        self._last_node = node_result
        data = node_result.get("data") if isinstance(node_result.get("data"), dict) else node_result
        if isinstance(data, dict):
            for key in data.get("updated_fields") or []:
                if isinstance(key, str) and key in self._values:
                    continue
            missing = data.get("missing_required_fields")
            if isinstance(missing, list):
                pass
        inner = node_result.get("data") or node_result
        if isinstance(inner, dict) and inner.get("values"):
            for k, v in (inner.get("values") or {}).items():
                if isinstance(v, str) and v.strip():
                    self._values[str(k)] = v.strip()
        return self._status_message()

    async def _record_intake_values(self, values: dict[str, str]) -> str:
        if not values:
            raise ToolError("Provide at least one field key and value.")
        payload: dict[str, Any] = {}
        for key, raw in values.items():
            k = str(key).strip()
            if k not in self._fields:
                raise ToolError(f"Unknown field key: {key}")
            val = str(raw or "").strip()
            if not val:
                continue
            payload[k] = val
        if not payload:
            raise ToolError("No non-empty values to save.")
        node_result = await self._persist_update(payload, self._function_call_id)
        if not node_result.get("ok", True) and node_result.get("status") == "error":
            raise ToolError(node_result.get("message") or "Could not save intake.")
        data = node_result.get("data") if isinstance(node_result.get("data"), dict) else node_result
        if isinstance(data, dict):
            for key in data.get("updated_fields") or []:
                if key in payload:
                    self._values[str(key)] = str(payload[str(key)])
        return await self._apply_node_result(node_result)

    async def _clarify_field(self, field_key: str) -> str:
        key = field_key.strip()
        meta = self._fields.get(key)
        if meta is None:
            raise ToolError(f"Unknown field: {field_key}")
        kind = resolve_intake_collection_kind(meta)
        if kind == "livekit_function_tool":
            raise ToolError(
                f"Field {key} is free-text/custom — ask conversationally, then record_intake_values.",
            )
        value = await run_prebuilt_collector_for_field(parent=self, field_meta=meta, field_key=key)
        return await self._record_intake_values({key: value})

    def _status_message(self) -> str:
        missing = self._missing_required()
        saved = [k for k, v in self._values.items() if v.strip()]
        parts = [f"Saved: {', '.join(saved) or '(none)'}."]
        if missing:
            parts.append(f"Still need: {', '.join(missing)}.")
        else:
            parts.append("All required fields collected.")
        return " ".join(parts)

    def _complete_now(self) -> None:
        missing = self._missing_required()
        if not self.done():
            self.complete(
                IntakeTaskResult(
                    values=dict(self._values),
                    declined_fields=list(self._declined),
                    missing_required_fields=missing,
                    complete=len(missing) == 0,
                    last_node_result=self._last_node,
                ),
            )

    async def on_enter(self) -> None:
        missing = self._missing_required()
        if not missing:
            self._complete_now()
            return
        await self.session.generate_reply(
            instructions=(
                "Continue naturally. Use conversation history — do not re-ask for information "
                "already provided. Collect only what is still missing for this business."
            ),
        )


async def run_intake_task(
    *,
    context: Any,
    fields: list[dict[str, Any]],
    existing_values: dict[str, str],
    required_keys: list[str],
    persist_update: PersistUpdateFn,
    function_call_id: str | None,
) -> IntakeTaskResult:
    chat_ctx = None
    session = getattr(context, "session", None)
    if session is not None:
        history = getattr(session, "history", None)
        if history is not None and hasattr(history, "copy"):
            chat_ctx = history.copy(exclude_instructions=True)

    task = IntakeTask(
        fields=fields,
        existing_values=existing_values,
        required_keys=required_keys,
        persist_update=persist_update,
        chat_ctx=chat_ctx,
        function_call_id=function_call_id,
    )
    async with context.foreground():
        result = await task
    if isinstance(result, IntakeTaskResult):
        return result
    if isinstance(result, Exception):
        raise result
    return IntakeTaskResult(values=dict(existing_values), complete=False)
