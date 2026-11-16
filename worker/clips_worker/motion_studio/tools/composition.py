"""Trusted, deterministic generated-scene helpers for layered Motion Studio compositions.

No model-written functions execute here. The compiler includes RUNTIME in the existing
sandbox source; scene objects, groups, animation keys, and environment artwork are data.
"""
from __future__ import annotations

from collections import defaultdict

from clips_worker.motion_studio.tools.spec import frames_to_s


RUNTIME = '''
class _DirectedItem(Item):
    """Apply stable group/element transforms and animation to an existing engine Item."""
    def __init__(self, inner, layers, entrance=None, exit_at=None):
        super().__init__(t_in=inner.t_in, t_out=inner.t_out, z=inner.z, sfx=False)
        self.inner = inner
        self.layers = layers
        self.entrance = entrance or {}
        self.exit_at = exit_at

    def bounds(self, res):
        return None  # Animated/grouped objects can move beyond their original bounds.

    def cues(self):
        return self.inner.cues()

    def draw(self, c, res, t):
        c.save()
        alpha = 1.0
        for layer in self.layers:
            base = layer.get("base") or {}
            state = {
                "position": base.get("position") or {"x": 0, "y": 0},
                "scale": float(base.get("scale") or 1),
                "rotation": float(base.get("rotation") or 0),
                "opacity": float(base.get("opacity") if base.get("opacity") is not None else 1),
            }
            for a in layer.get("animations") or []:
                start, end = float(a.get("startS") or 0), float(a.get("endS") or 0)
                if t < start:
                    continue
                u = 1 if end <= start else max(0.0, min(1.0, (t - start) / (end - start)))
                easing = a.get("easing") or "linear"
                if easing == "ease_in_out":
                    u = u * u * (3 - 2 * u)
                elif easing == "ease_in":
                    u = u * u
                elif easing == "ease_out":
                    u = 1 - (1 - u) * (1 - u)
                elif easing == "ease_out_cubic":
                    u = 1 - (1 - u) ** 3
                elif easing == "ease_out_back":
                    u = 1 + 2.70158 * (u - 1) ** 3 + 1.70158 * (u - 1) ** 2
                prop = a.get("property")
                start_val, end_val = a.get("from"), a.get("to")
                if prop == "position" and isinstance(start_val, dict) and isinstance(end_val, dict):
                    state["position"] = {
                        "x": float(start_val.get("x") or 0) * (1-u) + float(end_val.get("x") or 0) * u,
                        "y": float(start_val.get("y") or 0) * (1-u) + float(end_val.get("y") or 0) * u,
                    }
                elif prop in ("position.x", "position.y", "scale", "rotation", "opacity") and isinstance(start_val, (int,float)) and isinstance(end_val, (int,float)):
                    value = float(start_val) * (1-u) + float(end_val) * u
                    if prop.startswith("position."):
                        state["position"] = dict(state["position"])
                        state["position"][prop.split(".")[1]] = value
                    else:
                        state[prop] = value
            pos = state["position"]
            origin = base.get("origin") or {"x": 0, "y": 0}
            if layer.get("kind") == "group":
                dx, dy = float(pos.get("x") or 0), float(pos.get("y") or 0)
            else:
                original = base.get("originalPosition") or {"x": 0, "y": 0}
                dx = float(pos.get("x") or 0) - float(original.get("x") or 0)
                dy = float(pos.get("y") or 0) - float(original.get("y") or 0)
            c.translate(dx, dy)
            if state["rotation"] or state["scale"] != 1:
                ox, oy = float(origin.get("x") or 0), float(origin.get("y") or 0)
                c.translate(ox, oy)
                c.rotate(state["rotation"])
                c.scale(state["scale"], state["scale"])
                c.translate(-ox, -oy)
            alpha *= max(0.0, min(1.0, state["opacity"]))
        entry = self.entrance
        kind = entry.get("type") or "none"
        start = float(entry.get("startS") or 0)
        dur = max(0.001, float(entry.get("durationS") or 0.35))
        if start <= t < start + dur:
            u = max(0.0, min(1.0, (t-start)/dur))
            if kind in ("fade", "reveal"):
                alpha *= u
            elif kind == "slide":
                offset = entry.get("offset") or {"x": 0, "y": 220}
                c.translate(float(offset.get("x") or 0) * (1-u), float(offset.get("y") or 0) * (1-u))
            elif kind == "spring":
                c.scale(0.85 + 0.15 * (1 - (1-u) ** 3), 0.85 + 0.15 * (1 - (1-u) ** 3))
        if self.exit_at is not None and t >= self.exit_at:
            c.restore()
            return
        if alpha > 0:
            layer_saved = alpha < 0.999
            if layer_saved:
                c.saveLayerAlpha(None, int(round(255*alpha)))
            self.inner.draw(c, res, t)
            if layer_saved:
                c.restore()
        c.restore()


class _FragmentItem(Item):
    """Actual compositing of approved custom component Items into a host scene."""
    def __init__(self, items):
        self.children = [item for item in items if item.z > -9999]
        if not self.children:
            raise ValueError("registered component produced no drawable items")
        super().__init__(t_in=min(item.t_in for item in self.children), t_out=None,
                         z=min(item.z for item in self.children), sfx=False)

    def bounds(self, res):
        return None

    def cues(self):
        result = []
        for item in self.children:
            for cue in item.cues():
                result.append(cue)
        return result

    def draw(self, c, res, t):
        for item in sorted(self.children, key=lambda x: x.z):
            if t >= item.t_in and (item.t_out is None or t < item.t_out):
                item.draw(c, res, t)


class _EnvironmentShape(Item):
    """A specifically planned visual surface, not a stock world or fallback artwork."""
    def __init__(self, shape, palette):
        super().__init__(t_in=float(shape.get("startS") or -100000), t_out=shape.get("endS"),
                         z=int(shape.get("z") if shape.get("z") is not None else -700), sfx=False)
        self.shape, self.palette = shape, palette

    def bounds(self, res):
        return None

    def draw(self, c, res, t):
        s = self.shape
        kind = s.get("kind")
        pos, size = s.get("position") or {}, s.get("size") or {}
        x, y = float(pos.get("x") or 0), float(pos.get("y") or 0)
        w, h = float(size.get("width") or 0), float(size.get("height") or 0)
        fill = s.get("fill") or "muted"
        rgb = self.palette.get(fill) if fill in self.palette else hexrgb(fill)
        if rgb is None:
            return
        p = paint(rgb, float(s.get("opacity") if s.get("opacity") is not None else 1),
                  blur=float(s.get("blur") or 0))
        c.save()
        # Environment points are world-space by default, unlike local
        # rectangle/circle geometry. Older explicitly local shapes can opt in
        # with pointsSpace="local". Keep framing and drawing consistent.
        has_world_points = kind in ("line", "path") and s.get("pointsSpace", "world") == "world"
        if not has_world_points:
            c.translate(x, y)
        c.rotate(float(s.get("rotation") or 0))
        if kind in ("rect", "rrect", "surface"):
            c.drawRRect(rrect(-w/2, -h/2, w, h, float(s.get("radius") or 0)), p)
        elif kind == "circle":
            c.drawCircle(0, 0, float(s.get("radius") or w/2), p)
        elif kind in ("line", "path"):
            # Multiple strokes may be encoded as explicit segments, nested
            # point lists, or paired endpoints. A repeated shared origin
            # (perspective rays) and separate parallel two-point rows (grid)
            # are paired strokes, not a single zigzag/polyline.
            pts = s.get("points") or []
            segments = s.get("segments") or []
            if not segments and pts and isinstance(pts[0], (list, tuple)):
                if pts[0] and isinstance(pts[0][0], (list, tuple)):
                    segments = pts
                else:
                    paired = s.get("segmentMode") == "pairs"
                    if not paired and len(pts) >= 4 and len(pts) % 2 == 0:
                        origins = [tuple(pts[i]) for i in range(0, len(pts), 2)]
                        shared_origin = len(set(origins)) == 1
                        parallel_rows = (
                            all(abs(float(pts[i][1]) - float(pts[i+1][1])) < 0.001
                                for i in range(0, len(pts), 2))
                            and len(set(float(pts[i][1]) for i in range(0, len(pts), 2))) > 1
                        )
                        paired = shared_origin or parallel_rows
                    if paired:
                        segments = [pts[i:i+2] for i in range(0, len(pts), 2)]
                    else:
                        segments = [pts]
            p.setStyle(skia.Paint.Style.kStroke_Style)
            p.setStrokeWidth(float(s.get("strokeWidth") or 6))
            path = skia.Path()
            drawn = False
            for segment in segments:
                if len(segment) < 2:
                    continue
                path.moveTo(float(segment[0][0]), float(segment[0][1]))
                for pt in segment[1:]:
                    path.lineTo(float(pt[0]), float(pt[1]))
                drawn = True
            if drawn:
                c.drawPath(path, p)
            elif kind == "line":
                c.drawLine(0, 0, w, h, p)
        c.restore()
'''


def _timed(anim: dict, spec: dict) -> dict:
    return {**anim, "startS": frames_to_s(spec, anim.get("startFrame") or 0),
            "endS": frames_to_s(spec, anim.get("endFrame") or 0)}


def object_layers(spec: dict) -> dict[str, list[dict]]:
    """Resolve each object's group ancestry and keyframes; reject circular/ambiguous groups."""
    objects = {**(spec.get("objects") or {}), **(spec.get("typography") or {})}
    animations = defaultdict(list)
    for a in (spec.get("animation") or {}).values():
        animations[a.get("targetId")].append(_timed(a, spec))
    parents: dict[str, str] = {}
    for gid, group in objects.items():
        if group.get("kind") != "group":
            continue
        for mid in group.get("memberIds") or []:
            if mid in parents:
                raise ValueError(f"object {mid}: multiple layout parents")
            parents[mid] = gid
    layers: dict[str, list[dict]] = {}
    for oid, obj in objects.items():
        if obj.get("kind") in ("group", "effect"):
            continue
        lineage, seen, current = [], set(), oid
        while current in parents:
            current = parents[current]
            if current in seen:
                raise ValueError(f"cyclic layout group at {current}")
            seen.add(current)
            group = objects[current]
            lineage.append({"kind": "group", "base": {
                "position": group.get("position") or {"x": 0, "y": 0},
                "scale": group.get("scale") or 1,
                "rotation": group.get("rotation") or 0,
                "opacity": group.get("opacity") if group.get("opacity") is not None else 1,
                "origin": group.get("origin") or {"x": 0, "y": 0},
            }, "animations": animations[current]})
        base = {"position": obj.get("position") or {"x": 0, "y": 0},
                # Built-in items already draw at their authored coordinates; a custom
                # component fragment defines its own local scene, so its placement
                # is an actual translation from that fragment\u0027s local origin.
                "originalPosition": ({"x": 0, "y": 0} if obj.get("kind") == "extension"
                                     else obj.get("position") or {"x": 0, "y": 0}),
                "origin": obj.get("position") or {"x": 0, "y": 0},
                "scale": obj.get("scale") or 1, "rotation": 0, "opacity": 1}
        layers[oid] = list(reversed(lineage)) + [{"kind": "object", "base": base,
                                                  "animations": animations[oid]}]
    return layers


def artwork(spec: dict) -> list[dict]:
    """Use ONLY model-authored environment geometry, with bounded repetitions."""
    result = []
    for eid, env in (spec.get("environments") or {}).items():
        backdrop = env.get("backdrop") or {}
        elements = (backdrop.get("elements") or []) + (env.get("geometry") or [])
        for s in elements:
            if not isinstance(s, dict):
                raise ValueError(f"environment {eid}: geometry must be objects")
            count = int((s.get("repeat") or {}).get("count") or 1)
            if count < 1 or count > 100:
                raise ValueError(f"environment {eid}: invalid repeat count")
            delta = (s.get("repeat") or {}).get("offset") or {}
            for n in range(count):
                clone = {**s, "position": {**(s.get("position") or {})}}
                clone["position"]["x"] = float(clone["position"].get("x") or 0) + n * float(delta.get("x") or 0)
                clone["position"]["y"] = float(clone["position"].get("y") or 0) + n * float(delta.get("y") or 0)
                result.append(clone)
                if len(result) > 600:
                    raise ValueError("environment artwork exceeds the 600-shape limit")
    return result
