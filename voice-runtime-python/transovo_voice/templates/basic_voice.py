from __future__ import annotations

from livekit.agents import Agent, JobContext
from livekit.agents.llm import function_tool
from livekit.agents.voice.events import RunContext

from transovo_voice.session.telephony_audio import build_telephony_room_options
from transovo_voice.templates.session_factory import build_realtime_session
from transovo_voice.templates.template_context import (
    build_template_instructions,
    resolve_greeting_instructions,
)
from transovo_voice.userdata import SessionUserData

_FALLBACK_ROLE = (
    "You are a helpful voice assistant. Keep responses concise for phone conversation. "
    "Do not use markdown or emojis."
)
_TEMPLATE_ROLE = (
    "You are in basic voice lab mode. Have a natural conversation, answer questions using "
    "the business context above, and stay concise for phone calls."
)


class BasicVoiceAgent(Agent):
    """Minimal LiveKit basic_agent pattern — uses wizard config when published."""

    def __init__(self, ud: SessionUserData) -> None:
        super().__init__(
            instructions=build_template_instructions(
                ud,
                template_mode="livekit_basic_voice",
                template_role=_TEMPLATE_ROLE,
                fallback_instructions=_FALLBACK_ROLE,
            ),
        )
        self._ud = ud

    async def on_enter(self) -> None:
        await self.session.generate_reply(
            instructions=resolve_greeting_instructions(
                self._ud,
                fallback="Greet the caller briefly and ask how you can help.",
            ),
        )

    @function_tool
    async def lookup_weather(
        self,
        context: RunContext,
        location: str,
    ) -> str:
        """Look up weather when the caller asks about weather."""
        return f"It's sunny in {location} with a temperature around 70 degrees."


async def run_basic_voice_template(ctx: JobContext, ud: SessionUserData) -> None:
    session = build_realtime_session(ud)
    await session.start(
        agent=BasicVoiceAgent(ud),
        room=ctx.room,
        room_options=build_telephony_room_options(delete_room_on_close=True),
    )
