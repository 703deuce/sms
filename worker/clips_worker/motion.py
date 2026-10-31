"""E3 keyframes + transitions: shared math (mirror of new-app lib/clips/editor/{keyframes,transitions}.ts)
and the ffmpeg expression / filter builders that render it.

Parity: tests/fixtures/motion_parity.json is asserted by vitest (tests/motion-parity.test.ts) and pytest
(tests/test_motion.py); the ffmpeg expressions are checked against the same math (tests/test_motion_render.py).
Transition composites are vf_xfade.c (ffmpeg 5.1) re-expressed as layer weights / geometry.
"""
from __future__ import annotations

import math

MOTION_FPS = 30
KEY_PROPS = ("x", "y", "scale", "rotation", "opacity", "volume", "cropL", "cropT", "cropR", "cropB")
CROP_PROPS = ("cropL", "cropT", "cropR", "cropB")
CROP_MIN_VISIBLE = 5.0
# G1a: layers overlapping by less than one 30 fps frame (B-roll 'between' adjacency) do not stack.
STACK_OVERLAP_TOL_MS = 34
PROP_SPECS = {
    "x": (-100.0, 100.0, 0.0),
    "y": (-100.0, 100.0, 0.0),
    "scale": (10.0, 400.0, 100.0),
    "rotation": (-360.0, 360.0, 0.0),
    "opacity": (0.0, 100.0, 100.0),
    "volume": (0.0, 100.0, 100.0),
    # G1a crop edges (% of the layer, in the un-flipped media) — video + B-roll only.
    "cropL": (0.0, 90.0, 0.0),
    "cropT": (0.0, 90.0, 0.0),
    "cropR": (0.0, 90.0, 0.0),
    "cropB": (0.0, 90.0, 0.0),
}
EASES = ("linear", "in", "out", "inOut")
TRANSITION_TYPES = (
    "crossfade", "dip_black", "dip_white",
    "push_left", "push_right", "push_up", "push_down",
    "wipe_left", "wipe_right", "wipe_up", "wipe_down",
    "zoom_in", "zoom_out", "blur",
)
TRANSITION_DEFAULT_MS = 400
TRANSITION_MIN_MS = 100
TRANSITION_MAX_MS = 2000
ZOOM_AMOUNT = 0.5
# xfade transition names present in ffmpeg 5.1 (zoom_in / zoom_out = scale prefilter + fade).
XFADE_NAME = {
    "crossfade": "fade",
    "dip_black": "fadeblack",
    "dip_white": "fadewhite",
    "push_left": "slideleft",
    "push_right": "slideright",
    "push_up": "slideup",
    "push_down": "slidedown",
    "wipe_left": "wipeleft",
    "wipe_right": "wiperight",
    "wipe_up": "wipeup",
    "wipe_down": "wipedown",
    "zoom_in": "fade",
    "zoom_out": "fade",
    "blur": "hblur",
}


# ---------------------------------------------------------------------------
# Keyframes
# ---------------------------------------------------------------------------

def ease_value(ease: str | None, u: float) -> float:
    x = min(1.0, max(0.0, u))
    if ease == "in":
        return x * x
    if ease == "out":
        return x * (2 - x)
    if ease == "inOut":
        return x * x * (3 - 2 * x)
    return x


def value_at_points(points: list[dict], t: float, default: float) -> float:
    n = len(points)
    if not n:
        return default
    if t <= points[0]["tMs"]:
        return float(points[0]["v"])
    if t >= points[-1]["tMs"]:
        return float(points[-1]["v"])
    for a, b in zip(points, points[1:]):
        if t < b["tMs"]:
            span = b["tMs"] - a["tMs"]
            if span <= 0:
                return float(b["v"])
            return a["v"] + (b["v"] - a["v"]) * ease_value(a.get("ease"), (t - a["tMs"]) / span)
    return float(points[-1]["v"])


def _finite(v):
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if math.isfinite(f) else None


def _valid_target(t) -> bool:
    return isinstance(t, str) and (t in ("video", "voice", "music", "text") or (t.startswith("broll:") and len(t) > 6)
                                   or (t.startswith("text:") and len(t) > 5))


def is_media_layer_target(target) -> bool:
    return isinstance(target, str) and (target == "video" or (target.startswith("broll:") and len(target) > 6))


def props_for_target(target: str) -> tuple[str, ...]:
    if target in ("voice", "music"):
        return ("volume",)
    if is_media_layer_target(target):
        return ("x", "y", "scale", "rotation", "opacity") + CROP_PROPS
    return ("x", "y", "scale", "rotation", "opacity")


def normalize_keyframes(raw) -> list[dict]:
    """Defensive copy of edits.keyframes (the web normalizes on save; this guards bad rows)."""
    out: list[dict] = []
    seen: set[str] = set()
    for r in raw if isinstance(raw, list) else []:
        if not isinstance(r, dict):
            continue
        target, prop = r.get("target"), r.get("prop")
        if not _valid_target(target) or prop not in PROP_SPECS or prop not in props_for_target(target):
            continue
        key = f"{target}|{prop}"
        if key in seen:
            continue
        lo, hi, d = PROP_SPECS[prop]
        by_t: dict[int, dict] = {}
        for p in r.get("points") or []:
            if not isinstance(p, dict):
                continue
            t, v = _finite(p.get("tMs")), _finite(p.get("v"))
            if t is None or v is None:
                continue
            pt = {"tMs": int(round(t)), "v": min(hi, max(lo, v))}
            if p.get("ease") in ("in", "out", "inOut"):
                pt["ease"] = p["ease"]
            by_t[pt["tMs"]] = pt
        pts = [by_t[k] for k in sorted(by_t)]
        val = _finite(r.get("value"))
        val = None if val is None else min(hi, max(lo, val))
        if not pts and (val is None or val == d):
            continue
        seen.add(key)
        out.append({"target": target, "prop": prop, **({"value": val} if val is not None else {}), "points": pts})
    return out


def find_track(edits: dict, target: str, prop: str) -> dict | None:
    for k in normalize_keyframes(edits.get("keyframes")):
        if k["target"] == target and k["prop"] == prop:
            return k
    return None


def track_value_at(track: dict | None, prop: str, t: float) -> float:
    d = PROP_SPECS[prop][2]
    if not track:
        return d
    if not track["points"]:
        v = track.get("value")
        return d if v is None else float(v)
    return value_at_points(track["points"], t, d)


def layer_transform_at(edits: dict, target: str, local_ms: float) -> dict:
    return {p: track_value_at(find_track(edits, target, p), p, local_ms) for p in ("x", "y", "scale", "rotation", "opacity")}


def volume_at(edits: dict, target: str, local_ms: float) -> float:
    return track_value_at(find_track(edits, target, "volume"), "volume", local_ms) / 100.0


def has_motion(edits: dict, target: str) -> bool:
    for k in normalize_keyframes(edits.get("keyframes")):
        if k["target"] != target:
            continue
        if k["points"] or (k.get("value") is not None and k["value"] != PROP_SPECS[k["prop"]][2]):
            return True
    return False


# ---------------------------------------------------------------------------
# G1a: crop / flip / stacking order (mirror of new-app lib/clips/editor/layer-props.ts)
# ---------------------------------------------------------------------------

def normalize_layer_props(raw) -> list[dict]:
    """Mirror of normalizeLayerProps(): one row per target, flips on media layers, z on B-roll / text."""
    by_t: dict[str, dict] = {}
    for r in raw if isinstance(raw, list) else []:
        if not isinstance(r, dict) or not _valid_target(r.get("target")):
            continue
        t = r["target"]
        media = is_media_layer_target(t)
        zable = (t.startswith("broll:") and len(t) > 6) or (t.startswith("text:") and len(t) > 5)
        row: dict = {"target": t}
        if media and r.get("flipH") is True:
            row["flipH"] = True
        if media and r.get("flipV") is True:
            row["flipV"] = True
        z = _finite(r.get("z"))
        if zable and z is not None and _js_round(z) != 0:
            row["z"] = _js_round(min(1000.0, max(-1000.0, z)))
        if len(row) > 1:
            by_t[t] = row
    return [by_t[k] for k in sorted(by_t)]


def _js_round(x: float) -> int:
    return int(math.floor(x + 0.5))


def layer_prop(edits: dict, target: str) -> dict:
    for r in normalize_layer_props(edits.get("layerProps")):
        if r["target"] == target:
            return r
    return {}


def layer_flip(edits: dict, target: str) -> tuple[bool, bool]:
    if not is_media_layer_target(target):
        return False, False
    r = layer_prop(edits, target)
    return bool(r.get("flipH")), bool(r.get("flipV"))


def layer_z(edits: dict, target: str) -> int:
    return int(layer_prop(edits, target).get("z") or 0)


def clamp_crop_axis(a: float, b: float) -> tuple[float, float]:
    mx = 100.0 - CROP_MIN_VISIBLE
    aa = min(mx, max(0.0, a))
    bb = min(mx - aa, max(0.0, b))
    return aa, bb


def layer_crop_at(edits: dict, target: str, local_ms: float) -> dict:
    """Effective crop {l,t,r,b} (%) — same clamp as layerCropAt()."""
    if not is_media_layer_target(target):
        return {"l": 0.0, "t": 0.0, "r": 0.0, "b": 0.0}
    v = {p: track_value_at(find_track(edits, target, p), p, local_ms) for p in CROP_PROPS}
    l, r = clamp_crop_axis(v["cropL"], v["cropR"])
    t, b = clamp_crop_axis(v["cropT"], v["cropB"])
    return {"l": l, "t": t, "r": r, "b": b}


def has_crop(edits: dict, target: str) -> bool:
    for p in CROP_PROPS:
        tr = find_track(edits, target, p)
        if tr and (tr["points"] or (tr.get("value") or 0) != 0):
            return True
    return False


def has_layer_fx(edits: dict, target: str) -> bool:
    """Keyframes / static transform / crop, or a flip: the layer needs the motion chain."""
    return has_motion(edits, target) or any(layer_flip(edits, target))


def stack_order(items: list[dict], z_of) -> list[dict]:
    """Mirror of stackOrder(): bottom → top. Time-overlap clusters keep time order; inside a cluster
    (z, startMs, original index)."""
    idx = sorted(enumerate(items), key=lambda p: (p[1]["startMs"], p[0]))
    out: list[dict] = []
    cluster: list[tuple[int, dict]] = []
    cluster_end = -math.inf

    def flush():
        for _i, it in sorted(cluster, key=lambda p: (z_of(p[1]["id"]), p[1]["startMs"], p[0])):
            out.append(it)

    for i, it in idx:
        if cluster and it["startMs"] >= cluster_end - STACK_OVERLAP_TOL_MS:
            flush()
            cluster = []
            cluster_end = -math.inf
        cluster.append((i, it))
        cluster_end = max(cluster_end, it["endMs"])
    if cluster:
        flush()
    return out


def _num(x: float) -> str:
    s = f"{x:.6f}".rstrip("0").rstrip(".")
    return s if s not in ("-0", "") else "0"


def track_expr(track: dict | None, prop: str, *, var: str = "t", origin_s: float = 0.0) -> str:
    """ffmpeg expression (seconds variable `var`) equal to track_value_at(track, prop, (var-origin)*1000)."""
    d = PROP_SPECS[prop][2]
    if not track:
        return _num(d)
    pts = track["points"]
    if not pts:
        v = track.get("value")
        return _num(d if v is None else float(v))
    L = f"({var}-{_num(origin_s)})" if origin_s else var
    if len(pts) == 1:
        return _num(pts[0]["v"])
    # Nested: if(lt(L,t0),v0, if(lt(L,t1), seg0, if(lt(L,t2), seg1, ... vLast)))
    tail = _num(pts[-1]["v"])
    for a, b in reversed(list(zip(pts, pts[1:]))):
        ta, tb = a["tMs"] / 1000.0, b["tMs"] / 1000.0
        if tb - ta <= 0:
            seg = _num(b["v"])
        else:
            u = f"(({L}-{_num(ta)})/{_num(tb - ta)})"
            e = a.get("ease")
            if e == "in":
                f = f"{u}*{u}"
            elif e == "out":
                f = f"{u}*(2-{u})"
            elif e == "inOut":
                f = f"{u}*{u}*(3-2*{u})"
            else:
                f = u
            seg = f"({_num(a['v'])}+({_num(b['v'] - a['v'])})*{f})"
        tail = f"if(lt({L},{_num(tb)}),{seg},{tail})"
    return f"if(lt({L},{_num(pts[0]['tMs'] / 1000.0)}),{_num(pts[0]['v'])},{tail})"


# ---------------------------------------------------------------------------
# Transitions
# ---------------------------------------------------------------------------

def _smoothstep(e0: float, e1: float, x: float) -> float:
    t = min(1.0, max(0.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def transition_frame(ttype: str, q_in: float) -> dict:
    """Same dict shape as transitionFrame() in transitions.ts (geometry in frame fractions)."""
    q = min(1.0, max(0.0, q_in))
    P = 1 - q
    g0 = lambda: {"tx": 0.0, "ty": 0.0, "scale": 1.0, "clip": None}  # noqa: E731
    f = {"wA": P, "wB": q, "wC": 0.0, "color": None, "geometric": False, "a": g0(), "b": g0(), "blurFrac": 0.0}
    if ttype in ("dip_black", "dip_white"):
        s1, s2 = _smoothstep(0.8, 1, P), _smoothstep(0.2, 1, P)
        wa, wb = s1 * P, (1 - s2) * (1 - P)
        f.update(wA=wa, wB=wb, wC=max(0.0, 1 - wa - wb), color="black" if ttype == "dip_black" else "white")
    elif ttype.startswith("push_"):
        f.update(wA=1.0, wB=1.0, geometric=True)
        axis = "tx" if ttype in ("push_left", "push_right") else "ty"
        sign = -1 if ttype in ("push_left", "push_up") else 1
        f["a"][axis] = sign * q
        f["b"][axis] = -sign * P
    elif ttype.startswith("wipe_"):
        f.update(wA=1.0, wB=1.0, geometric=True)
        f["b"]["clip"] = {
            "wipe_left": [0, 0, 0, P],
            "wipe_right": [0, 1 - q, 0, 0],
            "wipe_up": [P, 0, 0, 0],
            "wipe_down": [0, 0, 1 - q, 0],
        }[ttype]
    elif ttype == "zoom_in":
        f["a"]["scale"] = 1 + ZOOM_AMOUNT * q
    elif ttype == "zoom_out":
        f["b"]["scale"] = 1 + ZOOM_AMOUNT * P
    elif ttype == "blur":
        prog = P * 2 if P <= 0.5 else (1 - P) * 2
        f["blurFrac"] = prog / 2
    return f


def normalize_transition_spec(raw) -> dict | None:
    if not isinstance(raw, dict) or raw.get("type") not in TRANSITION_TYPES:
        return None
    d = _finite(raw.get("durMs"))
    d = TRANSITION_DEFAULT_MS if d is None else d
    return {"type": raw["type"], "durMs": int(round(min(TRANSITION_MAX_MS, max(TRANSITION_MIN_MS, d))))}


def _clamp_dur(d: float) -> int:
    return int(min(TRANSITION_MAX_MS, max(TRANSITION_MIN_MS, round(d))))


def _round_half_even_safe(x: float) -> int:
    """JS Math.round (half up) — Python round() is banker's rounding."""
    return int(math.floor(x + 0.5))


def cut_match_tolerance_ms(fps: int = MOTION_FPS) -> float:
    """E3fix2: a transition belongs to a cut when its srcMs is within half an export frame."""
    return 500.0 / float(fps or MOTION_FPS)


def match_transitions_to_cuts(segs: list[tuple[int, int]], trs: list[dict], fps: int = MOTION_FPS) -> dict[int, dict]:
    """Mirror of matchTransitionsToCuts(): cut index k → transition.

    Each transition goes to its NEAREST cut start (segs[k][0], k >= 1; ties → earlier cut) when
    that is within half a frame; each cut keeps its nearest claimant (ties → first in the list).
    Before E3fix2 the match was |srcMs - cut| <= 1 ms, so a web/worker silence-trim edge that
    differed by a few ms dropped the transition silently. Unmatched / duplicate ones are logged.
    """
    tol = cut_match_tolerance_ms(fps)
    cuts = [(k, segs[k][0]) for k in range(1, len(segs))]
    best: dict[int, tuple[float, dict]] = {}
    for tr in trs:
        src = tr["srcMs"]
        if not cuts:
            break
        k, b0 = min(cuts, key=lambda c: (abs(src - c[1]), c[0]))
        delta = abs(src - b0)
        if delta > tol:
            print(
                f"[motion] warning transition_unmatched srcMs={src} type={tr.get('type')} "
                f"nearest_cut_ms={b0} delta_ms={delta} tol_ms={tol:.1f}"
            )
            continue
        cur = best.get(k)
        if cur is None or delta < cur[0]:
            if cur is not None:
                print(f"[motion] warning transition_duplicate srcMs={cur[1]['srcMs']} cut_ms={b0} kept={src}")
            best[k] = (delta, tr)
        else:
            print(f"[motion] warning transition_duplicate srcMs={src} cut_ms={b0} kept={cur[1]['srcMs']}")
    return {k: v[1] for k, v in best.items()}


def cut_transition_windows(segs: list[tuple[int, int]], transitions, fps: int = MOTION_FPS) -> list[dict]:
    """Mirror of cutTransitionWindows(): segs = ordered keep segments (source ms, output order)."""
    trs = []
    for r in transitions if isinstance(transitions, list) else []:
        spec = normalize_transition_spec(r)
        src = _finite((r or {}).get("srcMs")) if isinstance(r, dict) else None
        if spec and src is not None:
            trs.append({**spec, "srcMs": int(round(src))})
    if not trs or len(segs) < 2:
        return []
    starts, acc = [], 0
    for a, b in segs:
        starts.append(acc)
        acc += b - a
    out: list[dict] = []
    last_end = 0
    by_cut = match_transitions_to_cuts(segs, trs, fps)
    for k in range(1, len(segs)):
        a0, a1 = segs[k - 1]
        b0, b1 = segs[k]
        tr = by_cut.get(k)
        if not tr:
            continue
        d = min(_clamp_dur(tr["durMs"]), a1 - a0, b1 - b0)
        if d < TRANSITION_MIN_MS:
            continue
        cut = starts[k]
        frames = max(2, _round_half_even_safe(d * fps / 1000))
        sf = _round_half_even_safe((cut - d / 2) * fps / 1000)
        sf = max(sf, last_end, 0)
        n = frames
        max_end = math.floor((starts[k] + (b1 - b0)) * fps / 1000)
        if sf + n > max_end:
            n = max_end - sf
        if n < 2:
            continue
        last_end = sf + n
        fm = 1000 / fps
        out.append({
            "k": k, "srcMs": b0, "type": tr["type"], "durMs": d, "cutMs": cut,
            "w0Ms": sf * fm, "w1Ms": (sf + n) * fm, "startFrame": sf, "frames": n,
            "aEnd": a1, "bStart": b0,
        })
    return out


def broll_adjacent(a: dict, b: dict, fps: int = MOTION_FPS) -> bool:
    return abs(b["startMs"] - a["endMs"]) <= 1000 / fps + 0.5


def broll_transition_windows(broll, fps: int = MOTION_FPS) -> list[dict]:
    """Mirror of brollTransitionWindows()."""
    items = sorted([b for b in (broll or []) if isinstance(b, dict)], key=lambda b: b["startMs"])
    out: list[dict] = []
    fm = 1000 / fps
    for i, it in enumerate(items):
        ln = it["endMs"] - it["startMs"]
        prev = items[i - 1] if i > 0 else None
        nxt = items[i + 1] if i < len(items) - 1 else None

        def mk(spec: dict, kind: str, at_start: bool, from_id):
            d = min(_clamp_dur(spec["durMs"]), ln / 2)
            if d < TRANSITION_MIN_MS:
                return
            n = max(2, _round_half_even_safe(d * fps / 1000))
            sf = _round_half_even_safe(it["startMs"] * fps / 1000) if at_start else _round_half_even_safe(it["endMs"] * fps / 1000) - n
            out.append({"itemId": it["id"], "kind": kind, "fromId": from_id, "type": spec["type"],
                        "w0Ms": sf * fm, "w1Ms": (sf + n) * fm, "startFrame": sf, "frames": n})

        tin = normalize_transition_spec(it.get("transitionIn"))
        tout = normalize_transition_spec(it.get("transitionOut"))
        if tin:
            between = prev is not None and broll_adjacent(prev, it, fps)
            mk(tin, "between" if between else "in", True, prev["id"] if between else None)
        if tout and not (nxt is not None and broll_adjacent(it, nxt, fps)):
            mk(tout, "out", False, None)
    return out


def broll_visible_end_ms(item: dict, windows: list[dict]) -> float:
    end = float(item["endMs"])
    for w in windows:
        if w["kind"] == "between" and w["fromId"] == item["id"]:
            end = max(end, w["w1Ms"])
    return end


# ---------------------------------------------------------------------------
# ffmpeg builders
# ---------------------------------------------------------------------------

def layer_motion_chain(edits: dict, target: str, *, w: int, h: int, origin_s: float, label_in: str,
                       label_out: str, bg_label: str, cmd_file: str | None, var: str = "t") -> tuple[str, list[str]]:
    """
    Frame-sized layer [label_in] (w x h) transformed exactly like transformCss() and composited onto
    [bg_label]: centre + (x%·W, y%·H) + R(rot, clockwise)·S(scale)·(p − centre), alpha·opacity.
    Opacity is driven per frame by sendcmd (colorchannelmixer has no time expressions in 5.1).
    G1a: crop (media space) → flip → rotate → scale → overlay, the same order as the preview CSS
    (clip-path is element-local; the flip is the last transform function, so it applies first).
    Returns (filter chain, sendcmd tags) — write the cmd file with layer_sendcmd(edits, target, tags, …).
    """
    tr = {p: find_track(edits, target, p) for p in ("x", "y", "scale", "rotation", "opacity")}
    ex = {p: track_expr(tr[p], p, var=var, origin_s=origin_s) for p in tr}
    crop_on = has_crop(edits, target)
    crop_anim = crop_on and any((find_track(edits, target, p) or {}).get("points") for p in CROP_PROPS)
    crop_tag = f"crop_{label_out}"
    cmds: list[str] = []
    blocks: list[str] = []
    cur = label_in

    if crop_on and crop_anim:
        if cmd_file:
            cmds.append(crop_tag)
        blocks.append(f"[{cur}]format=rgba,split=2[{cur}_a][{crop_tag}_mb]")
        mask_parts = [f"[{crop_tag}_mb]format=gray,geq=lum='255'"]
        mask_parts.extend(crop_mask_drawboxes(edits, target, crop_tag, w=w, h=h))
        blocks.append(",".join(mask_parts) + f"[{crop_tag}_m]")
        blocks.append(f"[{cur}_a][{crop_tag}_m]alphamerge[{cur}_c]")
        cur = f"{cur}_c"
    elif crop_on:
        blocks.append(f"[{cur}]format=rgba,{crop_pad_filters(edits, target, w=w, h=h, origin_s=origin_s, var=var, animated=False)}[{cur}_c]")
        cur = f"{cur}_c"

    chain: list[str] = []
    if not crop_on:
        chain.append("format=rgba")
    fh, fv = layer_flip(edits, target)
    if fh:
        chain.append("hflip")
    if fv:
        chain.append("vflip")
    if ex["rotation"] != "0":
        chain.append(
            f"rotate=a='({ex['rotation']})*PI/180':ow='ceil(hypot(iw,ih)/2)*2':oh=ow:c=black@0"
        )
    if ex["scale"] != "100":
        chain.append(
            f"scale=w='max(2,trunc(iw*({ex['scale']})/200)*2)':h='max(2,trunc(ih*({ex['scale']})/200)*2)':eval=frame"
        )
    opacity_anim = bool(tr["opacity"] and tr["opacity"].get("points"))
    if ex["opacity"] != "100":
        tag = f"ccm_{label_out}"
        if cmd_file and opacity_anim:
            cmds.append(tag)
        chain.append(f"colorchannelmixer@{tag}=aa={_opacity_at(tr['opacity'], 0, origin_s):.4f}")
    need_sendcmd = bool(cmd_file and cmds)
    if need_sendcmd:
        chain.insert(0, f"sendcmd=f='{cmd_file}'")
    x = f"(W-w)/2+({ex['x']})*W/100" if ex["x"] != "0" else "(W-w)/2"
    y = f"(H-h)/2+({ex['y']})*H/100" if ex["y"] != "0" else "(H-h)/2"
    tail = ",".join(chain) + f"[{label_out}_l]"
    motion = f"[{cur}]" + tail if chain else f"[{cur}]copy[{label_out}_l]"
    if blocks:
        graph = ";".join(blocks) + ";" + motion + f";[{bg_label}][{label_out}_l]overlay=x='{x}':y='{y}':eval=frame:format=auto[{label_out}]"
    else:
        graph = motion + f";[{bg_label}][{label_out}_l]overlay=x='{x}':y='{y}':eval=frame:format=auto[{label_out}]"
    return graph, cmds


def _opacity_at(track: dict | None, t_s: float, origin_s: float) -> float:
    return track_value_at(track, "opacity", (t_s - origin_s) * 1000) / 100.0


def opacity_sendcmd(edits: dict, target: str, tag: str, *, start_s: float, end_s: float, origin_s: float,
                    fps: int = MOTION_FPS) -> str:
    """One `colorchannelmixer aa` command per output frame in [start_s, end_s)."""
    tr = find_track(edits, target, "opacity")
    lines = []
    f0 = int(math.floor(start_s * fps))
    f1 = int(math.ceil(end_s * fps))
    prev = None
    for f in range(f0, f1 + 1):
        t = f / fps
        v = round(_opacity_at(tr, t, origin_s), 4)
        if v == prev:
            continue
        prev = v
        # Slightly before the frame's pts so the command is processed for that frame.
        lines.append(f"{max(0.0, t - 0.0005):.4f} colorchannelmixer@{tag} aa {v};")
    return "\n".join(lines) + "\n"


def crop_px(c: dict, w: int, h: int) -> dict:
    """Crop % → whole pixels of a w x h layer (each edge rounded half up, like the JS port)."""
    return {"l": _js_round(c["l"] * w / 100), "r": _js_round(c["r"] * w / 100),
            "t": _js_round(c["t"] * h / 100), "b": _js_round(c["b"] * h / 100)}


def _crop_pct_expr(edits: dict, target: str, prop: str, *, origin_s: float, var: str) -> str:
    tr = find_track(edits, target, prop)
    if tr and tr.get("points"):
        return track_expr(tr, prop, var=var, origin_s=origin_s)
    v = track_value_at(tr, prop, 0.0)
    return _num(v)


def crop_pad_filters(edits: dict, target: str, *, w: int, h: int, origin_s: float, var: str = "t",
                     animated: bool) -> str:
    """Static crop only: crop visible rect, pad back to w×h with transparent margins."""
    px = crop_px(layer_crop_at(edits, target, 0.0), w, h)
    cw = max(1, w - px["l"] - px["r"])
    ch = max(1, h - px["t"] - px["b"])
    return f"crop={cw}:{ch}:{px['l']}:{px['t']},pad={w}:{h}:{px['l']}:{px['t']}:color=black@0"


def crop_mask_drawboxes(edits: dict, target: str, tag: str, *, w: int, h: int) -> list[str]:
    """Initial drawbox@ tags on a full-white gray mask (black = transparent after alphamerge)."""
    px = crop_px(layer_crop_at(edits, target, 0.0), w, h)
    out = []
    for edge, (xx, yy) in (("l", (px["l"] - w, 0)), ("r", (w - px["r"], 0)), ("t", (0, px["t"] - h)), ("b", (0, h - px["b"]))):
        out.append(f"drawbox@{tag}_{edge}=x={xx}:y={yy}:w={w}:h={h}:color=black:t=fill")
    return out


def layer_sendcmd(edits: dict, target: str, tags: list[str], *, w: int, h: int, start_s: float, end_s: float,
                  origin_s: float, fps: int = MOTION_FPS) -> str:
    """One sendcmd file for animated opacity (ccm) and/or crop mask drawbox x/y positions."""
    by_t: dict[str, list[str]] = {}
    order: list[str] = []
    f0 = int(math.floor(start_s * fps))
    f1 = int(math.ceil(end_s * fps))
    for tag in tags:
        prev = None
        for f in range(f0, f1 + 1):
            t = f / fps
            if tag.startswith("ccm_"):
                v = round(_opacity_at(find_track(edits, target, "opacity"), t, origin_s), 4)
                cur = ("ccm", v)
                parts = [f"colorchannelmixer@{tag} aa {v}"]
            else:
                px = crop_px(layer_crop_at(edits, target, (t - origin_s) * 1000), w, h)
                cur = ("crop", px["l"], px["r"], px["t"], px["b"])
                parts = [f"drawbox@{tag}_l x {px['l'] - w}", f"drawbox@{tag}_r x {w - px['r']}",
                         f"drawbox@{tag}_t y {px['t'] - h}", f"drawbox@{tag}_b y {h - px['b']}"]
            if cur == prev:
                continue
            prev = cur
            key = f"{max(0.0, t - 0.0005):.4f}"
            if key not in by_t:
                by_t[key] = []
                order.append(key)
            by_t[key].extend(parts)
    order.sort(key=float)
    return "".join(f"{k} {', '.join(by_t[k])};\n" for k in order)


def volume_expr(edits: dict, target: str, *, origin_s: float = 0.0) -> str | None:
    """`volume=` expression (eval=frame) for an audio target, or None when it stays at 100 %."""
    tr = find_track(edits, target, "volume")
    if not tr:
        return None
    e = track_expr(tr, "volume", var="t", origin_s=origin_s)
    if e == "100":
        return None
    return f"({e})/100"
