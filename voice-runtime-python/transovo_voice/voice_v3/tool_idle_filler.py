from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from typing import TypeVar

from livekit.agents.voice.events import RunContext
from livekit.agents.voice.speech_handle import SpeechHandle

from transovo_voice.telemetry import log_event

logger = logging.getLogger("transovo-voice.voice_v3.tool_idle_filler")

# LiveKit with_filler: continuous session idleness before one GPT-Live status line.
FILLER_DELAY_SEC = 2.0
FILLER_INTERVAL: float | None = None
FILLER_MAX_STEPS = 1

_FILLER_INSTRUCTIONS = (
    "Give the caller one very brief, natural status acknowledgment "
    "that you are still working on their current request. "
    "Do not state or imply that the operation succeeded or completed. "
    "Do not invent progress or details. "
    "Do not ask a question. "
    "Use one short conversational sentence."
)

TRANSFER_FILLER_INSTRUCTIONS = (
    "Say one brief, natural sentence that you are connecting the caller now "
    "(for example to billing or the right team). "
    "Do not ask a question. Do not say the transfer already succeeded."
)

TRANSFER_FILLER_DELAY_SEC = 1.0

T = TypeVar("T")


def build_tool_filler_source(
    context: RunContext,
    *,
    tool_name: str,
    function_call_id: str | None,
    on_filler_requested: Callable[[], None] | None = None,
    filler_instructions: str | None = None,
) -> Callable[[int], SpeechHandle]:
    """Synchronous filler source for RunContext.with_filler (GPT-Live generate_reply)."""

    def filler_source(step: int) -> SpeechHandle:
        if on_filler_requested is not None:
            on_filler_requested()
        log_event(
            "voice_v3_tool_filler_speech_requested",
            extra={
                "tool": tool_name,
                "function_call_id": function_call_id,
                "step": step,
            },
        )
        handle = context.session.generate_reply(
            instructions=filler_instructions or _FILLER_INSTRUCTIONS,
            tool_choice="none",
            allow_interruptions=True,
        )
        log_event(
            "voice_v3_tool_filler_speech_handle_created",
            extra={
                "tool": tool_name,
                "function_call_id": function_call_id,
            },
        )
        return handle

    return filler_source


async def execute_with_idle_filler(
    context: RunContext,
    *,
    tool_name: str,
    function_call_id: str | None,
    execute: Callable[[], Awaitable[T]],
    filler_delay_sec: float | None = None,
    filler_instructions: str | None = None,
) -> T:
    """Run awaited tool work under LiveKit idle-aware filler (no separate TTS)."""
    filler_fired = False

    def _mark_filler_requested() -> None:
        nonlocal filler_fired
        filler_fired = True

    delay_s = filler_delay_sec if filler_delay_sec is not None else FILLER_DELAY_SEC

    filler_source = build_tool_filler_source(
        context,
        tool_name=tool_name,
        function_call_id=function_call_id,
        on_filler_requested=_mark_filler_requested,
        filler_instructions=filler_instructions,
    )

    log_event(
        "voice_v3_tool_filler_scope_opened",
        extra={
            "tool": tool_name,
            "function_call_id": function_call_id,
            "delay_s": delay_s,
        },
    )

    try:
        async with context.with_filler(
            filler_source,
            delay=delay_s,
            interval=FILLER_INTERVAL,
            max_steps=FILLER_MAX_STEPS,
        ):
            return await execute()
    finally:
        log_event(
            "voice_v3_tool_filler_scope_closed",
            extra={
                "tool": tool_name,
                "function_call_id": function_call_id,
                "filler_fired": filler_fired,
            },
        )
