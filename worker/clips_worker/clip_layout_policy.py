"""Shared layout mode for regular + streamer clips from picker archetype."""
from __future__ import annotations

from typing import Any

from clips_worker.clip_type import FACECAM_CONFIDENCE_THRESHOLD
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


def _facecam_edits_from_stream_layout(stream_layout: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(stream_layout, dict):
        return None
    box = stream_layout.get("facecam")
    if not isinstance(box, dict) or not all(k in box for k in ("x", "y", "w", "h")):
        return None
    return {
        "box": box,
        "gameplay": stream_layout.get("gameplay") if isinstance(stream_layout.get("gameplay"), dict) else None,
        "split": float(stream_layout.get("split") or 0.35),
        "position": str(stream_layout.get("facecamPosition") or "top"),
    }


def apply_clip_type_layout_to_edits(
    edits: dict,
    *,
    clip_type: str,
    has_facecam: bool,
    facecam_confidence: float,
    stream_facecam_layout: dict[str, Any] | None,
    headline_on: bool,
    fallback_archetype: str | None = None,
) -> dict:
    """Per-clip auto layout (T5). IRL / just_chatting keep speaker_follow; gaming uses stack when facecam confident."""
    ct = (clip_type or "other").strip().lower()
    layout = dict(edits.get("layout") or {})
    reason = f"clip_type_{ct}"

    if ct == "gaming" and has_facecam and facecam_confidence >= FACECAM_CONFIDENCE_THRESHOLD:
        fc = _facecam_edits_from_stream_layout(stream_facecam_layout)
        if fc:
            layout["mode"] = "facecam_stack"
            layout["facecam"] = {k: v for k, v in fc.items() if v is not None}
            out = {**edits, "layout": layout}
            from clips_worker.decision_log import decision_log

            decision_log(
                "layout",
                "clip_type_policy",
                clip_type=ct,
                layout_mode=layout["mode"],
                reason="gaming_facecam_stack",
                facecam_confidence=round(facecam_confidence, 3),
            )
            return out

    if ct == "gaming":
        mode, reason = resolve_content_layout_mode(archetype="gaming_stream", headline_on=headline_on)
        layout["mode"] = mode
        return apply_content_layout_to_edits(
            {**edits, "layout": layout},
            archetype="gaming_stream",
            headline_on=headline_on,
            log=True,
            archetype_source=reason,
        )

    if ct in ("irl", "just_chatting", "podcast"):
        layout["mode"] = "speaker_follow"
        if ct == "podcast" and isinstance(stream_facecam_layout, dict) and stream_facecam_layout.get("layout") == "split":
            layout["mode"] = "split"
        out = {**edits, "layout": layout}
        from clips_worker.decision_log import decision_log

        decision_log(
            "layout",
            "clip_type_policy",
            clip_type=ct,
            layout_mode=layout["mode"],
            reason=reason,
        )
        return out

    return apply_content_layout_to_edits(
        edits,
        archetype=fallback_archetype,
        headline_on=headline_on,
        log=True,
        archetype_source="clip_type_fallback",
    )


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
