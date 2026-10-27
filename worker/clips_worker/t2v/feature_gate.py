"""AI Video worker gate — refuse new T2V jobs when product is paused (default off)."""

import os

T2V_JOB_TYPES = frozenset(
    {
        "T2V_ASSEMBLE",
        "T2V_EXTRACT_DECK",
        "T2V_VOICE_CLONE",
        "T2V_SCENE_AI_IMAGE",
        "T2V_SCENE_AI_VIDEO",
    }
)


def ai_video_enabled() -> bool:
    raw = (
        os.environ.get("AI_VIDEO_ENABLED")
        or os.environ.get("FEATURE_T2V")
        or ""
    ).strip().lower()
    return raw in ("1", "true", "on", "yes")
