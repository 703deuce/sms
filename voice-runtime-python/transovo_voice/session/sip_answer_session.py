"""Minimum LiveKit answer mechanics for inbound SIP (no AI/audio)."""

from __future__ import annotations

import asyncio
import traceback
from typing import TYPE_CHECKING

from livekit.agents import Agent, AgentSession

from transovo_voice.session.telephony_audio import build_telephony_room_options

if TYPE_CHECKING:
    from livekit.agents import JobContext

    from transovo_voice.session.mctb_sip_e2e_trace import MctbSipE2eTrace


class SilentAnswerAgent(Agent):
    """No greeting, no LLM — only establishes RoomIO for SIP answer."""

    def __init__(self) -> None:
        super().__init__(
            instructions=(
                "SIP diagnostic hold test. Remain completely silent. "
                "Do not speak or generate any responses."
            ),
        )

    async def on_enter(self) -> None:
        return


async def start_minimal_sip_answer_session(
    ctx: "JobContext",
    *,
    trace: "MctbSipE2eTrace",
    delete_room_on_close: bool = True,
) -> tuple[AgentSession, asyncio.Task[None]]:
    """
    Start AgentSession + RoomIO in the background.

    Mirrors the working inbound AI path's ``session.start(..., room_options=...)``
    without OpenAI / TTS / STT.
    """
    session = AgentSession(vad=None, user_away_timeout=None)
    trace.log(
        "sip_answer_mechanism_start",
        mechanism="AgentSession.start+RoomIO",
        roomName=ctx.room.name,
        deleteRoomOnClose=delete_room_on_close,
    )

    async def _run_session() -> None:
        try:
            await session.start(
                agent=SilentAnswerAgent(),
                room=ctx.room,
                room_options=build_telephony_room_options(
                    delete_room_on_close=delete_room_on_close,
                ),
                record=False,
            )
        except Exception as err:
            if not trace.finalized:
                trace.log(
                    "sip_answer_mechanism_failed",
                    mechanism="AgentSession.start+RoomIO",
                    error=str(err),
                    traceback=traceback.format_exc(),
                )
            raise

    task = asyncio.create_task(_run_session(), name="mctb_sip_answer_session")

    try:
        await asyncio.wait_for(_wait_for_answer_mechanism_ready(session), timeout=10.0)
        trace.log(
            "sip_answer_mechanism_complete",
            mechanism="AgentSession.start+RoomIO",
            roomName=ctx.room.name,
        )
    except asyncio.TimeoutError:
        trace.log(
            "sip_answer_mechanism_failed",
            mechanism="AgentSession.start+RoomIO",
            error="room_io_not_ready_within_timeout",
        )
    except Exception as err:
        trace.log(
            "sip_answer_mechanism_failed",
            mechanism="AgentSession.start+RoomIO",
            error=str(err),
            traceback=traceback.format_exc(),
        )

    return session, task


async def _wait_for_answer_mechanism_ready(session: AgentSession) -> None:
    for _ in range(100):
        if getattr(session, "_started", False):
            room_io = getattr(session, "_room_io", None)
            if room_io is not None and room_io.subscribed_fut is not None:
                if room_io.subscribed_fut.done():
                    return
                await asyncio.wait_for(asyncio.shield(room_io.subscribed_fut), timeout=5.0)
                return
            return
        await asyncio.sleep(0.05)
    raise asyncio.TimeoutError("agent session did not start")
