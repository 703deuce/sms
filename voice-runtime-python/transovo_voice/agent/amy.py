from __future__ import annotations

from livekit.agents import Agent

from transovo_voice.agent.tools import build_amy_tools
from transovo_voice.integrations.backend_client import TransovoBackend
from transovo_voice.userdata import SessionUserData


def create_amy_agent(
    ud: SessionUserData,
    session,
    backend: TransovoBackend,
) -> Agent:
    instructions = ud.compiled_prompt or (
        f"You are Amy, receptionist for {ud.business_name}. "
        "Help callers naturally. Use start_booking for appointments, take_message for callbacks, "
        "get_business_answer for business questions. One thought at a time."
    )
    tools = build_amy_tools(session, ud, backend)
    return Agent(instructions=instructions, tools=tools)
