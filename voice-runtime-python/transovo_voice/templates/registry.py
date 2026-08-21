from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Literal

TemplateStatus = Literal[
    "FOUND",
    "IMPLEMENTED",
    "VERIFIED",
    "COMPOSED_UNVERIFIED",
    "NOT_APPLICABLE",
]

AGENT_TEMPLATE_VERSION = "1"


@dataclass(frozen=True)
class AgentTemplateRecord:
    id: str
    name: str
    purpose: str
    official_example: str
    livekit_sdk: str
    capabilities: tuple[str, ...]
    required_env: tuple[str, ...]
    imported_verified: str
    status: TemplateStatus


LIVEKIT_SDK = "livekit-agents[openai]>=1.2,<2"
IMPORT_DATE = "2026-08-21"

AGENT_TEMPLATES: dict[str, AgentTemplateRecord] = {
    "livekit_basic_voice": AgentTemplateRecord(
        id="livekit_basic_voice",
        name="Basic Voice Assistant",
        purpose="Phase A — official basic_agent pattern, gpt-realtime, no Transovo tools",
        official_example="livekit/agents/examples/voice_agents/basic_agent.py",
        livekit_sdk=LIVEKIT_SDK,
        capabilities=("realtime_conversation", "interruption"),
        required_env=("OPENAI_API_KEY", "LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"),
        imported_verified=IMPORT_DATE,
        status="IMPLEMENTED",
    ),
    "livekit_frontdesk_booking": AgentTemplateRecord(
        id="livekit_frontdesk_booking",
        name="Front Desk Booking",
        purpose="Phase B — official frontdesk + FakeCalendar (no Transovo calendar yet)",
        official_example="livekit/agents/examples/frontdesk/agent.py",
        livekit_sdk=LIVEKIT_SDK,
        capabilities=("list_slots", "schedule_appointment", "get_current_time"),
        required_env=("OPENAI_API_KEY",),
        imported_verified=IMPORT_DATE,
        status="IMPLEMENTED",
    ),
    "livekit_warm_transfer": AgentTemplateRecord(
        id="livekit_warm_transfer",
        name="Warm Transfer",
        purpose="Phase C — official warm-transfer pattern",
        official_example="livekit/agents/examples/warm-transfer/warm_transfer.py",
        livekit_sdk=LIVEKIT_SDK,
        capabilities=("warm_transfer",),
        required_env=("LIVEKIT_SIP_OUTBOUND_TRUNK",),
        imported_verified=IMPORT_DATE,
        status="IMPLEMENTED",
    ),
    "livekit_structured_intake": AgentTemplateRecord(
        id="livekit_structured_intake",
        name="Structured Intake",
        purpose="Phase D — data_capture_sim inspired natural field capture",
        official_example="livekit/agents/examples/data_capture_sim/agent.py",
        livekit_sdk=LIVEKIT_SDK,
        capabilities=("structured_intake",),
        required_env=("OPENAI_API_KEY",),
        imported_verified=IMPORT_DATE,
        status="IMPLEMENTED",
    ),
    "livekit_hotel_receptionist": AgentTemplateRecord(
        id="livekit_hotel_receptionist",
        name="Hotel Receptionist",
        purpose="Phase E — simplified hotel receptionist reference",
        official_example="livekit/agents/examples/hotel_receptionist/agent.py",
        livekit_sdk=LIVEKIT_SDK,
        capabilities=("receptionist", "policy_lookup"),
        required_env=("OPENAI_API_KEY",),
        imported_verified=IMPORT_DATE,
        status="IMPLEMENTED",
    ),
    "livekit_knowledge_rag": AgentTemplateRecord(
        id="livekit_knowledge_rag",
        name="Knowledge RAG",
        purpose="Phase F — small in-memory knowledge search (RAG lab)",
        official_example="livekit/agents/examples/voice_agents/llamaindex-rag/",
        livekit_sdk=LIVEKIT_SDK,
        capabilities=("search_knowledge",),
        required_env=("OPENAI_API_KEY",),
        imported_verified=IMPORT_DATE,
        status="IMPLEMENTED",
    ),
    "transovo_receptionist_v1": AgentTemplateRecord(
        id="transovo_receptionist_v1",
        name="Voice Receptionist v1",  # pragma: allowlist secret
        purpose="Composed receptionist — blocked until reference templates are VERIFIED",
        official_example="Composed from verified LiveKit reference templates",
        livekit_sdk=LIVEKIT_SDK,
        capabilities=(
            "realtime_conversation",
            "business_knowledge",
            "dynamic_fields",
            "take_message",
            "transfer",
            "booking",
        ),
        required_env=("TRANSOVO_BACKEND_URL", "TRANSOVO_INTERNAL_API_KEY", "OPENAI_API_KEY"),
        imported_verified=IMPORT_DATE,
        status="COMPOSED_UNVERIFIED",
    ),
}

# Phase A default — all production PSTN traffic uses this until templates are VERIFIED.
DEFAULT_ACTIVE_TEMPLATE = "livekit_basic_voice"

COMPOSED_RECEPTIONIST_TEMPLATE = "transovo_receptionist_v1"

VERIFIED_TEMPLATE_IDS = frozenset(
    t.strip()
    for t in os.getenv("VOICE_VERIFIED_TEMPLATES", "").split(",")
    if t.strip()
)


def template_runtime_status(template_id: str) -> TemplateStatus:
    record = AGENT_TEMPLATES.get(template_id)
    if not record:
        return "FOUND"
    if template_id in VERIFIED_TEMPLATE_IDS:
        return "VERIFIED"
    return record.status


def composed_receptionist_allowed() -> bool:
    return os.getenv("ALLOW_COMPOSED_RECEPTIONIST", "").strip() == "1"


def resolve_template_id(raw: str | None) -> str:
    candidate = (raw or "").strip()
    if candidate == COMPOSED_RECEPTIONIST_TEMPLATE and not composed_receptionist_allowed():
        return DEFAULT_ACTIVE_TEMPLATE
    if candidate in AGENT_TEMPLATES and candidate != COMPOSED_RECEPTIONIST_TEMPLATE:
        return candidate
    if candidate == COMPOSED_RECEPTIONIST_TEMPLATE and composed_receptionist_allowed():
        return candidate
    env_default = os.getenv("VOICE_ACTIVE_TEMPLATE", "").strip()
    if env_default in AGENT_TEMPLATES and (
        env_default != COMPOSED_RECEPTIONIST_TEMPLATE or composed_receptionist_allowed()
    ):
        return env_default
    return DEFAULT_ACTIVE_TEMPLATE


def list_templates() -> list[AgentTemplateRecord]:
    return list(AGENT_TEMPLATES.values())
