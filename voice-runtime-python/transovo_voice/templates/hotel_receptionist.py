from __future__ import annotations

from livekit.agents import Agent, JobContext
from livekit.agents.llm import function_tool

from transovo_voice.session.telephony_audio import build_telephony_room_options
from transovo_voice.templates.session_factory import build_realtime_session
from transovo_voice.userdata import SessionUserData

_HOTEL_POLICIES = {
    "check_in": "Check-in is at 3 PM. Early check-in may be available upon request.",
    "check_out": "Check-out is at 11 AM.",
    "pets": "We allow small pets under 25 pounds with a nightly pet fee.",
    "parking": "Self parking is complimentary for registered guests.",
}


class HotelReceptionistAgent(Agent):
    """Phase E lab — simplified hotel receptionist reference."""

    def __init__(self) -> None:
        super().__init__(
            instructions=(
                "You are the front desk at a boutique hotel. Help callers with room questions, "
                "policies, and restaurant reservations. Use lookup_policy for policy questions."
            ),
        )

    async def on_enter(self) -> None:
        await self.session.generate_reply(
            instructions="Greet the caller briefly and ask how you can help.",
        )

    @function_tool
    async def lookup_policy(self, topic: str) -> str:
        """Look up hotel policy information."""
        key = topic.strip().lower().replace(" ", "_")
        for policy_key, text in _HOTEL_POLICIES.items():
            if key in policy_key or policy_key in key:
                return text
        return "I don't have that policy on file. Offer to take a message for the front desk manager."


async def run_hotel_receptionist_template(ctx: JobContext, ud: SessionUserData) -> None:
    session = build_realtime_session(ud)
    await session.start(
        agent=HotelReceptionistAgent(),
        room=ctx.room,
        room_options=build_telephony_room_options(delete_room_on_close=True),
    )
