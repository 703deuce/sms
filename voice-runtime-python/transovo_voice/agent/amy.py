from __future__ import annotations

from livekit.agents import Agent

from transovo_voice.agent.tools import (
    build_amy_tools,
    build_availability_tools,
    build_confirm_tools,
    build_idle_tools,
    build_slot_tools,
)
from transovo_voice.integrations.backend_client import TransovoBackend
from transovo_voice.userdata import SessionUserData


class AmyAgent(Agent):
    """Generic receptionist — phased tool surface via native update_tools()."""

    def __init__(
        self,
        ud: SessionUserData,
        backend: TransovoBackend,
    ) -> None:
        self._ud = ud
        self._backend = backend
        instructions = ud.compiled_prompt or (
            f"You are Amy, receptionist for {ud.business_name}. "
            "Help callers naturally. Use start_booking for appointments, take_message for callbacks, "
            "transfer_to_human when appropriate, get_business_answer for business questions. "
            "One thought at a time."
        )
        super().__init__(instructions=instructions, tools=build_amy_tools(self, backend))

    async def expose_idle_tools(self) -> None:
        await self.update_tools(build_idle_tools(self, self._backend))

    async def expose_availability_tools(self) -> None:
        await self.update_tools(build_availability_tools(self, self._backend))

    async def expose_slot_tools(self) -> None:
        await self.update_tools(build_slot_tools(self, self._backend))

    async def expose_confirm_tools(self) -> None:
        await self.update_tools(build_confirm_tools(self, self._backend))

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
    backend: TransovoBackend,
) -> AmyAgent:
    return AmyAgent(ud, backend)
