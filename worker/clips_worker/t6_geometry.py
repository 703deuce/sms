"""Resolve template geometry to pixel TemplateSpec v2 (P2)."""
from __future__ import annotations

from typing import Any

DEFAULT_FACECAM = {"x": 0.02, "y": 0.02, "w": 0.32, "h": 0.28}
DEFAULT_FULL = {"x": 0.0, "y": 0.0, "w": 1.0, "h": 1.0}
SRC_ASPECT = 16 / 9
# T6.6: max extra zoom used to keep a titled face crop inside its facecam box.
MAX_TITLE_ZOOM = 2.0


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


FACE_SRCS = ("face_tight", "active_speaker")


def _faces(signals: dict) -> list[dict] | None:
    """T6.3: recurring YuNet faces from signals (t6_cv.detect_faces). None = never measured."""
    raw = signals.get("faces")
    if not isinstance(raw, list):
        return None
    out = []
    for f in raw:
        if isinstance(f, dict) and float(f.get("w") or 0) > 0 and float(f.get("h") or 0) > 0:
            out.append(f)
    return out


def _center_in(f: dict, r: dict) -> bool:
    cx = float(f["x"]) + float(f["w"]) / 2
    cy = float(f["y"]) + float(f["h"]) / 2
    rx, ry = float(r.get("x") or 0), float(r.get("y") or 0)
    return rx <= cx <= rx + float(r.get("w") or 1) and ry <= cy <= ry + float(r.get("h") or 1)


def _crop_at(cx: float, cy: float, h: float, panel_aspect: float, region: dict) -> dict:
    """Panel-aspect crop of height ``h`` centred on (cx, cy), shrunk/clamped inside ``region``."""
    rx, ry = float(region.get("x") or 0), float(region.get("y") or 0)
    rw, rh = float(region.get("w") or 1), float(region.get("h") or 1)
    w = h * panel_aspect / SRC_ASPECT
    k = min(1.0, rw / w if w > 0 else 1.0, rh / h if h > 0 else 1.0)
    w, h = w * k, h * k
    x = min(max(cx - w / 2, rx), rx + rw - w)
    y = min(max(cy - h / 2, ry), ry + rh - h)
    return {"x": round(_clamp01(x), 4), "y": round(_clamp01(y), 4), "w": round(_clamp01(w), 4), "h": round(_clamp01(h), 4)}


def _face_crop(face: dict, panel_aspect: float, region: dict, *, face_frac: float, top_inset: float = 0.0) -> dict:
    """Crop where the face is ``face_frac`` of the panel height, eyes a bit above centre.

    ``top_inset`` = fraction of the panel hidden under the title bar: the face is then centred
    in the visible part (zooming in if the region has no room above the face)."""
    fh = float(face["h"])
    cx = float(face["x"]) + float(face["w"]) / 2
    fcy = float(face["y"]) + fh / 2
    t = max(0.0, min(0.8, float(top_inset)))
    if t <= 0:
        h = min(float(region.get("h") or 1), fh / max(0.05, face_frac))
        return _crop_at(cx, fcy + h * 0.08, h, panel_aspect, region)
    h0 = min(float(region.get("h") or 1), fh / max(0.05, face_frac * (1 - t)))
    return _crop_under_title(face, fh, h0, panel_aspect, region, t)


def _crop_under_title(
    face: dict,
    fh: float,
    h0: float,
    panel_aspect: float,
    region: dict,
    t: float,
    *,
    cx: float | None = None,
    fcy: float | None = None,
) -> dict:
    """T6.3: the top ``t`` of the panel is covered by the title bar. Size the crop so the face
    fits in the visible part and centre it there.

    T6.6: the crop never leaves ``region``. A facecam at the bottom of the frame often has no
    room above the face; T6.3 let the under-title strip spill above the box, which showed black
    game background where the title does not fully cover it (blur/box title styles, preview).
    Now the crop zooms in (up to ``MAX_TITLE_ZOOM``, never smaller than the face needs) so the
    face sits under the title inside the box. Only when that is impossible does it spill, by the
    minimum amount and only into the strip hidden under the title. A full-frame region (no
    facecam) just clamps to the frame."""
    cx = float(cx if cx is not None else float(face["x"]) + float(face["w"]) / 2)
    fcy = float(fcy if fcy is not None else float(face["y"]) + float(face["h"]) / 2)
    h = min(1.0, max(h0, fh / (0.9 * (1 - t))))
    ft = t + (1 - t) * 0.45
    ry = float(region.get("y") or 0)
    if not _is_full_frame(region) and fcy - ft * h < ry:
        h = max(h / MAX_TITLE_ZOOM, (fcy - ry) / ft, fh / (0.95 * (1 - t)))
        if fcy - ft * h < ry - 1e-4:
            # Even at max zoom the face cannot sit under the title inside the box (e.g. G1: the
            # 384px title covers 57% of a 672px face panel). Spill only the minimum needed above
            # the box, never more than the strip hidden under the title.
            ny = max(0.0, ry - t * h, fcy - ft * h)
            rx, rw, rh = float(region.get("x") or 0), float(region.get("w") or 1), float(region.get("h") or 1)
            return _crop_at(cx, fcy - ft * h + h / 2, h, panel_aspect, {"x": rx, "y": ny, "w": rw, "h": min(1.0 - ny, rh + (ry - ny))})
    return _crop_at(cx, fcy - ft * h + h / 2, h, panel_aspect, region)


def _is_full_frame(region: dict) -> bool:
    return (
        float(region.get("x") or 0) <= 1e-6
        and float(region.get("y") or 0) <= 1e-6
        and float(region.get("w") or 1) >= 1 - 1e-6
        and float(region.get("h") or 1) >= 1 - 1e-6
    )


def _facecam_region(signals: dict, edits: dict) -> dict | None:
    layout = edits.get("layout") if isinstance(edits.get("layout"), dict) else {}
    tmpl = layout.get("template") if isinstance(layout.get("template"), dict) else {}
    boxes = tmpl.get("boxes") if isinstance(tmpl.get("boxes"), dict) else {}
    for b in (boxes.get("facecam_box"), boxes.get("facecam")):
        if isinstance(b, dict):
            return dict(b)
    fc = layout.get("facecam") if isinstance(layout.get("facecam"), dict) else {}
    if isinstance(fc.get("box"), dict):
        return dict(fc["box"])
    fb = signals.get("facecam_box")
    return dict(fb) if isinstance(fb, dict) else None


def _resolve_src(
    name: str,
    signals: dict,
    edits: dict,
    panel_aspect: float,
    role: str = "",
    top_inset: float = 0.0,
    panel_hfrac: float = 0.55,
) -> tuple[dict, str | None]:
    """T6.3: face/person-aware sources. Returns (src box, fit override or None).

    - face_tight / active_speaker: the real face (YuNet) inside the facecam box (else the frame);
      no face -> facecam box at panel aspect; no facecam either -> whole frame, contain_blur.
    - facecam_box (cover face panel): unchanged box, but a wide strip is centred on the faces
      instead of the wall between them.
    - person:N: user box, else face N's upper body; no person -> whole frame, contain_blur
      (IRL never zooms onto an empty wall).
    """
    layout = edits.get("layout") if isinstance(edits.get("layout"), dict) else {}
    tmpl = layout.get("template") if isinstance(layout.get("template"), dict) else {}
    boxes = tmpl.get("boxes") if isinstance(tmpl.get("boxes"), dict) else {}
    faces = _faces(signals) or []
    if name in boxes and isinstance(boxes[name], dict) and (name in FACE_SRCS or name.startswith("person:")):
        return dict(boxes[name]), None
    if name in FACE_SRCS:
        region = _facecam_region(signals, edits)
        cands = [f for f in faces if region is None or _center_in(f, region)]
        if cands:
            # Face ~34% of a half-height panel; a taller panel (C1 full screen) shows head+shoulders.
            ff = 0.34 * min(1.0, 0.55 / max(0.2, panel_hfrac))
            return _face_crop(cands[0], panel_aspect, region or dict(DEFAULT_FULL), face_frac=ff, top_inset=top_inset), None
        if region is not None:
            return widen_to_aspect_within(region, panel_aspect), None
        return dict(DEFAULT_FULL), "contain_blur"
    if name.startswith("person:"):
        try:
            idx = int(name.split(":", 1)[-1])
        except ValueError:
            idx = 0
        pb = signals.get(name)
        if isinstance(pb, dict):
            return dict(pb), None
        if idx < len(faces):
            return _face_crop(faces[idx], panel_aspect, dict(DEFAULT_FULL), face_frac=0.2, top_inset=top_inset), None
        return dict(DEFAULT_FULL), "contain_blur"
    if name == "facecam_box" and role in ("face", ""):
        if _facecam_region(signals, edits) is None:
            # No detected or user facecam: never crop the fixed top-left default box.
            return _resolve_src("face_tight", signals, edits, panel_aspect, role, top_inset, panel_hfrac)
        box = _src_box(name, signals, edits, panel_aspect=panel_aspect)
        inside = [f for f in faces if _center_in(f, box)]
        if not inside:
            return box, None
        return _cover_on_faces(box, inside, panel_aspect, top_inset), None
    return _src_box(name, signals, edits, panel_aspect=panel_aspect), None


def widen_to_aspect_within(region: dict, panel_aspect: float) -> dict:
    """Largest panel-aspect crop inside ``region`` (centred) — what `cover` would show."""
    rx, ry = float(region.get("x") or 0), float(region.get("y") or 0)
    rw, rh = max(0.01, float(region.get("w") or 1)), max(0.01, float(region.get("h") or 1))
    return _crop_at(rx + rw / 2, ry + rh / 2, rh, panel_aspect, region)


def _cover_on_faces(box: dict, faces: list[dict], panel_aspect: float, top_inset: float = 0.0) -> dict:
    """Cover crop of ``box`` at panel aspect, centred on the faces (union if it fits, else the
    primary face). Returns ``box`` unchanged when cover would not crop it (and no title)."""
    full = widen_to_aspect_within(box, panel_aspect)
    t = max(0.0, min(0.8, float(top_inset)))
    if t > 0:
        fh = max(float(f["h"]) for f in faces)
        x0 = min(float(f["x"]) - 0.5 * float(f["w"]) for f in faces)
        x1 = max(float(f["x"]) + 1.5 * float(f["w"]) for f in faces)
        y0 = min(float(f["y"]) for f in faces)
        y1 = max(float(f["y"]) + float(f["h"]) for f in faces)
        if x1 - x0 <= float(full["w"]):
            cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        else:
            p = faces[0]
            cx, cy = float(p["x"]) + float(p["w"]) / 2, float(p["y"]) + float(p["h"]) / 2
        return _crop_under_title(faces[0], fh, float(full["h"]), panel_aspect, box, t, cx=cx, fcy=cy)
    if float(full["w"]) >= float(box.get("w") or 1) - 1e-3 and float(full["h"]) >= float(box.get("h") or 1) - 1e-3:
        return box
    x0 = min(float(f["x"]) - 0.5 * float(f["w"]) for f in faces)
    x1 = max(float(f["x"]) + 1.5 * float(f["w"]) for f in faces)
    y0 = min(float(f["y"]) for f in faces)
    y1 = max(float(f["y"]) + float(f["h"]) for f in faces)
    if x1 - x0 <= float(full["w"]):
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    else:
        p = faces[0]
        cx, cy = float(p["x"]) + float(p["w"]) / 2, float(p["y"]) + float(p["h"]) / 2
    return _crop_at(cx, cy + float(full["h"]) * 0.08, float(full["h"]), panel_aspect, box)


def _gameplay_region(signals: dict, edits: dict) -> dict | None:
    """User Gameplay box, else the detected one (facecamLayout.gameplay via signals)."""
    layout = edits.get("layout") if isinstance(edits.get("layout"), dict) else {}
    tmpl = layout.get("template") if isinstance(layout.get("template"), dict) else {}
    boxes = tmpl.get("boxes") if isinstance(tmpl.get("boxes"), dict) else {}
    fc = layout.get("facecam") if isinstance(layout.get("facecam"), dict) else {}
    for b in (boxes.get("gameplay"), fc.get("gameplay"), signals.get("gameplay_box")):
        if isinstance(b, dict) and float(b.get("w") or 0) > 0 and float(b.get("h") or 0) > 0:
            return dict(b)
    return None


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
            gp = _gameplay_region(signals, edits)
            # T6.3: no action box -> the game region (excludes the facecam/HUD strip), not the
            # whole frame (the G1/G6 game panel repeated the cam + mascot + stream info).
            base = dict(ab) if isinstance(ab, dict) else (gp if gp is not None else dict(DEFAULT_FULL))
        if name == "action_box_widened":
            return widen_to_aspect(base, panel_aspect)
        return base
    if name == "gameplay_box":
        # T6.2: whole game region (user-dragged Gameplay box, else full frame) — never a zoomed crop.
        gp = _gameplay_region(signals, edits)
        return gp if gp is not None else dict(DEFAULT_FULL)
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
    src = _src_box(str(pip.get("src") or "facecam_box"), signals, edits)
    size, pip_h, shape = _pip_size(src, frac, play_w, str(pip.get("shape") or "circle"))
    action = _src_box("action_box", signals, edits)
    ax = float(action.get("x") or 0) + float(action.get("w") or 1) / 2
    ay = float(action.get("y") or 0) + float(action.get("h") or 1) / 2
    margin = int(play_w * 0.04)
    corners = [
        (margin, margin),
        (play_w - size - margin, margin),
        (margin, play_h - pip_h - margin),
        (play_w - size - margin, play_h - pip_h - margin),
    ]
    if _headline_on(edits):
        corners = corners[2:]

    def dist(c: tuple[int, int]) -> float:
        cx = c[0] + size / 2
        cy = c[1] + pip_h / 2
        return (cx / play_w - ax) ** 2 + (cy / play_h - ay) ** 2

    x, y = max(corners, key=dist)
    return {
        "dest": {"x": x, "y": y, "w": size, "h": pip_h},
        "src": src,
        "shape": shape,
    }


def _headline_on(edits: dict) -> bool:
    tpl = edits.get("exportTemplate") if isinstance(edits.get("exportTemplate"), dict) else {}
    hb = tpl.get("headlineBar") if isinstance(tpl.get("headlineBar"), dict) else {}
    return bool(hb.get("enabled") and str(hb.get("text") or "").strip())


def _pip_size(src: dict, frac: float, play_w: int, shape: str) -> tuple[int, int, str]:
    """T6.2: a wide facecam (e.g. 2-person cam strip) keeps its aspect in a rect.

    Cropping a square circle out of the centre of a 3:1 cam box shows the wall between
    the people. Square-ish boxes keep the registry circle.
    """
    w = max(0.01, float(src.get("w") or 0.3))
    h = max(0.01, float(src.get("h") or 0.3))
    aspect = (w * SRC_ASPECT) / h
    if aspect > 1.3:
        pw = _even(play_w * max(frac, 0.6))
        return pw, max(2, _even(pw / aspect)), "rect"
    size = _even(play_w * frac)
    return size, size, shape


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


TITLE_BAR_FRAC = 0.2  # clip_export_template stream_headline_frame_layout bar (384/1920)


def _title_band(t: dict, bands_out: list[dict], edits: dict, play_w: int, play_h: int) -> tuple[int, int] | None:
    """T6.3: vertical span of the burned title (titleRect, else the fallback top bar) when the
    headline is on — face/person panels under it centre the face in the visible part."""
    if not _headline_on(edits):
        return None
    rect = _title_rect(t, bands_out, play_w, play_h)
    if rect and int(rect.get("h") or 0) >= 8:
        return int(rect.get("y") or 0), int(rect.get("y") or 0) + int(rect.get("h") or 0)
    return 0, int(round(play_h * TITLE_BAR_FRAC))


def resolve_template_geometry(
    t: dict,
    s: dict,
    edits: dict,
    play_w: int = 1080,
    play_h: int = 1920,
) -> dict:
    panels_raw = list(t.get("panels") or [])
    panels_out: list[dict] = []
    bands_pre = [
        {"dest": {"x": 0, "y": _even(play_h * float(b.get("y") or 0)), "w": play_w, "h": _even(play_h * float(b.get("h") or 0))}}
        for b in (t.get("bands") or [])
    ]
    title_band = _title_band(t, bands_pre, edits, play_w, play_h)
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
        inset = 0.0
        if title_band is not None and dest_h > 0:
            ty0, ty1 = title_band
            ov = min(ty1, dest_y + dest_h) - max(ty0, dest_y)
            if ov > 0 and ty0 <= dest_y + 1:
                inset = ov / dest_h
        src, fit_override = _resolve_src(
            src_name, s, edits, panel_aspect, str(p.get("role") or ""), inset, (dest_h / play_h) if play_h else 0.55
        )
        panels_out.append(
            {
                "dest": {"x": dest_x, "y": dest_y, "w": dest_w, "h": dest_h},
                "src": src,
                "fit": fit_override or p.get("fit") or "cover",
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
