"""G3b: ASS events of one shape / sticker / progress item (see text_shapes.py).

Mirror of new-app/lib/clips/render-plan/text-shapes.ts → shapeItemEvents (byte-identical).
Same transform model as text items: (x, y) = centre in % of the frame, keyframes `text:<id>`
(item-local ms), G3b in / out / loop presets (text_anim.norm_layer_anim, whole layer).
"""
from __future__ import annotations

import math

from clips_worker.motion import MOTION_FPS, has_motion, layer_transform_at
from clips_worker.text_anim import fit_durations, frame_anim, norm_layer_anim
from clips_worker.text_shapes import (
    PROGRESS_CLIP_PAD,
    bgr,
    progress_path,
    shape_parts,
    shape_size_px,
    shape_spec,
)

_IDENT = {"x": 0.0, "y": 0.0, "scale": 100.0, "rotation": 0.0, "opacity": 100.0}


def shape_item_events(i: int, it: dict, edits: dict, *, w: int, h: int, fps: int = MOTION_FPS, layer: int = 1) -> list[str]:
    from clips_worker.text_items import _alpha_for_opacity, _anchor, _gradient_bands, _ts, gradient_of

    spec = shape_spec(it)
    if spec is None:
        return []
    st = it["style"]
    style = f"T{i}"
    ax, ay = _anchor(it, w, h)
    bw, bh = shape_size_px(spec, it, w, h)
    parts = shape_parts(spec, bw, bh)
    grad = gradient_of(st) if spec["kind"] == "shape" else None
    progress = spec["kind"] == "progress"
    track_a = _alpha_for_opacity(spec["trackOpacity"]) if progress else 255
    start, end = it["startMs"], it["endMs"]
    target = f"text:{it['id']}"
    motion = has_motion(edits, target)
    anim = norm_layer_anim(it.get("anim"))
    shadow = st.get("shadow") if isinstance(st.get("shadow"), dict) else None
    shadow_a = _alpha_for_opacity(shadow.get("opacity", 100)) if shadow else 255
    events: list[str] = []

    def ev(s_cs: int, e_cs: int, text: str) -> None:
        events.append(f"Dialogue: {layer},{_ts(s_cs)},{_ts(e_cs)},{style},,0,0,0,,{text}")

    def draw(s_cs: int, e_cs: int, head: str, cx: float, cy: float, scale: float, op: float, fill_w: int | None) -> None:
        """All parts of the item for one event span; head = position / transform / alpha tags."""
        if progress:
            if spec["track"]:
                a = round(255 - (255 - track_a) * op)
                ev(s_cs, e_cs, "{" + head + rf"\1c{bgr(spec['track'])}\1a&H{a:02X}&\p1}}" + progress_path(bw, bh, round(bw)))
            if fill_w is None:
                x0 = round(cx - bw / 2)
                x1 = round(cx + bw / 2)
                y0 = round(cy - bh / 2) - PROGRESS_CLIP_PAD
                y1 = round(cy + bh / 2) + PROGRESS_CLIP_PAD
                ev(s_cs, e_cs, "{" + head + rf"\clip({x0},{y0},{x0},{y1})\t(\clip({x0},{y0},{x1},{y1}))\p1}}" + progress_path(bw, bh, round(bw)))
            elif fill_w > 0:
                ev(s_cs, e_cs, "{" + head + r"\p1}" + progress_path(bw, bh, fill_w))
            return
        bands = _gradient_bands(grad, cx, cy, bw * scale / 100, bh * scale / 100, w, h) if grad else [""]
        for c, d in parts:
            col = rf"\1c{bgr(c)}" if c else ""
            for band in bands:
                ev(s_cs, e_cs, "{" + head + col + band + r"\p1}" + d)

    def fill_at(t_ms: float) -> int:
        p = (t_ms - start) / (end - start)
        p = 0.0 if p < 0 else (1.0 if p > 1 else p)
        return round(bw * p)

    if not motion and not anim:
        draw(start // 10, end // 10, rf"\an5\pos({round(ax)},{round(ay)})", ax, ay, 100.0, 1.0, None)
        return events
    f0 = int(math.ceil(start * fps / 1000 - 1e-9))
    f1 = int(math.ceil(end * fps / 1000 - 1e-9))
    d_in, d_out = fit_durations(anim, end - start) if anim else (0, 0)
    if motion or progress or (anim and "loop" in anim):
        spans = [(f0, f1)]
        mid = None
    else:
        fi = int(math.ceil((start + d_in) * fps / 1000 - 1e-9)) if d_in else f0
        fo = int(math.ceil((end - d_out) * fps / 1000 - 1e-9)) if d_out else f1
        fo = max(fo, fi)
        spans = [(f0, fi), (fo, f1)]
        cs_a = int(math.floor(fi * 100 / fps + 1e-9)) if d_in else start // 10
        cs_b = int(math.floor(fo * 100 / fps + 1e-9)) if d_out else end // 10
        mid = (cs_a, cs_b) if cs_b > cs_a else None
    for si, (fa_, fb_) in enumerate(spans):
        if si == 1 and mid:
            draw(mid[0], mid[1], rf"\an5\pos({round(ax)},{round(ay)})", ax, ay, 100.0, 1.0, None)
        for f in range(fa_, fb_):
            t_ms = f * 1000 / fps
            s_cs = int(math.floor(f * 100 / fps + 1e-9))
            e_cs = int(math.floor((f + 1) * 100 / fps + 1e-9))
            if e_cs <= s_cs:
                continue
            tf = layer_transform_at(edits, target, t_ms - start) if motion else dict(_IDENT)
            if anim:
                fa = frame_anim(anim, t_ms, start, end, d_in, d_out)
                tf = {"x": tf["x"] + fa["dx"], "y": tf["y"] + fa["dy"], "scale": tf["scale"] * fa["sc"],
                      "rotation": tf["rotation"] + fa["rot"], "opacity": tf["opacity"] * fa["op"]}
            op = max(0.0, min(1.0, tf["opacity"] / 100))
            a_txt = round(255 * (1 - op))
            a_sh = round(255 - (255 - shadow_a) * op)
            cx = ax + tf["x"] * w / 100
            cy = ay + tf["y"] * h / 100
            px, py = round(cx), round(cy)
            sc = round(tf["scale"], 2)
            rot = round(-tf["rotation"], 2)
            head = (rf"\an5\pos({px},{py})\org({px},{py})\fscx{sc}\fscy{sc}\frz{rot}"
                    rf"\1a&H{a_txt:02X}&\3a&H{a_txt:02X}&\4a&H{a_sh:02X}&")
            draw(s_cs, e_cs, head, cx, cy, tf["scale"], op, fill_at(t_ms) if progress else None)
    return events
