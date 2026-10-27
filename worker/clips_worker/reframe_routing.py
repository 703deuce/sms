"""Production reframe routing: probe person count → layout + REFRAME_V=2 env."""
from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any

from clips_worker.layout_router import PersonCountSummary, route_multiperson_layout
from clips_worker.reframe_v2 import layout_for_legacy_reframe, reframe_v2_ops_enabled
from clips_worker.render_clip import V3, resolve_clip_layout

V3_STR = str(V3)


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


def should_auto_route_person_count(settings: dict, layout: str) -> bool:
    if not reframe_v2_ops_enabled():
        return False
    if os.environ.get("CLIPPER_AUTO_MP_ROUTE", "0").strip() in ("0", "false", "no"):
        return False
    if (settings.get("mode") or "talking") != "talking":
        return False
    return layout in ("auto", "dynamic", "grid", "grid3", "grid4", "split", "split_debate")


def apply_production_reframe_routing(
    clip_src: Path,
    settings: dict,
    clip_index: int,
) -> tuple[str, dict[str, str], dict[str, Any]]:
    """Returns (applied layout, speakercrop extra env, layoutRouteShadow for aiMeta)."""
    user_layout = resolve_clip_layout(settings, clip_index)
    shadow: dict[str, Any] = {
        "userLayout": user_layout,
        "reframeV2Enabled": reframe_v2_ops_enabled(),
        "probed": False,
    }
    extra: dict[str, str] = {}

    routed_layout = user_layout
    want_v2 = False

    if should_auto_route_person_count(settings, user_layout):
        try:
            summary = _v3_probe(clip_src)
            shadow["probed"] = True
            shadow["nPersons"] = summary.n_persons
            shadow["confidence"] = round(summary.confidence, 4)
            routed_layout, want_v2 = route_multiperson_layout(summary, user_layout)
            shadow["routedLayout"] = routed_layout
            shadow["useReframeV2"] = want_v2
        except Exception as exc:
            shadow["probeError"] = type(exc).__name__

    if reframe_v2_ops_enabled():
        applied = routed_layout
        extra["REFRAME_V"] = "2"
        shadow["appliedLayout"] = applied
        return applied, extra, shadow

    if want_v2:
        applied = layout_for_legacy_reframe(routed_layout)
    else:
        applied = layout_for_legacy_reframe(user_layout)
    shadow["appliedLayout"] = applied
    return applied, extra, shadow
