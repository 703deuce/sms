from __future__ import annotations

import os
from typing import Any


def _project_t6(settings: dict | None) -> dict:
    if not isinstance(settings, dict):
        return {}
    t6 = settings.get("t6")
    return t6 if isinstance(t6, dict) else {}


def t6_signals_enabled(settings: dict | None = None) -> bool:
    t6 = _project_t6(settings)
    if t6.get("templates") is True:
        return True
    if t6.get("templates") is False:
        return False
    return os.environ.get("T6_SIGNALS") == "1"


def t6_templates_enabled(settings: dict | None = None) -> bool:
    t6 = _project_t6(settings)
    if t6.get("templates") is True:
        return True
    if t6.get("templates") is False:
        return False
    return os.environ.get("T6_TEMPLATES") == "1"


def t6_caption_presets_enabled(settings: dict | None = None) -> bool:
    t6 = _project_t6(settings)
    if t6.get("captions") is True:
        return True
    if t6.get("captions") is False:
        return False
    return os.environ.get("T6_CAPTION_PRESETS") == "1"


def t6_title_auto_enabled(settings: dict | None = None) -> bool:
    t6 = _project_t6(settings)
    if t6.get("titles") is True:
        return True
    if t6.get("titles") is False:
        return False
    return os.environ.get("T6_TITLE_AUTO") == "1"


def t6_log_fallback(stage: str, exc: BaseException) -> None:
    print(f"[t6:fallback] stage={stage} err={type(exc).__name__}", flush=True)
    try:
        from clips_worker.decision_log import decision_log

        decision_log("t6", "fallback", stage=stage, err=type(exc).__name__)
    except Exception:
        pass
