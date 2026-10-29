"""Export compose geometry manifest — parity with editor stream-overlay-layout + overlay-geometry."""
from __future__ import annotations

from typing import Any

from clips_worker.layout_router import export_stream_headline_compose_active
from clips_worker.overlay_geometry import badge_rect, sticker_rect
from clips_worker.streamer.layout.stream_frame import _compose_layout, _headline_lines_from_edits
from clips_worker.streamer.layout.stream_overlay_layout import overlay_layout


def preview_overlay_layout(edits: dict, *, play_w: int = 1080, play_h: int = 1920) -> dict[str, int]:
    """Rects the editor uses (stream-compose-layout / export-template-overlay)."""
    lines = _headline_lines_from_edits(edits)
    line_count = max(2, len(lines) or 2)
    return overlay_layout(line_count, play_w=play_w, play_h=play_h)


def export_overlay_layout(edits: dict, *, play_w: int = 1080, play_h: int = 1920) -> dict[str, int]:
    lines = _headline_lines_from_edits(edits)
    line_count = max(2, len(lines) or 2)
    return _compose_layout(edits, line_count, play_w=play_w, play_h=play_h)


def compose_geometry_manifest(edits: dict, *, play_w: int = 1080, play_h: int = 1920) -> dict[str, Any]:
    lay = export_overlay_layout(edits, play_w=play_w, play_h=play_h)
    from clips_worker.layers_spec import _layer_by_id, badge_sprite_active, resolve_layers

    layers = resolve_layers(edits)
    badge_l = _layer_by_id(layers, "badge")
    sticker_l = next((l for l in layers if l.get("type") == "sticker" and l.get("enabled")), None)
    badge: dict[str, int] | None = None
    if badge_l and badge_sprite_active(badge_l):
        from clips_worker.clip_export_template import _platform_label

        platform = str(badge_l.get("platform") or "twitch")
        label, _ = _platform_label(platform)
        handle = str(badge_l.get("handle") or "")[:24]
        text = handle.upper() if handle and badge_l.get("showLabel") else (label if badge_l.get("showLabel") else "")
        badge = badge_rect(
            "fit_top_band",
            play_w,
            play_h,
            text=text,
            show_logo=bool(badge_l.get("showLogo")),
            video_y=lay["video_y"],
            video_h=lay["video_h"],
            anchor_top_gap=True,
        )
    sticker: dict[str, int] | None = None
    if sticker_l:
        x_pct = float(sticker_l.get("x") if sticker_l.get("x") is not None else 0.82)
        y_pct = float(sticker_l.get("y") if sticker_l.get("y") is not None else 0.12)
        sr = sticker_rect(play_w, play_h, x_pct, y_pct, anchor=str(sticker_l.get("anchor") or "center"))
        sticker = {"x": sr["x"], "y": sr["y"], "w": sr["w"], "h": sr["h"]}
    return {
        "play_w": play_w,
        "play_h": play_h,
        "headline_top": lay["headline_top"],
        "headline_h": lay["headline_h"],
        "video_y": lay["video_y"],
        "video_h": lay["video_h"],
        "bottom_y": lay["bottom_y"],
        "badge": badge,
        "sticker": sticker,
        "stream_compose": export_stream_headline_compose_active(edits),
    }
