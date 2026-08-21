from __future__ import annotations

from dataclasses import dataclass, field

from livekit.agents import Agent, JobContext
from livekit.agents.llm import function_tool
from livekit.agents.voice.events import RunContext

from transovo_voice.session.telephony_audio import build_telephony_room_options
from transovo_voice.templates.session_factory import build_realtime_session
from transovo_voice.templates.template_context import (
    build_template_instructions,
    configured_field_manifest,
    resolve_greeting_instructions,
)
from transovo_voice.userdata import SessionUserData


@dataclass
class IntakeUserdata:
    fields: dict[str, str] = field(default_factory=dict)


_FALLBACK_ROLE = (
    "You collect caller information naturally. When the caller provides details "
    "(name, phone, vehicle, problem, etc.), call record_intake_fields with every "
    "field you can extract. Do not re-ask for information already captured. "
    "Read back what you captured briefly."
)
_TEMPLATE_ROLE = (
    "You are in structured intake lab mode. Collect the configured caller fields from "
    "the business configuration above. Use record_intake_field for configured fields "
    "and record_intake_fields for any additional demo fields. Do not re-ask captured data."
)


def _manifest_field_summary(ud: SessionUserData) -> str:
    manifest = configured_field_manifest(ud)
    if not manifest:
        return ""
    lines = []
    for field in manifest:
        question = field.question.strip() if field.question else f"Ask for {field.label or field.id}"
        lines.append(f"- {field.id} ({field.label}): {question}")
    return "\n".join(lines)


class StructuredIntakeAgent(Agent):
    """Structured intake lab — uses configured caller field manifest when present."""

    def __init__(self, ud: SessionUserData) -> None:
        self._ud = ud
        manifest_summary = _manifest_field_summary(ud)
        template_role = _TEMPLATE_ROLE
        if manifest_summary:
            template_role = f"{_TEMPLATE_ROLE}\n\nConfigured fields:\n{manifest_summary}"
        super().__init__(
            instructions=build_template_instructions(
                ud,
                template_mode="livekit_structured_intake",
                template_role=template_role,
                fallback_instructions=_FALLBACK_ROLE,
            ),
        )

    async def on_enter(self) -> None:
        await self.session.generate_reply(
            instructions=resolve_greeting_instructions(
                self._ud,
                fallback="Greet the caller and ask how you can help.",
            ),
        )

    @function_tool
    async def record_intake_field(
        self,
        context: RunContext[IntakeUserdata],
        field_id: str,
        value: str,
    ) -> str:
        """Record one configured intake field by id."""
        field_key = field_id.strip()
        field_value = value.strip()
        if not field_key or not field_value:
            return "Provide both field_id and value."
        context.userdata.fields[field_key] = field_value
        captured = ", ".join(f"{k}={v}" for k, v in context.userdata.fields.items())
        return f"Captured: {captured or 'nothing yet'}"

    @function_tool
    async def record_intake_fields(
        self,
        context: RunContext[IntakeUserdata],
        name: str = "",
        phone: str = "",
        vehicle: str = "",
        vehicle_year: str = "",
        problem: str = "",
        notes: str = "",
    ) -> str:
        """Record structured intake fields extracted from the conversation."""
        updates = {
            k: v.strip()
            for k, v in {
                "name": name,
                "phone": phone,
                "vehicle": vehicle,
                "vehicle_year": vehicle_year,
                "problem": problem,
                "notes": notes,
            }.items()
            if v.strip()
        }
        context.userdata.fields.update(updates)
        captured = ", ".join(f"{k}={v}" for k, v in context.userdata.fields.items())
        return f"Captured: {captured or 'nothing yet'}"


async def run_structured_intake_template(ctx: JobContext, ud: SessionUserData) -> None:
    intake_ud = IntakeUserdata()
    session = build_realtime_session(ud, userdata=intake_ud)
    await session.start(
        agent=StructuredIntakeAgent(ud),
        room=ctx.room,
        room_options=build_telephony_room_options(delete_room_on_close=True),
    )
