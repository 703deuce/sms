from __future__ import annotations

from livekit.agents import Agent, JobContext
from livekit.agents.llm import function_tool
from livekit.agents.voice.events import RunContext

from transovo_voice.session.telephony_audio import build_telephony_room_options
from transovo_voice.templates.session_factory import build_realtime_session
from transovo_voice.userdata import SessionUserData


class BasicVoiceAgent(Agent):
    """Minimal LiveKit basic_agent pattern — gpt-realtime, greet + weather tool."""

    def __init__(self, ud: SessionUserData) -> None:
        business = ud.business_name or "Transovo"
        super().__init__(
            instructions=(
                f"You are a helpful voice assistant for {business}. "
                "Keep responses concise for phone conversation. "
                "Do not use markdown or emojis."
            ),
        )

    async def on_enter(self) -> None:
        await self.session.generate_reply(
            instructions="Greet the caller briefly and ask how you can help.",
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
