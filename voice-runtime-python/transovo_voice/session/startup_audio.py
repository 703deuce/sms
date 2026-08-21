from __future__ import annotations

import asyncio
import time
from typing import TYPE_CHECKING

from transovo_voice.telemetry import log_event

if TYPE_CHECKING:
    from livekit import rtc


DEFAULT_IMMEDIATE_ANSWER = "Thanks for calling. One moment please."


def build_immediate_answer_phrase(*, business_name: str = "") -> str:
    name = business_name.strip()
    if name and name.lower() not in {"our office", "our business", "the business"}:
        return f"Thanks for calling {name}. One moment please."
    return DEFAULT_IMMEDIATE_ANSWER


async def play_immediate_answer(
    room: "rtc.Room",
    *,
    phrase: str,
    voice: str = "marin",
    call_id: str | None = None,
    temporary: bool = True,
) -> int | None:
    """Temporary hold phrase while realtime connects — not a substitute for fast model startup."""
    started = time.perf_counter()
    player = None
    try:
        from livekit.agents.voice.background_audio import BackgroundAudioPlayer
        from livekit.plugins.openai import TTS

        player = BackgroundAudioPlayer()
        await player.start(room=room)
        tts = TTS(voice=voice, model="gpt-4o-mini-tts")
        audio_stream = tts.synthesize(phrase)
        handle = player.play(audio_stream)
        await handle
    except Exception as err:
        log_event(
            "immediate_answer_failed",
            call_id=call_id,
            extra={"error": str(err), "phrasePreview": phrase[:80]},
        )
        return None
    finally:
        if player is not None:
            asyncio.create_task(player.aclose())

    elapsed_ms = int((time.perf_counter() - started) * 1000)
    log_event(
        "startup_masking_audio",
        call_id=call_id,
        extra={
            "maskingAudioMs": elapsed_ms,
            "phrasePreview": phrase[:80],
            "temporary": temporary,
        },
    )
    return elapsed_ms
