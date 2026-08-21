from __future__ import annotations

from dataclasses import dataclass, field

from livekit.agents import Agent, JobContext
from livekit.agents.llm import function_tool
from livekit.agents.voice.events import RunContext

from transovo_voice.session.telephony_audio import build_telephony_room_options
from transovo_voice.templates.session_factory import build_realtime_session
from transovo_voice.userdata import SessionUserData


@dataclass
class IntakeUserdata:
    fields: dict[str, str] = field(default_factory=dict)


class StructuredIntakeAgent(Agent):
    """Phase D lab — natural multi-field capture without rigid state machine."""

    def __init__(self) -> None:
        super().__init__(
            instructions=(
                "You collect caller information naturally. When the caller provides details "
                "(name, phone, vehicle, problem, etc.), call record_intake_fields with every "
                "field you can extract. Do not re-ask for information already captured. "
                "Read back what you captured briefly."
            ),
        )

    async def on_enter(self) -> None:
        await self.session.generate_reply(
            instructions="Greet the caller and ask how you can help.",
        )

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
        agent=StructuredIntakeAgent(),
        room=ctx.room,
        room_options=build_telephony_room_options(delete_room_on_close=True),
    )
