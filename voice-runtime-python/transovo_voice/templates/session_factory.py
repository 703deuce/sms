from __future__ import annotations

from livekit.agents import AgentSession

from transovo_voice.session.realtime_config import build_realtime_model
from transovo_voice.userdata import SessionUserData


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
