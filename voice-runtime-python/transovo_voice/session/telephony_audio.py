from __future__ import annotations

import os

from livekit.agents import NOT_GIVEN, NotGivenOr, room_io


def telephony_noise_cancellation_enabled() -> bool:
    raw = os.getenv("VOICE_TELEPHONY_NOISE_CANCELLATION", "1").strip().lower()
    return raw not in {"0", "false", "no", "off"}


def build_telephony_room_options(delete_room_on_close: bool) -> room_io.RoomOptions:
    """PSTN inbound audio — BVCTelephony per warm-transfer / telephony examples."""
    audio_input: NotGivenOr[room_io.AudioInputOptions] = NOT_GIVEN
    if telephony_noise_cancellation_enabled():
        from livekit.plugins import noise_cancellation

        audio_input = room_io.AudioInputOptions(
            noise_cancellation=noise_cancellation.BVCTelephony(),
        )
    return room_io.RoomOptions(
        audio_input=audio_input,
        delete_room_on_close=delete_room_on_close,
    )
