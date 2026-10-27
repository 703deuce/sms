"""Ops gate for speakercrop v2 / multiperson layouts (worker env REFRAME_V2_ENABLED=1)."""
from __future__ import annotations

import os

V2_ONLY_LAYOUTS = frozenset(
    {"grid3", "grid4", "dynamic", "grid", "split_debate", "locked_off"},
)


def reframe_v2_ops_enabled() -> bool:
    return os.environ.get("REFRAME_V2_ENABLED", "").strip() == "1"


def layout_shadow_enabled() -> bool:
    """Optional layout-routing probe for aiMeta when v2 ops gate is off (default off)."""
    return os.environ.get("CLIPPER_LAYOUT_SHADOW", "").strip() == "1"


def layout_for_legacy_reframe(requested: str) -> str:
    """When v2 is off, multiperson layout ids run as v1 speaker_follow."""
    layout = (requested or "speaker_follow").strip()
    if layout in V2_ONLY_LAYOUTS:
        return "speaker_follow"
    return layout
