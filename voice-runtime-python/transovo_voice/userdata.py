from __future__ import annotations

import os
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class WorkflowState(str, Enum):
    IDLE = "IDLE"
    BOOKING_INTAKE = "BOOKING_INTAKE"
    BOOKING_AVAILABILITY = "BOOKING_AVAILABILITY"
    BOOKING_SELECT = "BOOKING_SELECT"
    BOOKING_CONFIRM = "BOOKING_CONFIRM"
    BOOKING_COMMIT = "BOOKING_COMMIT"
    BOOKING_DONE = "BOOKING_DONE"
    BOOKING_FAILED = "BOOKING_FAILED"
    MESSAGE_INTAKE = "MESSAGE_INTAKE"
    MESSAGE_COMMIT = "MESSAGE_COMMIT"
    MESSAGE_DONE = "MESSAGE_DONE"
    TRANSFER = "TRANSFER"
    FAQ = "FAQ"
    CANCEL = "CANCEL"
    RESCHEDULE = "RESCHEDULE"
    END = "END"


@dataclass
class ManifestField:
    id: str
    label: str
    question: str
    type: str
    required: bool
    ask_when: str | None = None
    validation: str | None = None
    options: list[str] = field(default_factory=list)


@dataclass
class TransferPolicy:
    destination_e164: str | None = None
    emergency_destination_e164: str | None = None
    warm_transfer: bool = True
    take_message_on_failure: bool = True

    def as_dict(self) -> dict[str, Any]:
        return {
            "destinationE164": self.destination_e164,
            "emergencyDestinationE164": self.emergency_destination_e164,
            "warmTransfer": self.warm_transfer,
            "takeMessageOnFailure": self.take_message_on_failure,
        }


@dataclass
class ReceptionistCompiled:
    business_name: str
    agent_display_name: str
    greeting: str
    timezone: str
    compiled_prompt: str
    field_manifest: list[ManifestField]
    capabilities: list[str] = field(default_factory=list)
    transfer_policy: TransferPolicy | None = None


@dataclass
class OfferedSlot:
    slot_id: str
    start_time_iso: str
    duration_min: int
    spoken_label: str


@dataclass
class SessionUserData:
    workspace_id: str
    agent_id: str
    call_id: str
    business_name: str
    timezone: str
    caller_e164: str | None = None
    to_e164: str | None = None
    agent_version_id: str | None = None
    event_type_uri: str | None = None
    sip_outbound_trunk_id: str | None = None
    sip_caller_id_e164: str | None = None
    receptionist: ReceptionistCompiled | None = None
    compiled_prompt: str = ""
    greeting: str = ""
    realtime_model: str = "gpt-realtime-2"
    realtime_voice: str = "marin"
    realtime_speed: float | None = None
    capabilities: list[str] = field(default_factory=list)
    transfer_policy: TransferPolicy | None = None
    workflow: WorkflowState = WorkflowState.IDLE
    collected_fields: dict[str, str] = field(default_factory=dict)
    offered_slots: list[OfferedSlot] = field(default_factory=list)
    selected_slot_id: str | None = None
    booking_confirmed: bool = False
    booked_time_label: str | None = None
    message_taken: bool = False
    message_summary: str | None = None
    runtime_profile: str = "generic_receptionist"
    enabled_builtin_tools: list[str] = field(default_factory=list)
    pending_provider_tasks: list[Any] = field(default_factory=list)

    def has_tool(self, tool_name: str) -> bool:
        return tool_name in self.enabled_builtin_tools

    def manifest_dicts(self) -> list[dict[str, Any]]:
        if not self.receptionist:
            return []
        return [
            {
                "id": f.id,
                "label": f.label,
                "question": f.question,
                "type": f.type,
                "required": f.required,
                "askWhen": f.ask_when,
                "validation": f.validation,
            }
            for f in self.receptionist.field_manifest
        ]

    def can_transfer(self) -> bool:
        return "transfer_calls" in self.capabilities

    def transfer_policy_dict(self) -> dict[str, Any] | None:
        if self.transfer_policy:
            return self.transfer_policy.as_dict()
        return None
