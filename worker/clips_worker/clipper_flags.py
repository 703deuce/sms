"""Clipper feature gates — keep experimental paths off in production until explicitly enabled."""
from __future__ import annotations

import os

# Layouts that use speakercrop v2 / multiperson reframe when enabled.
MULTIPERSON_CAPABLE_LAYOUTS = frozenset(
    {
        "split",
        "dynamic",
        "split_debate",
        "grid",
        "locked_off",
        "speaker_follow",
    }
)


def clipper_multiperson_enabled() -> bool:
    """Default OFF in prod — set CLIPPER_MULTIPERSON_ENABLED=1 on worker after owner QA."""
    raw = os.environ.get("CLIPPER_MULTIPERSON_ENABLED", "0").strip().lower()
    return raw in ("1", "true", "yes", "on")


def layout_uses_multiperson_pipeline(layout: str) -> bool:
    return (layout or "").strip() in MULTIPERSON_CAPABLE_LAYOUTS


def maybe_set_multiperson_env(env: dict[str, str], layout: str) -> None:
    if clipper_multiperson_enabled() and layout_uses_multiperson_pipeline(layout):
        env["REFRAME_V"] = "2"
