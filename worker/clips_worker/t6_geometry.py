"""Resolve template geometry to pixel TemplateSpec v2 (P2)."""
from __future__ import annotations

from typing import Any

DEFAULT_FACECAM = {"x": 0.02, "y": 0.02, "w": 0.32, "h": 0.28}
DEFAULT_FULL = {"x": 0.0, "y": 0.0, "w": 1.0, "h": 1.0}
SRC_ASPECT = 16 / 9


def _even(n: float) -> int:
    v = int(round(n))
    return v - (v % 2)


def _clamp01(v: float) -> float:
    return max(0.0, min(1.0, float(v)))


def widen_to_aspect(
    box: dict,
    panel_aspect: float,
    *,
    src_aspect: float = SRC_ASPECT,
) -> dict:
    """Grow normalized box around its center to panel aspect, clamped to [0, 1]."""
    x = float(box.get("x") or 0)
    y = float(box.get("y") or 0)
    w = max(0.01, float(box.get("w") or 1))
    h = max(0.01, float(box.get("h") or 1))
    cx = x + w / 2
    cy = y + h / 2
    box_ar = (w * src_aspect) / h if h > 0 else src_aspect
    if box_ar < panel_aspect:
        h = (w * src_aspect) / panel_aspect
    else:
        w = (h * panel_aspect) / src_aspect
    x = cx - w / 2
    y = cy - h / 2
    if x < 0:
        x = 0
    if y < 0:
        y = 0
    if x + w > 1:
        x = max(0.0, 1.0 - w)
    if y + h > 1:
        y = max(0.0, 1.0 - h)
    return {"x": _clamp01(x), "y": _clamp01(y), "w": _clamp01(w), "h": _clamp01(h)}


def _trim_sides_box(signals: dict, edits: dict) -> dict:
    boxes: list[dict] = []
    layout = edits.get("layout") if isinstance(edits.get("layout"), dict) else {}
    tmpl = layout.get("template") if isinstance(layout.get("template"), dict) else {}
    tboxes = tmpl.get("boxes") if isinstance(tmpl.get("boxes"), dict) else {}
    for key in ("action", "action_box", "person:0", "person:1"):
        b = tboxes.get(key)
        if isinstance(b, dict):
            boxes.append(b)
    crop = layout.get("cropBox")
    if isinstance(crop, dict):
        boxes.append(crop)
    for key in ("action_box", "content_box", "person:0"):
        b = signals.get(key)
        if isinstance(b, dict):
            boxes.append(b)
    if not boxes:
        return {"x": 0.15, "y": 0.0, "w": 0.70, "h": 1.0}
    x0 = min(float(b.get("x") or 0) for b in boxes) - 0.05
    x1 = max(float(b.get("x") or 0) + float(b.get("w") or 0) for b in boxes) + 0.05
    w = _clamp01(max(0.70, min(1.0, x1 - x0)))
    cx = (x0 + x1) / 2
    x = _clamp01(cx - w / 2)
    if x + w > 1:
        x = max(0.0, 1.0 - w)
    return {"x": x, "y": 0.0, "w": w, "h": 1.0}


def _src_box(name: str, signals: dict, edits: dict, *, panel_aspect: float = 9 / 16) -> dict:
    layout = edits.get("layout") if isinstance(edits.get("layout"), dict) else {}
    tmpl = layout.get("template") if isinstance(layout.get("template"), dict) else {}
    boxes = tmpl.get("boxes") if isinstance(tmpl.get("boxes"), dict) else {}
    if name in boxes and isinstance(boxes[name], dict):
        raw = dict(boxes[name])
        if name in ("action_box_widened",) or str(name).endswith("_widened"):
            return widen_to_aspect(raw, panel_aspect)
        return raw
    if name == "facecam_box" and isinstance(boxes.get("facecam"), dict):
        return dict(boxes["facecam"])
    fc = layout.get("facecam") if isinstance(layout.get("facecam"), dict) else {}
    if name == "facecam_box":
        if isinstance(fc.get("box"), dict):
            return dict(fc["box"])
        fb = signals.get("facecam_box")
        if isinstance(fb, dict):
            return dict(fb)
        return dict(DEFAULT_FACECAM)
    if name in ("action_box", "action_box_widened"):
        crop = layout.get("cropBox")
        if isinstance(crop, dict):
            base = dict(crop)
        else:
            ab = signals.get("action_box")
            base = dict(ab) if isinstance(ab, dict) else dict(DEFAULT_FULL)
        if name == "action_box_widened":
            return widen_to_aspect(base, panel_aspect)
        return base
    if name == "trim_sides":
        return _trim_sides_box(signals, edits)
    if name == "content_box":
        if isinstance(boxes.get("content"), dict):
            return dict(boxes["content"])
        cb = signals.get("content_box")
        if isinstance(cb, dict):
            return dict(cb)
        return dict(DEFAULT_FULL)
    if name == "full":
        return dict(DEFAULT_FULL)
    if name.startswith("person:"):
        idx = name.split(":", 1)[-1]
        pk = f"person:{idx}"
        if isinstance(boxes.get(pk), dict):
            return dict(boxes[pk])
        pb = signals.get(pk) or signals.get("person_box")
        if isinstance(pb, dict):
            return dict(pb)
        return dict(DEFAULT_FACECAM)
    return dict(DEFAULT_FULL)


def _pip_dest(pip: dict, signals: dict, edits: dict, play_w: int, play_h: int) -> dict | None:
    if not isinstance(pip, dict):
        return None
    frac = float(pip.get("w") or 0.3)
    size = _even(play_w * frac)
    src = _src_box(str(pip.get("src") or "facecam_box"), signals, edits)
    action = _src_box("action_box", signals, edits)
    ax = float(action.get("x") or 0) + float(action.get("w") or 1) / 2
    ay = float(action.get("y") or 0) + float(action.get("h") or 1) / 2
    margin = int(play_w * 0.04)
    corners = [
        (margin, margin),
        (play_w - size - margin, margin),
        (margin, play_h - size - margin),
        (play_w - size - margin, play_h - size - margin),
    ]

    def dist(c: tuple[int, int]) -> float:
        cx = c[0] + size / 2
        cy = c[1] + size / 2
        return (cx / play_w - ax) ** 2 + (cy / play_h - ay) ** 2

    x, y = max(corners, key=dist)
    return {
        "dest": {"x": x, "y": y, "w": size, "h": size},
        "src": src,
        "shape": pip.get("shape") or "circle",
    }


def _title_rect(t: dict, bands_out: list[dict], play_w: int, play_h: int) -> dict | None:
    title = t.get("title") if isinstance(t.get("title"), dict) else {}
    slot = str(title.get("slot") or "")
    if slot in ("band_top", "on_video_top") and bands_out:
        top = min(bands_out, key=lambda b: int((b.get("dest") or {}).get("y") or 0))
        return dict(top.get("dest") or {})
    if slot == "on_video_top" and t.get("panels"):
        p0 = (t.get("panels") or [None])[0] or {}
        py = float(p0.get("y") or 0)
        ph = min(0.22, float(p0.get("h") or 0.2) * 0.35)
        return {"x": 0, "y": _even(play_h * py), "w": play_w, "h": _even(play_h * ph)}
    return None


def resolve_template_geometry(
    t: dict,
    s: dict,
    edits: dict,
    play_w: int = 1080,
    play_h: int = 1920,
) -> dict:
    panels_raw = list(t.get("panels") or [])
    panels_out: list[dict] = []
    for idx, p in enumerate(panels_raw):
        ph = float(p.get("h") or 0)
        py = float(p.get("y") if p.get("y") is not None else 0)
        dest_y = _even(play_h * py)
        dest_h = _even(play_h * ph)
        if idx == len(panels_raw) - 1 and abs(py + ph - 1.0) < 0.005:
            dest_h = play_h - dest_y
        dest_w = _even(play_w * float(p.get("w") or 1.0))
        dest_x = _even(play_w * float(p.get("x") or 0.0))
        panel_aspect = (dest_w / dest_h) if dest_h > 0 else 9 / 16
        src_name = str(p.get("src") or "full")
        src = _src_box(src_name, s, edits, panel_aspect=panel_aspect)
        panels_out.append(
            {
                "dest": {"x": dest_x, "y": dest_y, "w": dest_w, "h": dest_h},
                "src": src,
                "fit": p.get("fit") or "cover",
                "track": p.get("track"),
            }
        )
    cap_y = float((t.get("captions") or {}).get("y") or 0.65)
    bands_out: list[dict] = []
    for b in t.get("bands") or []:
        by = float(b.get("y") or 0)
        bh = float(b.get("h") or 0)
        bands_out.append(
            {
                "dest": {"x": 0, "y": _even(play_h * by), "w": play_w, "h": _even(play_h * bh)},
                "fill": b.get("fill") or "blur",
            }
        )
    pip_out = _pip_dest(t.get("pip"), s, edits, play_w, play_h) if t.get("pip") else None
    title_rect = _title_rect(t, bands_out, play_w, play_h)
    return {
        "v": 2,
        "kind": "template",
        "templateId": t.get("id"),
        "playW": play_w,
        "playH": play_h,
        "panels": panels_out,
        "bands": bands_out,
        "pip": pip_out,
        "titleRect": title_rect,
        "captionRect": {"x": 0, "y": _even(play_h * cap_y), "w": play_w, "h": _even(play_h * 0.12)},
        "avoidRects": [],
    }
