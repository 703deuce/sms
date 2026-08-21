from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

TemplateStatus = Literal["FOUND", "IMPLEMENTED", "VERIFIED", "NOT_APPLICABLE"]


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
        purpose="Layer 1 — inbound SIP, gpt-realtime, natural two-way conversation, barge-in",
        official_example="livekit/agents/examples/voice_agents/basic_agent.py",
        livekit_sdk=LIVEKIT_SDK,
        capabilities=("realtime_conversation", "function_tools", "interruption"),
        required_env=("OPENAI_API_KEY", "LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"),
        imported_verified=IMPORT_DATE,
        status="IMPLEMENTED",
    ),
    "livekit_frontdesk_booking": AgentTemplateRecord(
        id="livekit_frontdesk_booking",
        name="Front Desk Booking",
        purpose="Official appointment booking pattern (FakeCalendar first, then Transovo calendar)",
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
        purpose="Official SIP warm transfer to supervisor",
        official_example="livekit/agents/examples/warm-transfer/warm_transfer.py",
        livekit_sdk=LIVEKIT_SDK,
        capabilities=("warm_transfer",),
        required_env=("LIVEKIT_SIP_OUTBOUND_TRUNK",),
        imported_verified=IMPORT_DATE,
        status="IMPLEMENTED",
    ),
    "transovo_receptionist_v1": AgentTemplateRecord(
        id="transovo_receptionist_v1",
        name="AI Receptionist v1",
        purpose="Production receptionist — customer config + backend tools (message, transfer, booking)",
        official_example="Composed from basic_agent + frontdesk + warm-transfer patterns",
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
        status="IMPLEMENTED",
    ),
    "livekit_hotel_receptionist": AgentTemplateRecord(
        id="livekit_hotel_receptionist",
        name="Hotel Receptionist",
        purpose="Receptionist reference from official hotel example",
        official_example="livekit/agents/examples/hotel_receptionist/",
        livekit_sdk=LIVEKIT_SDK,
        capabilities=("receptionist",),
        required_env=("OPENAI_API_KEY",),
        imported_verified=IMPORT_DATE,
        status="FOUND",
    ),
    "livekit_structured_intake": AgentTemplateRecord(
        id="livekit_structured_intake",
        name="Structured Intake",
        purpose="Structured data capture simulation",
        official_example="livekit/agents/examples/data_capture_sim/",
        livekit_sdk=LIVEKIT_SDK,
        capabilities=("structured_intake",),
        required_env=("OPENAI_API_KEY",),
        imported_verified=IMPORT_DATE,
        status="FOUND",
    ),
    "livekit_knowledge_rag": AgentTemplateRecord(
        id="livekit_knowledge_rag",
        name="Knowledge RAG",
        purpose="LlamaIndex RAG over business knowledge",
        official_example="livekit/agents/examples/voice_agents/llamaindex-rag/",
        livekit_sdk=LIVEKIT_SDK,
        capabilities=("rag", "search_knowledge"),
        required_env=("OPENAI_API_KEY",),
        imported_verified=IMPORT_DATE,
        status="FOUND",
    ),
}

DEFAULT_PRODUCTION_TEMPLATE = "transovo_receptionist_v1"
DEFAULT_LAB_TEMPLATE = "livekit_basic_voice"


def resolve_template_id(raw: str | None, *, production: bool = True) -> str:
    candidate = (raw or "").strip()
    if candidate in AGENT_TEMPLATES:
        return candidate
    return DEFAULT_PRODUCTION_TEMPLATE if production else DEFAULT_LAB_TEMPLATE


def list_templates() -> list[AgentTemplateRecord]:
    return list(AGENT_TEMPLATES.values())
