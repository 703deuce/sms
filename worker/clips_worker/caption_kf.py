"""KF-12: caption position / scale keyframes (target ``captions``, output ms). Mirror: caption-keyframes.ts."""
from __future__ import annotations

from clips_worker.motion import find_track, track_value_at


def caption_motion_at(edits: dict | None, output_ms: float) -> dict:
    if not edits:
        return {"xPct": 0.0, "yPct": 0.0, "scalePct": 100.0}
    t = max(0.0, output_ms)
    def v(prop: str, default: float) -> float:
        tr = find_track(edits, "captions", prop)
        return track_value_at(tr, prop, t) if tr else default

    return {"xPct": v("capX", 0.0), "yPct": v("capY", 0.0), "scalePct": v("capScale", 100.0)}


def caption_ass_motion_tags(m: dict, play_w: int, play_h: int, align: int, margin_v: int) -> str:
    x, y, sc = float(m["xPct"]), float(m["yPct"]), float(m["scalePct"])
    if x == 0 and y == 0 and sc == 100:
        return ""
    dx = x / 100.0 * play_w
    dy = -y / 100.0 * play_h
    cx = int(round(play_w / 2 + dx))
    if align == 8:
        cy = int(round(dy + play_h * 0.12))
    elif align == 5:
        cy = int(round(play_h / 2 + dy))
    else:
        cy = int(round(play_h - margin_v + dy))
    sc_i = int(max(50, min(200, round(sc))))
    return f"{{\\an{align}\\pos({cx},{cy})\\fscx{sc_i}\\fscy{sc_i}}}"
