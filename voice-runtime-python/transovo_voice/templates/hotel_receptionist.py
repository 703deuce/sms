from __future__ import annotations

from livekit.agents import Agent, JobContext
from livekit.agents.llm import function_tool

from transovo_voice.session.telephony_audio import build_telephony_room_options
from transovo_voice.templates.session_factory import build_realtime_session
from transovo_voice.templates.template_context import (
    build_template_instructions,
    resolve_greeting_instructions,
)
from transovo_voice.userdata import SessionUserData

_DEMO_HOTEL_POLICIES = {
    "check_in": "Check-in is at 3 PM. Early check-in may be available upon request.",
    "check_out": "Check-out is at 11 AM.",
    "pets": "We allow small pets under 25 pounds with a nightly pet fee.",
    "parking": "Self parking is complimentary for registered guests.",
}

_FALLBACK_ROLE = (
    "You are the front desk at a boutique hotel. Help callers with room questions, "
    "policies, and restaurant reservations. Use lookup_policy for policy questions."
)
_TEMPLATE_ROLE = (
    "You are in hotel receptionist lab mode. Answer using the configured business context "
    "above first. For hotel-style policy questions (check-in, pets, parking), use lookup_policy."
)


class HotelReceptionistAgent(Agent):
    """Hotel receptionist lab — wizard business context + demo policy lookup fallback."""

    def __init__(self, ud: SessionUserData) -> None:
        self._ud = ud
        super().__init__(
            instructions=build_template_instructions(
                ud,
                template_mode="livekit_hotel_receptionist",
                template_role=_TEMPLATE_ROLE,
                fallback_instructions=_FALLBACK_ROLE,
            ),
        )

    async def on_enter(self) -> None:
        await self.session.generate_reply(
            instructions=resolve_greeting_instructions(
                self._ud,
                fallback="Greet the caller briefly and ask how you can help.",
            ),
        )

    @function_tool
    async def lookup_policy(self, topic: str) -> str:
        """Look up hotel policy information."""
        key = topic.strip().lower().replace(" ", "_")
        for policy_key, text in _DEMO_HOTEL_POLICIES.items():
            if key in policy_key or policy_key in key:
                return text
        return "I don't have that policy on file. Offer to take a message for the front desk manager."


async def run_hotel_receptionist_template(ctx: JobContext, ud: SessionUserData) -> None:
    session = build_realtime_session(ud)
    await session.start(
        agent=HotelReceptionistAgent(ud),
        room=ctx.room,
        room_options=build_telephony_room_options(delete_room_on_close=True),
    )
