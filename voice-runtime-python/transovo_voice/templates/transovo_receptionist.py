from __future__ import annotations

import os

from livekit.agents import Agent, JobContext
from livekit.agents.llm import function_tool
from livekit.agents.voice.events import RunContext

from transovo_voice.agent.amy import AmyAgent
from transovo_voice.agent.tools import build_all_receptionist_tools
from transovo_voice.integrations.backend_client import TransovoBackend
from transovo_voice.prompt import resolve_agent_instructions
from transovo_voice.session.telephony_audio import build_telephony_room_options
from transovo_voice.templates.session_factory import build_realtime_session
from transovo_voice.userdata import SessionUserData


class TransovoReceptionistAgent(AmyAgent):
    """Production receptionist — flat tool surface (no phased update_tools)."""

    def __init__(self, ud: SessionUserData, backend: TransovoBackend) -> None:
        self._ud = ud
        self._backend = backend
        from livekit.agents import Agent

        Agent.__init__(
            self,
            instructions=resolve_agent_instructions(ud),
            tools=build_all_receptionist_tools(self, backend),
        )


class WarmTransferLabAgent(Agent):
    """Lab template — transfer tool using backend resolve_transfer + WarmTransferTask."""

    def __init__(self, ud: SessionUserData, backend: TransovoBackend) -> None:
        from transovo_voice.agent.transfer_tool import build_transfer_tool

        self._ud = ud
        self._backend = backend
        tools = []
        transfer = build_transfer_tool(ud, backend)
        if transfer is not None:
            tools.append(transfer)

        @function_tool
        async def explain_transfer(context: RunContext) -> str:
            return "Offer to transfer the caller to a human when they ask."

        tools.append(explain_transfer)
        super().__init__(
            instructions=(
                "You are testing warm transfer. When the caller asks for a person, "
                "use transfer_to_human after confirming."
            ),
            tools=tools,
        )

    async def on_enter(self) -> None:
        await self.session.generate_reply(
            instructions="Greet the caller and mention they can ask to speak with someone.",
        )


async def run_transovo_receptionist_template(
    ctx: JobContext,
    ud: SessionUserData,
    backend: TransovoBackend,
) -> None:
    session = build_realtime_session(ud)
    await session.start(
        agent=TransovoReceptionistAgent(ud, backend),
        room=ctx.room,
        room_options=build_telephony_room_options(delete_room_on_close=not ud.can_transfer()),
    )


async def run_warm_transfer_template(
    ctx: JobContext,
    ud: SessionUserData,
    backend: TransovoBackend,
) -> None:
    if not os.getenv("LIVEKIT_SIP_OUTBOUND_TRUNK", "").strip() and not ud.sip_outbound_trunk_id:
        raise RuntimeError("LIVEKIT_SIP_OUTBOUND_TRUNK required for warm transfer template")
    session = build_realtime_session(ud)
    await session.start(
        agent=WarmTransferLabAgent(ud, backend),
        room=ctx.room,
        room_options=build_telephony_room_options(delete_room_on_close=False),
    )
