"""ElevenLabs TTS with word timestamps for T2V assemble (worker path).

Scene-level synthesis during T2V_ASSEMBLE uses the same /with-timestamps contract as
new-app/lib/server/ai/elevenlabs-tts.ts. Hash for cache keys is computed in TypeScript only.
"""
from __future__ import annotations

import base64
import os
import re
from typing import Any

import requests

ELEVEN_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps"

# Matches new-app/lib/t2v/voice-defaults.ts (George, eleven_v4).
DEFAULT_T2V_VOICE: dict[str, Any] = {
    "provider": "elevenlabs",
    "voiceId": "JBFqnCBsd6RMkjVDRZzb",
    "voiceName": "George",
    "modelId": "eleven_v4",
    "stability": 0.5,
    "similarityBoost": 0.75,
    "style": 0.0,
    "speed": 1.0,
}

_MODEL_UNSUPPORTED = re.compile(
    r"(model.*(not found|unsupported|invalid|does not support)|elevenlabs_tts_(422|400))",
    re.I,
)


def get_elevenlabs_api_key() -> str:
    key = (os.environ.get("ELEVENLABS_API_KEY") or os.environ.get("ELEVENLABS_KEY") or "").strip()
    if not key:
        raise RuntimeError("ELEVENLABS_API_KEY is not configured")
    return key


def tts_model_attempt_order(model_id: str) -> list[str]:
    if model_id in ("eleven_v4", "eleven_v4_turbo"):
        return [model_id, "eleven_multilingual_v2"]
    return [model_id]


def is_elevenlabs_model_unsupported_error(err: BaseException) -> bool:
    return bool(_MODEL_UNSUPPORTED.search(str(err)))


def _voice_settings(voice: dict) -> dict:
    out = {}
    if voice.get("stability") is not None:
        out["stability"] = voice["stability"]
    if voice.get("similarityBoost") is not None:
        out["similarity_boost"] = voice["similarityBoost"]
    if voice.get("style") is not None:
        out["style"] = voice["style"]
    if voice.get("speed") is not None:
        out["speed"] = voice["speed"]
    out.setdefault("use_speaker_boost", True)
    return out


def tts_with_timestamps_once(
    api_key: str,
    text: str,
    voice: dict,
    *,
    previous_text: str | None = None,
    next_text: str | None = None,
    model_id: str | None = None,
) -> tuple[bytes, dict, str]:
    body: dict[str, Any] = {
        "text": text,
        "model_id": model_id or voice.get("modelId", "eleven_v4"),
        "voice_settings": _voice_settings(voice),
    }
    if voice.get("languageCode"):
        body["language_code"] = voice["languageCode"]
    if previous_text:
        body["previous_text"] = previous_text
    if next_text:
        body["next_text"] = next_text
    url = ELEVEN_TTS_URL.format(voice_id=voice["voiceId"])
    r = requests.post(
        url,
        params={"output_format": "mp3_44100_128"},
        json=body,
        headers={"xi-api-key": api_key, "Content-Type": "application/json"},
        timeout=120,
    )
    if not r.ok:
        raise RuntimeError(f"elevenlabs_tts_{r.status_code}: {r.text[:200]}")
    data = r.json()
    alignment = data.get("alignment") or data.get("normalized_alignment") or {}
    if not alignment.get("characters"):
        raise RuntimeError("elevenlabs_tts_no_alignment")
    audio = base64.b64decode(data["audio_base64"])
    used_model = str(body["model_id"])
    return audio, alignment, used_model


def tts_with_timestamps(
    text: str,
    voice: dict,
    *,
    previous_text: str | None = None,
    next_text: str | None = None,
    api_key: str | None = None,
) -> tuple[bytes, dict, str]:
    """Returns (mp3 bytes, alignment dict, model_id used)."""
    key = api_key or get_elevenlabs_api_key()
    order = tts_model_attempt_order(str(voice.get("modelId", "eleven_v4")))
    last: BaseException | None = None
    for mid in order:
        try:
            return tts_with_timestamps_once(key, text, voice, previous_text=previous_text, next_text=next_text, model_id=mid)
        except RuntimeError as err:
            last = err
            if not is_elevenlabs_model_unsupported_error(err) or mid == order[-1]:
                raise
    raise last or RuntimeError("elevenlabs_tts_failed")
