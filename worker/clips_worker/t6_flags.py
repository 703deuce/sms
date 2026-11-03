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


def t6_render_template_enabled(settings: dict | None, edits: dict | None) -> bool:
    """FIX1: a clip whose edits carry a template renders THAT template (editor parity),
    unless the project explicitly disabled templates or T6_TEMPLATES=0."""
    s = settings if isinstance(settings, dict) else {}
    t6 = s.get("t6") if isinstance(s.get("t6"), dict) else {}
    if t6.get("templates") is False or os.environ.get("T6_TEMPLATES") == "0":
        return False
    if t6_templates_enabled(settings):
        return True
    ed = edits if isinstance(edits, dict) else {}
    layout = ed.get("layout") if isinstance(ed.get("layout"), dict) else {}
    tmpl = layout.get("template") if isinstance(layout.get("template"), dict) else {}
    return bool(str(tmpl.get("id") or "").strip())
