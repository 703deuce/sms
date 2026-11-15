"""Motion Studio flags + per-step model routing (#1229 BE-20). All behavior is env-configurable; no
secrets are read here except by name. Luna (`gpt-6-luna`) for every step, no automatic escalation;
switch one step (e.g. scene_code -> gpt-6.1-sol) with MOTION_STUDIO_MODEL_SCENE_CODE alone."""
from __future__ import annotations

import os

STEPS = ("story", "research_plan", "director", "scene_code", "scene_fix", "analysis", "chat")
DEFAULT_MODEL = "gpt-6-luna"


def _b(name: str, default: bool) -> bool:
    v = os.environ.get(name)
    if v is None or v.strip() == "":
        return default
    return v.strip().lower() in ("1", "true", "yes", "on")


def _i(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


def model_for(step: str) -> str:
    v = (os.environ.get(f"MOTION_STUDIO_MODEL_{step.upper()}") or os.environ.get("MOTION_STUDIO_MODEL") or "").strip()
    return v or DEFAULT_MODEL


def reasoning_for(step: str) -> str:
    return (os.environ.get(f"MOTION_STUDIO_REASONING_{step.upper()}") or
            ("medium" if step in ("scene_code", "director", "story") else "low")).strip()


def mock() -> bool:
    """Mock paid providers (LLM, Gemini, ElevenLabs). Default OFF in prod; tests set it on."""
    return _b("MOTION_STUDIO_MOCK", False)


def enabled() -> bool:
    return _b("MOTION_STUDIO_ENABLED", True)


def custom_code_enabled() -> bool:
    """Part 2 generated scene code through the sandbox (SEC-1 review pending). Off => framework scenes."""
    return _b("MOTION_STUDIO_CUSTOM_CODE", True)


def fix_rounds() -> int:
    return max(0, min(2, _i("MOTION_STUDIO_FIX_ROUNDS", 2)))


def research_cap() -> int:
    return max(0, _i("MOTION_STUDIO_RESEARCH_CAP", 6))


def render_size(aspect: str = "16:9") -> tuple[int, int]:
    raw = (os.environ.get("MOTION_STUDIO_RENDER_SIZE") or "1920x1080").lower()
    try:
        w, h = (int(x) for x in raw.split("x"))
    except ValueError:
        w, h = 1920, 1080
    long_side = max(w, h)
    if aspect == "9:16":
        return (long_side * 9 // 16) // 2 * 2, long_side
    if aspect == "1:1":
        return (long_side * 9 // 16) // 2 * 2, (long_side * 9 // 16) // 2 * 2
    return long_side, (long_side * 9 // 16) // 2 * 2


def elevenlabs_music_enabled() -> bool:
    """#1230 BE-22 optional ElevenLabs music source (John unblocked 1:14 AM). Used only when the project
    asks for musicSource='elevenlabs'; one paid generation per explicit action, never retried."""
    return _b("MOTION_STUDIO_ELEVENLABS_MUSIC", True)


NARRATION = {
    "voiceName": os.environ.get("MOTION_STUDIO_VOICE_NAME", "Brian"),
    "modelId": os.environ.get("MOTION_STUDIO_TTS_MODEL", "eleven_multilingual_v2"),
    "speed": float(os.environ.get("MOTION_STUDIO_TTS_SPEED", "0.85")),
    "outputFormat": os.environ.get("MOTION_STUDIO_TTS_FORMAT", "mp3_44100_128"),
    "chapterPauseMs": _i("MOTION_STUDIO_CHAPTER_PAUSE_MS", 900),
    "stability": 0.5,
    "similarityBoost": 0.75,
    "style": 0.0,
}
