"""G1c track motion (mirror of new-app lib/clips/editor/track-motion.ts — parity fixture
tests/fixtures/g1c2_parity.json). One transform per overlay track (x / y / scale / crop,
keyframes in OUTPUT ms), baked into each item's `broll:<id>` keyframes so the existing per-item
motion path renders it:  x' = xT + sT·xI/100,  scale' = sT·sI/100,
crop L' = LI + LT·(100 − LI − RI)/100. Exact when at most one input is animated, else sampled.
"""
from __future__ import annotations

import math
import re

from clips_worker.motion import CROP_MIN_VISIBLE, PROP_SPECS, value_at_points

TRACK_MOTION_PROPS = ("x", "y", "scale", "cropL", "cropT", "cropR", "cropB")
MAX_POINTS = 64
_KEY_RE = re.compile(r"^ov\d{1,3}$")


def _js_round(x: float) -> int:
    return int(math.floor(x + 0.5))


def _r2(v: float) -> float:
    r = _js_round(v * 100) / 100
    return int(r) if float(r).is_integer() else r


def _clamp(prop: str, v: float) -> float:
    lo, hi, _ = PROP_SPECS[prop]
    return min(hi, max(lo, v))


def _num(v):
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if math.isfinite(f) else None


def normalize_track_motion(raw) -> list[dict]:
    out: dict[str, dict] = {}
    for r in raw if isinstance(raw, list) else []:
        if not isinstance(r, dict):
            continue
        track = r.get("track")
        if not isinstance(track, str) or not _KEY_RE.match(track):
            continue
        keys: list[dict] = []
        for k in r.get("keys") or []:
            if not isinstance(k, dict):
                continue
            prop = k.get("prop")
            if prop not in TRACK_MOTION_PROPS or any(x["prop"] == prop for x in keys):
                continue
            by_t: dict[int, dict] = {}
            for p in k.get("points") or []:
                if not isinstance(p, dict):
                    continue
                t, v = _num(p.get("tMs")), _num(p.get("v"))
                if t is None or v is None or t < 0:
                    continue
                pt = {"tMs": _js_round(t), "v": _r2(_clamp(prop, v))}
                if p.get("ease") in ("in", "out", "inOut"):
                    pt["ease"] = p["ease"]
                by_t[pt["tMs"]] = pt
            pts = [by_t[t] for t in sorted(by_t)][:MAX_POINTS]
            val = _num(k.get("value")) if k.get("value") is not None else None
            val = None if val is None else _r2(_clamp(prop, val))
            if not pts and (val is None or val == PROP_SPECS[prop][2]):
                continue
            keys.append({"prop": prop, **({"value": val} if val is not None and not pts else {}), "points": pts})
        if keys:
            keys.sort(key=lambda x: TRACK_MOTION_PROPS.index(x["prop"]))
            out[track] = {"track": track, "keys": keys}
    return [out[k] for k in sorted(out)]


def _val_at(s: dict, t: float) -> float:
    if s["points"]:
        return value_at_points(s["points"], t, s["def"])
    return s["value"] if s.get("value") is not None else s["def"]


def _window_points(pts: list[dict], dur: float) -> list[dict]:
    lo, hi = 0, len(pts) - 1
    for i, p in enumerate(pts):
        if p["tMs"] <= 0:
            lo = i
    for i in range(len(pts) - 1, -1, -1):
        if pts[i]["tMs"] >= dur:
            hi = i
    return pts[lo:hi + 1]


def _compose(prop: str, srcs: list[dict], f, dur: float) -> dict | None:
    anim = [bool(s["points"]) for s in srcs]
    n_anim = sum(anim)

    def fix(v: float):
        return _r2(_clamp(prop, v))

    if not n_anim:
        v = fix(f([_val_at(s, 0) for s in srcs]))
        return None if v == PROP_SPECS[prop][2] else {"value": v, "points": []}
    def settle(points: list[dict]):
        return None if all(p["v"] == PROP_SPECS[prop][2] for p in points) else {"points": points}

    if n_anim == 1:
        k = anim.index(True)
        pts = _window_points(srcs[k]["points"], dur)
        out = []
        for p in pts:
            vals = [p["v"] if j == k else _val_at(s, p["tMs"]) for j, s in enumerate(srcs)]
            q = {"tMs": p["tMs"], "v": fix(f(vals))}
            if p.get("ease"):
                q["ease"] = p["ease"]
            out.append(q)
        return settle(out)
    times = {0, dur}
    for s in srcs:
        pts = s["points"]
        for i, p in enumerate(pts):
            if 0 < p["tMs"] < dur:
                times.add(p["tMs"])
            q = pts[i + 1] if i + 1 < len(pts) else None
            if p.get("ease") and q:
                for j in range(1, 4):
                    t = _js_round(p["tMs"] + (q["tMs"] - p["tMs"]) * j / 4)
                    if 0 < t < dur:
                        times.add(t)
    ts = sorted(times)
    if len(ts) > MAX_POINTS:
        step = (len(ts) - 1) / (MAX_POINTS - 1)
        ts = [ts[_js_round(i * step)] for i in range(MAX_POINTS)]
    return settle([{"tMs": t, "v": fix(f([_val_at(s, t) for s in srcs]))} for t in ts])


def apply_track_motion(edits: dict) -> dict:
    if "trackMotion" not in edits:
        return edits
    ms = normalize_track_motion(edits.get("trackMotion"))
    # Baked once: the result carries no trackMotion, so a second derivation pass is a no-op.
    rest = {k: v for k, v in edits.items() if k != "trackMotion"}
    if not ms or not edits.get("broll"):
        return rest
    from clips_worker.tracks import track_id_of

    by = {m["track"]: m for m in ms}
    kf = list(edits.get("keyframes") or [])
    changed = False
    for b in edits["broll"]:
        bid = str(b.get("id"))
        m = by.get(track_id_of(edits, "overlay", bid))
        if not m:
            continue
        start = int(b.get("startMs") or 0)
        dur = int(b.get("endMs") or 0) - start
        target = f"broll:{bid}"

        def item(p: str, _t=target) -> dict:
            k = next((x for x in kf if isinstance(x, dict) and x.get("target") == _t and x.get("prop") == p), None)
            s = {"def": PROP_SPECS[p][2], "points": list((k or {}).get("points") or [])}
            if k and k.get("value") is not None:
                s["value"] = float(k["value"])
            return s

        def trk(p: str, _m=m, _s=start) -> dict:
            k = next((x for x in _m["keys"] if x["prop"] == p), None)
            s = {"def": PROP_SPECS[p][2], "points": [{**pt, "tMs": pt["tMs"] - _s} for pt in (k or {}).get("points") or []]}
            if k and k.get("value") is not None:
                s["value"] = float(k["value"])
            return s

        out: dict[str, dict | None] = {}
        out["x"] = _compose("x", [trk("x"), trk("scale"), item("x")], lambda v: v[0] + v[1] * v[2] / 100, dur)
        out["y"] = _compose("y", [trk("y"), trk("scale"), item("y")], lambda v: v[0] + v[1] * v[2] / 100, dur)
        out["scale"] = _compose("scale", [trk("scale"), item("scale")], lambda v: v[0] * v[1] / 100, dur)

        def crop(own: str, a: str, z: str, tp: str):
            return _compose(own, [trk(tp), item(own), item(a), item(z)], lambda v: v[1] + v[0] * (100 - v[2] - v[3]) / 100, dur)

        out["cropL"] = crop("cropL", "cropL", "cropR", "cropL")
        out["cropR"] = crop("cropR", "cropL", "cropR", "cropR")
        out["cropT"] = crop("cropT", "cropT", "cropB", "cropT")
        out["cropB"] = crop("cropB", "cropT", "cropB", "cropB")
        for a, z in (("cropL", "cropR"), ("cropT", "cropB")):
            A, Z = out.get(a), out.get(z)
            if A and Z and not A["points"] and not Z["points"] and (A.get("value") or 0) + (Z.get("value") or 0) > 100 - CROP_MIN_VISIBLE:
                k = (100 - CROP_MIN_VISIBLE) / ((A.get("value") or 0) + (Z.get("value") or 0))
                A["value"] = _r2((A.get("value") or 0) * k)
                Z["value"] = _r2((Z.get("value") or 0) * k)
        kf = [x for x in kf if not (isinstance(x, dict) and x.get("target") == target and x.get("prop") in out)]
        for p in ("x", "y", "scale", "cropL", "cropR", "cropT", "cropB"):
            r = out[p]
            if r:
                kf.append({"target": target, "prop": p, **({"value": r["value"]} if r.get("value") is not None else {}), "points": r["points"]})
        changed = True
    return {**rest, "keyframes": kf} if changed else rest
