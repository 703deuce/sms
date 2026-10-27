import os

import pytest

from clips_worker.t2v.elevenlabs_tts import (
    DEFAULT_T2V_VOICE,
    is_elevenlabs_model_unsupported_error,
    tts_model_attempt_order,
    tts_with_timestamps,
)


def test_model_attempt_order_v4_fallback():
    assert tts_model_attempt_order("eleven_v4") == ["eleven_v4", "eleven_multilingual_v2"]
    assert tts_model_attempt_order("eleven_flash_v2_5") == ["eleven_flash_v2_5"]


def test_model_unsupported_error_heuristic():
    assert is_elevenlabs_model_unsupported_error(RuntimeError("model not found for account"))
    assert not is_elevenlabs_model_unsupported_error(RuntimeError("timeout"))


def test_default_voice_matches_product():
    assert DEFAULT_T2V_VOICE["voiceId"] == "JBFqnCBsd6RMkjVDRZzb"
    assert DEFAULT_T2V_VOICE["modelId"] == "eleven_v4"


@pytest.mark.skipif(
    not (os.environ.get("ELEVENLABS_API_KEY") or os.environ.get("ELEVENLABS_KEY")),
    reason="live ElevenLabs key required",
)
def test_live_with_timestamps_v4_or_fallback():
    audio, alignment, model = tts_with_timestamps(
        "Solar panels turn sunlight into electricity.",
        DEFAULT_T2V_VOICE,
    )
    assert len(audio) > 1000
    assert model in ("eleven_v4", "eleven_multilingual_v2")
    assert alignment.get("characters")
