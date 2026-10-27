"""Production reframe routing: probe person count → layout + REFRAME_V=2 env."""
from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any

from clips_worker.layout_router import PersonCountSummary, route_multiperson_layout
from clips_worker.reframe_v2 import (
    V2_ONLY_LAYOUTS,
    layout_for_legacy_reframe,
    layout_shadow_enabled,
    reframe_v2_ops_enabled,
)
from clips_worker.render_clip import V3, resolve_clip_layout

V3_STR = str(V3)

_AUTO_ROUTE_LAYOUTS = frozenset(
    {"auto", "dynamic", "grid", "grid3", "grid4", "split", "split_debate"},
)


def auto_multiperson_route_enabled() -> bool:
    """Production multiperson probe + routing (independent of REFRAME_V2_ENABLED ops gate)."""
    return os.environ.get("CLIPPER_AUTO_MP_ROUTE", "1").strip().lower() not in (
        "0",
        "false",
        "no",
    )


def probe_video_person_count(video: Path) -> PersonCountSummary:
    """Public entry for multiperson face-count probe (reframe v1 / v3 path)."""
    return _v3_probe(video)


def _v3_probe(video: Path) -> PersonCountSummary:
    if str(V3) not in sys.path:
        sys.path.insert(0, V3_STR)
    from person_count_probe import probe_person_count  # type: ignore[import-not-found]

    raw = probe_person_count(str(video))
    return PersonCountSummary(
        n_persons=int(raw["n_persons"]),
        confidence=float(raw["confidence"]),
        mean_embed_coverage=float(raw.get("mean_embed_coverage", 1.0)),
    )


def _layout_eligible_for_probe(settings: dict, layout: str) -> bool:
    if (settings.get("mode") or "talking") != "talking":
        return False
    return layout in _AUTO_ROUTE_LAYOUTS


def should_run_person_count_probe(settings: dict, layout: str) -> bool:
    """Probe for talking clips when auto MP route is on, v2 ops is on, or shadow mode."""
    if not _layout_eligible_for_probe(settings, layout):
        return False
    if auto_multiperson_route_enabled():
        return True
    if reframe_v2_ops_enabled():
        return True
    return layout_shadow_enabled()


def should_apply_probe_routing() -> bool:
    return auto_multiperson_route_enabled() or reframe_v2_ops_enabled()


def apply_production_reframe_routing(
    clip_src: Path,
    settings: dict,
    clip_index: int,
) -> tuple[str, dict[str, str], dict[str, Any]]:
    """Returns (applied layout, speakercrop extra env, layoutRouteShadow for aiMeta)."""
    raw_layout = (settings.get("layout") or "speaker_follow").strip()
    user_layout = resolve_clip_layout(settings, clip_index)
    shadow: dict[str, Any] = {
        "userLayout": user_layout,
        "settingsLayout": raw_layout,
        "reframeV2Enabled": reframe_v2_ops_enabled(),
        "layoutShadow": layout_shadow_enabled(),
        "probed": False,
    }
    extra: dict[str, str] = {}

    routed_layout = user_layout
    want_v2 = False

    if should_run_person_count_probe(settings, user_layout):
        try:
            summary = _v3_probe(clip_src)
            shadow["probed"] = True
            shadow["nPersons"] = summary.n_persons
            shadow["confidence"] = round(summary.confidence, 4)
            if should_apply_probe_routing():
                routed_layout, want_v2 = route_multiperson_layout(summary, user_layout)
                shadow["routedLayout"] = routed_layout
                shadow["useReframeV2"] = want_v2
            else:
                shadow["routedLayout"] = route_multiperson_layout(summary, user_layout)[0]
                shadow["useReframeV2"] = False
        except Exception as exc:
            shadow["probeError"] = type(exc).__name__

    if should_apply_probe_routing() and shadow.get("probed"):
        applied = routed_layout
        if want_v2:
            extra["REFRAME_V"] = "2"
    elif shadow.get("probed") and layout_shadow_enabled():
        applied = layout_for_legacy_reframe(routed_layout)
    elif raw_layout != "auto" and (
        user_layout in V2_ONLY_LAYOUTS
        or user_layout
        in (
            "split_debate",
            "screen_pip",
            "pip",
            "side",
        )
    ):
        applied = user_layout
        extra["REFRAME_V"] = "2"
    else:
        applied = layout_for_legacy_reframe(user_layout)

    shadow["appliedLayout"] = applied
    return applied, extra, shadow
