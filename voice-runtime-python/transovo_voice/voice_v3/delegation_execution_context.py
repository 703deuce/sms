from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from transovo_voice.voice_v3.gpt_live_delegation_telemetry import parse_server_delegation_event


@dataclass
class DelegationExecutionContext:
    """Tracks active Responses delegation for scoping Node live context on tool execute."""

    active_delegation_id: str | None = None
    call_id_to_delegation: dict[str, str] = field(default_factory=dict)

    def note_openai_server_event(self, raw: dict[str, Any]) -> None:
        if not isinstance(raw, dict):
            return
        detail = parse_server_delegation_event(raw)
        if detail is None:
            return
        delegation_id = detail.get("delegation_id")
        deleg = str(delegation_id).strip() if delegation_id else ""
        inner_type = str(detail.get("inner_type") or detail.get("provider_event_type") or "")

        if deleg and inner_type == "response.created":
            self.active_delegation_id = deleg

        if deleg and inner_type == "response.output_item.done":
            call_id = detail.get("call_id")
            if call_id:
                self.call_id_to_delegation[str(call_id)] = deleg

        if deleg and inner_type == "response.completed":
            if self.active_delegation_id == deleg:
                self.active_delegation_id = None

    def delegation_id_for_function_call(self, function_call_id: str | None) -> str | None:
        if function_call_id:
            mapped = self.call_id_to_delegation.get(function_call_id)
            if mapped:
                return mapped
        return self.active_delegation_id
