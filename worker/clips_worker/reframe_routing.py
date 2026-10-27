"""Production reframe routing: probe person count → layout + REFRAME_V=2 env."""
from __future__ import annotations

import os
import sys
from pathlib import Path

from clips_worker.layout_router import PersonCountSummary, route_multiperson_layout
from clips_worker.render_clip import V3, multiperson_reframe_enabled, resolve_clip_layout

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
    if os.environ.get("CLIPPER_AUTO_MP_ROUTE", "1").strip() in ("0", "false", "no"):
        return False
    if multiperson_reframe_enabled():
        return True
    if (settings.get("mode") or "talking") != "talking":
        return False
    return layout in ("auto", "dynamic", "grid", "grid3", "grid4", "split", "split_debate")


def apply_production_reframe_routing(
    clip_src: Path,
    settings: dict,
    clip_index: int,
) -> tuple[str, dict[str, str]]:
    """Returns resolved layout and extra speakercrop env (may include REFRAME_V=2)."""
    layout = resolve_clip_layout(settings, clip_index)
    extra: dict[str, str] = {}
    if not should_auto_route_person_count(settings, layout):
        if multiperson_reframe_enabled():
            extra["REFRAME_V"] = "2"
        return layout, extra
    try:
        summary = _v3_probe(clip_src)
    except Exception:
        return layout, extra
    routed, use_v2 = route_multiperson_layout(summary, layout)
    if use_v2:
        extra["REFRAME_V"] = "2"
        extra["PERSON_COUNT"] = str(summary.n_persons)
        extra["PERSON_CONF"] = f"{summary.confidence:.3f}"
        return routed, extra
    return layout, extra
