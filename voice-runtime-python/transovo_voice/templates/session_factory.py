from __future__ import annotations

from typing import TYPE_CHECKING

from livekit.agents import AgentSession

from transovo_voice.session.realtime_config import build_realtime_model
from transovo_voice.userdata import SessionUserData

if TYPE_CHECKING:
    from transovo_voice.observability.call_metrics import CallObservability


def build_realtime_session(
    ud: SessionUserData,
    *,
    userdata: object | None = None,
) -> AgentSession:
    """Single AgentSession factory — always gpt-realtime for Transovo production."""
    realtime_llm = build_realtime_model(
        model=ud.realtime_model,
        voice=ud.realtime_voice,
        speed=ud.realtime_speed,
    )
    session_userdata = userdata if userdata is not None else ud
    return AgentSession(llm=realtime_llm, userdata=session_userdata)


async def start_realtime_session(
    session: AgentSession,
    *,
    agent: object,
    room: object,
    room_options: object,
    observability: "CallObservability | None" = None,
) -> None:
    if observability is not None:
        await observability.mark_startup_phase("agent_session_start_begin")
        await observability.mark_startup_phase("openai_realtime_connect_begin")
    await session.start(agent=agent, room=room, room_options=room_options)  # type: ignore[arg-type]
    if observability is not None:
        await observability.mark_startup_phase("agent_session_started")
        await observability.mark_startup_phase("openai_realtime_connected")
