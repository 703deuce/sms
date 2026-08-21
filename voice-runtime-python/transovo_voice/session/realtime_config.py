from __future__ import annotations

import os

from openai.types import realtime
from openai.types.realtime.realtime_audio_input_turn_detection import SemanticVad


def resolve_realtime_model(configured: str | None) -> str:
    raw = (configured or os.getenv("VOICE_REALTIME_MODEL", "gpt-realtime-2")).strip()
    if raw == "gpt-realtime-2.1":
        return "gpt-realtime-2"
    return raw


def resolve_realtime_voice(configured: str | None) -> str:
    return (configured or os.getenv("VOICE_REALTIME_VOICE", "marin")).strip() or "marin"


def resolve_semantic_vad() -> SemanticVad:
    eagerness_raw = (os.getenv("VOICE_REALTIME_VAD_EAGERNESS", "high")).strip().lower()
    if eagerness_raw not in {"low", "medium", "high", "auto"}:
        eagerness_raw = "medium"
    interrupt = os.getenv("VOICE_REALTIME_INTERRUPT_RESPONSE", "1").strip().lower()
    interrupt_response = interrupt not in {"0", "false", "no", "off"}
    return SemanticVad(
        type="semantic_vad",
        eagerness=eagerness_raw,
        create_response=True,
        interrupt_response=interrupt_response,
    )


def build_realtime_model(
    model: str | None = None,
    voice: str | None = None,
    speed: float | None = None,
) -> "object":
    from livekit.plugins.openai.realtime import RealtimeModel

    kwargs: dict = {
        "model": resolve_realtime_model(model),
        "voice": resolve_realtime_voice(voice),
        "modalities": ["audio"],
        "turn_detection": resolve_semantic_vad(),
        "input_audio_transcription": realtime.AudioTranscription(model="gpt-4o-transcribe"),
    }
    if speed is not None:
        kwargs["speed"] = speed
    return RealtimeModel(**kwargs)
