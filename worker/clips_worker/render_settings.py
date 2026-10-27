"""Render export settings helpers (no DB deps)."""
from __future__ import annotations

import json


def settings_with_clip_ai_meta(settings: dict, ai_meta) -> dict:
    ai = ai_meta or {}
    if isinstance(ai, str):
        ai = json.loads(ai)
    if not isinstance(ai, dict):
        ai = {}
    return {**settings, "aiMeta": ai}
