"""Shared layout mode for regular + streamer clips from picker archetype."""
from __future__ import annotations

from clips_worker.picker.titles import INTERNAL_TITLES

_GAMEPLAY_ARCHETYPES = frozenset(
    {
        "gaming",
        "gaming_stream",
        "gameplay",
        "gameplay_action",
        "visual_watch",
        "reaction",
        "clutch",
        "highlight",
    }
)


def is_gameplay_content_archetype(archetype: str | None) -> bool:
    a = (archetype or "").strip().lower()
    if not a or a in INTERNAL_TITLES:
        return False
    if a in _GAMEPLAY_ARCHETYPES:
        return True
    return "game" in a or "visual" in a or a.endswith("_watch")


def resolve_content_layout_mode(
    *,
    archetype: str | None,
    headline_on: bool,
) -> tuple[str, str]:
    """Return (layout_mode, reason_code) for initial clip edits."""
    if is_gameplay_content_archetype(archetype):
        if headline_on:
            return "fit_top", "gameplay_archetype_with_headline"
        return "fit_blur", "gameplay_archetype"
    return "speaker_follow", "talking_head_archetype"


def apply_content_layout_to_edits(
    edits: dict,
    *,
    archetype: str | None,
    headline_on: bool = False,
    log: bool = True,
    archetype_source: str | None = None,
) -> dict:
    mode, reason = resolve_content_layout_mode(archetype=archetype, headline_on=headline_on)
    layout = dict(edits.get("layout") or {})
    layout["mode"] = mode
    out = {**edits, "layout": layout}
    if log:
        from clips_worker.decision_log import decision_log

        decision_log(
            "layout",
            "content_policy",
            archetype=str(archetype or "")[:40],
            archetype_source=str(archetype_source or "unknown")[:80],
            layout_mode=mode,
            reason=reason,
            headline_on=bool(headline_on),
        )
    return out
