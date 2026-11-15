"""Motion Studio flags + per-step model routing (#1229 BE-20). All behavior is env-configurable; no
secrets are read here except by name. Luna (`gpt-6-luna`) for every step, no automatic escalation;
switch one step (e.g. scene_code -> gpt-6.1-sol) with MOTION_STUDIO_MODEL_SCENE_CODE alone."""
from __future__ import annotations

import os

STEPS = ("story", "research_plan", "director", "production_designer", "motion_engineer", "scene_code", "scene_fix", "storyboard", "visual_reviewer", "critic", "analysis", "chat")
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


# Project-level model overrides (settings.models.<step> or settings.model_<step>).
_project_settings: dict = {}


def apply_project_settings(settings: dict | None) -> None:
    """Install this project's settings so model_for() honours settings.models."""
    global _project_settings
    _project_settings = dict(settings or {})


def model_for(step: str, settings: dict | None = None) -> str:
    """Resolve the model for a pipeline step. Precedence: explicit settings,
    then project settings.models / model_<step>, then MOTION_STUDIO_MODEL_<STEP>,
    then MOTION_STUDIO_MODEL, then DEFAULT_MODEL (gpt-6-luna). No automatic escalation.

    Per-stage keys are the switch for a later model comparison. All roles default
    to gpt-6-luna. `motion_engineer` falls back to the `scene_code` key when no
    dedicated engineer key is set, so existing config keeps working.
    """
    src = settings if settings is not None else _project_settings
    models = src.get("models") if isinstance((src or {}).get("models"), dict) else {}
    keys = [step]
    if step == "motion_engineer" and not (models or {}).get("motion_engineer"):
        keys.append("scene_code")
    for key in keys:
        for v in (
            (models or {}).get(key),
            (src or {}).get(f"model_{key}"),
            os.environ.get(f"MOTION_STUDIO_MODEL_{key.upper()}"),
        ):
            if isinstance(v, str) and v.strip():
                return v.strip()
    global_model = os.environ.get("MOTION_STUDIO_MODEL")
    if isinstance(global_model, str) and global_model.strip():
        return global_model.strip()
    return DEFAULT_MODEL



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


# Named presets and WxH. Default 480p while we test; switch with
# MOTION_STUDIO_RENDER_SIZE=1080p (or 1920x1080) or project settings.renderSize.
RENDER_PRESETS = {
    "480p": (854, 480),
    "720p": (1280, 720),
    "1080p": (1920, 1080),
    "2160p": (3840, 2160),
    "4k": (3840, 2160),
}
DEFAULT_RENDER_SIZE = "480p"
DEFAULT_RENDER_CRF = 22
DEFAULT_RENDER_PRESET = "fast"
_PRESETS_X264 = frozenset({
    "ultrafast", "superfast", "veryfast", "faster", "fast", "medium", "slow", "slower", "veryslow",
})


def parse_render_size(raw: str | None) -> tuple[int, int] | None:
    """Parse '480p', '1080p', or '1920x1080'. Returns None if the value is empty or invalid."""
    s = (raw or "").strip().lower().replace(" ", "").replace("×", "x")
    if not s:
        return None
    if s in RENDER_PRESETS:
        return RENDER_PRESETS[s]
    if "x" in s:
        a, b = s.split("x", 1)
        try:
            w, h = int(a), int(b)
        except ValueError:
            return None
        if 16 <= w <= 7680 and 16 <= h <= 4320 and w % 2 == 0 and h % 2 == 0:
            return w, h
    return None


def render_size(aspect: str = "16:9", settings: dict | None = None) -> tuple[int, int]:
    """Pixel size for segment renders and the assemble master.

    Precedence: project settings.renderSize / settings.resolution, then
    MOTION_STUDIO_RENDER_SIZE, then 480p (854x480).
    """
    raw = None
    if isinstance(settings, dict):
        raw = settings.get("renderSize") or settings.get("resolution")
    parsed = parse_render_size(str(raw) if raw is not None else None)
    if parsed is None:
        parsed = parse_render_size(os.environ.get("MOTION_STUDIO_RENDER_SIZE"))
    w, h = parsed or RENDER_PRESETS[DEFAULT_RENDER_SIZE]
    long_side = max(w, h)
    if aspect == "9:16":
        return (long_side * 9 // 16) // 2 * 2, long_side
    if aspect == "1:1":
        side = (long_side * 9 // 16) // 2 * 2
        return side, side
    return long_side, (long_side * 9 // 16) // 2 * 2


def _apply_aspect(w: int, h: int, aspect: str) -> tuple[int, int]:
    long_side = max(w, h)
    if aspect == "9:16":
        return (long_side * 9 // 16) // 2 * 2, long_side
    if aspect == "1:1":
        side = (long_side * 9 // 16) // 2 * 2
        return side, side
    return long_side, (long_side * 9 // 16) // 2 * 2


def final_render_size(aspect: str = "16:9", settings: dict | None = None) -> tuple[int, int]:
    """Delivery resolution for typography/detail QA.

    Iteration may run at 480p, but preview QA still verifies typography, thin
    lines, grain, photo detail and small UI at this size (default 1080p).
    """
    raw = None
    if isinstance(settings, dict):
        raw = settings.get("finalRenderSize") or settings.get("deliverySize")
    parsed = parse_render_size(str(raw) if raw is not None else None)
    if parsed is None:
        parsed = parse_render_size(os.environ.get("MOTION_STUDIO_FINAL_SIZE"))
    if parsed is None and isinstance(settings, dict):
        fmt = str(settings.get("format") or "")
        if "2160" in fmt or "4k" in fmt.lower():
            parsed = RENDER_PRESETS["2160p"]
        elif "720" in fmt:
            parsed = RENDER_PRESETS["720p"]
        else:
            parsed = RENDER_PRESETS["1080p"]
    if parsed is None:
        parsed = RENDER_PRESETS["1080p"]
    return _apply_aspect(*parsed, aspect)


def render_crf(settings: dict | None = None) -> int:
    raw = None
    if isinstance(settings, dict):
        raw = settings.get("renderCrf")
    if raw is None or str(raw).strip() == "":
        raw = os.environ.get("MOTION_STUDIO_RENDER_CRF")
    try:
        n = int(raw) if raw is not None and str(raw).strip() != "" else DEFAULT_RENDER_CRF
    except (TypeError, ValueError):
        n = DEFAULT_RENDER_CRF
    return max(12, min(32, n))


def render_preset(settings: dict | None = None) -> str:
    raw = None
    if isinstance(settings, dict):
        raw = settings.get("renderPreset")
    if raw is None or str(raw).strip() == "":
        raw = os.environ.get("MOTION_STUDIO_RENDER_PRESET")
    s = (str(raw).strip().lower() if raw is not None else "") or DEFAULT_RENDER_PRESET
    return s if s in _PRESETS_X264 else DEFAULT_RENDER_PRESET


def encoder_args(settings: dict | None = None, *, crf: int | None = None, preset: str | None = None) -> list[str]:
    """libx264 args for segment, normalize, and master encodes (CRF 22 / fast by default)."""
    c = render_crf(settings) if crf is None else max(12, min(32, int(crf)))
    p = render_preset(settings) if preset is None else (preset if preset in _PRESETS_X264 else DEFAULT_RENDER_PRESET)
    return ["-c:v", "libx264", "-preset", p, "-crf", str(c), "-pix_fmt", "yuv420p"]


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
