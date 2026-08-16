from __future__ import annotations

from livekit.agents import Agent

from transovo_voice.agent.tools import build_amy_tools
from transovo_voice.integrations.backend_client import TransovoBackend
from transovo_voice.userdata import SessionUserData


class AmyAgent(Agent):
    """Generic receptionist agent — greeting and tools follow LiveKit voice agent patterns."""

    def __init__(
        self,
        ud: SessionUserData,
        session,
        backend: TransovoBackend,
    ) -> None:
        instructions = ud.compiled_prompt or (
            f"You are Amy, receptionist for {ud.business_name}. "
            "Help callers naturally. Use start_booking for appointments, take_message for callbacks, "
            "get_business_answer for business questions. One thought at a time."
        )
        tools = build_amy_tools(session, ud, backend)
        super().__init__(instructions=instructions, tools=tools)
        self._ud = ud

    async def on_enter(self) -> None:
        greeting = self._ud.greeting.strip()
        if greeting:
            await self.session.generate_reply(
                instructions=f"Say this greeting warmly and naturally: {greeting}",
            )
        else:
            await self.session.generate_reply(
                instructions=(
                    f"Welcome the caller to {self._ud.business_name}. "
                    "Ask how you can help today. Keep it brief."
                ),
            )


def create_amy_agent(
    ud: SessionUserData,
    session,
    backend: TransovoBackend,
) -> AmyAgent:
    return AmyAgent(ud, session, backend)
