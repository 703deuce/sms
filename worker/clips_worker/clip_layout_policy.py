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


def _edits_from_channel_clip_type_preset(preset: dict[str, Any]) -> dict[str, Any] | None:
    if not isinstance(preset, dict):
        return None
    mode = str(preset.get("mode") or "").strip()
    if not mode:
        return None
    fc = preset.get("facecam")
    layout: dict[str, Any] = {"mode": mode}
    if isinstance(fc, dict) and isinstance(fc.get("box"), dict):
        layout["facecam"] = {
            k: fc[k]
            for k in ("box", "gameplay", "split", "position", "pipCorner")
            if fc.get(k) is not None
        }
    return layout


def apply_channel_clip_type_layout(
    edits: dict,
    *,
    clip_type: str,
    channel_layouts: dict[str, Any] | None,
) -> dict:
    """Merge saved per-channel / per-clip-type layout defaults (T5 Part D)."""
    if not channel_layouts or not isinstance(channel_layouts, dict):
        return edits
    ct = (clip_type or "other").strip().lower()
    preset = channel_layouts.get(ct)
    if not isinstance(preset, dict):
        return edits
    layout_patch = _edits_from_channel_clip_type_preset(preset)
    if not layout_patch:
        return edits
    layout = dict(edits.get("layout") or {})
    layout.update(layout_patch)
    if isinstance(layout_patch.get("facecam"), dict):
        layout["facecam"] = layout_patch["facecam"]
    return {**edits, "layout": layout}


def apply_clip_type_layout_to_edits(
    edits: dict,
    *,
    clip_type: str,
    has_facecam: bool,
    facecam_confidence: float,
    stream_facecam_layout: dict[str, Any] | None,
    headline_on: bool,
    fallback_archetype: str | None = None,
    channel_clip_type_layouts: dict[str, Any] | None = None,
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
            return apply_channel_clip_type_layout(
                out,
                clip_type=ct,
                channel_layouts=channel_clip_type_layouts,
            )

    if ct == "gaming":
        mode, reason = resolve_content_layout_mode(archetype="gaming_stream", headline_on=headline_on)
        layout["mode"] = mode
        out = apply_content_layout_to_edits(
            {**edits, "layout": layout},
            archetype="gaming_stream",
            headline_on=headline_on,
            log=True,
            archetype_source=reason,
        )
        return apply_channel_clip_type_layout(
            out,
            clip_type=ct,
            channel_layouts=channel_clip_type_layouts,
        )

    if ct == "irl":
        layout = dict(edits.get("layout") or {})
        layout["mode"] = "fit_blur" if headline_on else "center_crop"
        out = apply_channel_clip_type_layout(
            {**edits, "layout": layout},
            clip_type=ct,
            channel_layouts=channel_clip_type_layouts,
        )
        from clips_worker.decision_log import decision_log

        layout = out.get("layout") if isinstance(out.get("layout"), dict) else {}
        decision_log(
            "layout",
            "clip_type_policy",
            clip_type=ct,
            layout_mode=str(layout.get("mode") or "speaker_follow"),
            reason="irl_headline_fit_blur" if headline_on else "irl_no_headline_center_crop",
        )
        return out

    if ct in ("just_chatting", "podcast", "other"):
        out = apply_channel_clip_type_layout(
            edits,
            clip_type=ct,
            channel_layouts=channel_clip_type_layouts,
        )
        from clips_worker.decision_log import decision_log

        layout = out.get("layout") if isinstance(out.get("layout"), dict) else {}
        decision_log(
            "layout",
            "clip_type_policy",
            clip_type=ct,
            layout_mode=str(layout.get("mode") or "speaker_follow"),
            reason="preserve_initial_edits",
        )
        return out

    out = apply_content_layout_to_edits(
        edits,
        archetype=fallback_archetype,
        headline_on=headline_on,
        log=True,
        archetype_source="clip_type_fallback",
    )
    return apply_channel_clip_type_layout(
        out,
        clip_type=ct,
        channel_layouts=channel_clip_type_layouts,
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
