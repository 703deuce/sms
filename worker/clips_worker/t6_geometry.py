"""Resolve template geometry to pixel TemplateSpec v2 (P2)."""
from __future__ import annotations

from typing import Any

DEFAULT_FACECAM = {"x": 0.02, "y": 0.02, "w": 0.32, "h": 0.28}
DEFAULT_FULL = {"x": 0.0, "y": 0.0, "w": 1.0, "h": 1.0}


def _even(n: float) -> int:
    v = int(round(n))
    return v - (v % 2)


def _src_box(name: str, signals: dict, edits: dict) -> dict:
    layout = edits.get("layout") if isinstance(edits.get("layout"), dict) else {}
    tmpl = layout.get("template") if isinstance(layout.get("template"), dict) else {}
    boxes = tmpl.get("boxes") if isinstance(tmpl.get("boxes"), dict) else {}
    if name in boxes and isinstance(boxes[name], dict):
        return dict(boxes[name])
    fc = layout.get("facecam") if isinstance(layout.get("facecam"), dict) else {}
    if name == "facecam_box":
        if isinstance(fc.get("box"), dict):
            return dict(fc["box"])
        fb = signals.get("facecam_box")
        if isinstance(fb, dict):
            return dict(fb)
        return dict(DEFAULT_FACECAM)
    if name in ("action_box", "action_box_widened"):
        ab = signals.get("action_box")
        if isinstance(ab, dict):
            return dict(ab)
        return dict(DEFAULT_FULL)
    if name == "content_box":
        cb = signals.get("content_box")
        if isinstance(cb, dict):
            return dict(cb)
        return dict(DEFAULT_FULL)
    if name == "full":
        return dict(DEFAULT_FULL)
    if name.startswith("person:"):
        return dict(DEFAULT_FACECAM)
    return dict(DEFAULT_FULL)


def resolve_template_geometry(
    t: dict,
    s: dict,
    edits: dict,
    play_w: int = 1080,
    play_h: int = 1920,
) -> dict:
    panels_out: list[dict] = []
    y_cursor = 0
    for idx, p in enumerate(t.get("panels") or []):
        ph = float(p.get("h") or 0)
        py = float(p.get("y") if p.get("y") is not None else y_cursor)
        dest_h = _even(play_h * ph) if idx < len(t.get("panels") or []) - 1 else play_h - y_cursor
        dest_y = _even(play_h * py) if idx == 0 else y_cursor
        dest_w = _even(play_w * float(p.get("w") or 1.0))
        dest_x = _even(play_w * float(p.get("x") or 0.0))
        src = _src_box(str(p.get("src") or "full"), s, edits)
        panels_out.append(
            {
                "dest": {"x": dest_x, "y": dest_y, "w": dest_w, "h": dest_h},
                "src": src,
                "fit": p.get("fit") or "cover",
                "track": p.get("track"),
            }
        )
        y_cursor = dest_y + dest_h
    cap_y = float((t.get("captions") or {}).get("y") or 0.65)
    return {
        "v": 2,
        "kind": "template",
        "templateId": t.get("id"),
        "playW": play_w,
        "playH": play_h,
        "panels": panels_out,
        "bands": [],
        "pip": t.get("pip"),
        "titleRect": None,
        "captionRect": {"x": 0, "y": _even(play_h * cap_y), "w": play_w, "h": _even(play_h * 0.12)},
        "avoidRects": [],
    }
