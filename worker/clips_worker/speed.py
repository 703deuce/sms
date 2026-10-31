"""E4 per-item speed (mirror of new-app/lib/clips/editor/speed.ts).

Speeds cover SOURCE ms ranges; the export renders the whole clip in edit time and export_post warps
the finished mp4 piecewise (setpts + atempo, pitch preserved) — so captions, overlays, B-roll,
music and SFX, which are already burned / mixed in edit time, stay in sync by construction.
"""
from __future__ import annotations

import math

SPEED_MIN, SPEED_MAX = 0.25, 4.0


def clamp_speed(s) -> float:
    try:
        n = float(s)
    except (TypeError, ValueError):
        return 1.0
    if not math.isfinite(n) or n <= 0:
        return 1.0
    return round(min(SPEED_MAX, max(SPEED_MIN, n)) * 100) / 100


def normalize_segment_speeds(raw) -> list[dict]:
    if not isinstance(raw, list):
        return []
    out = []
    for r in raw:
        if not isinstance(r, dict):
            continue
        try:
            a = round(float(r.get("fromMs")))
            b = round(float(r.get("toMs")))
        except (TypeError, ValueError):
            continue
        s = clamp_speed(r.get("speed"))
        if b <= a or s == 1:
            continue
        out.append({"fromMs": max(0, a), "toMs": b, "speed": s})
    out.sort(key=lambda x: x["fromMs"])
    clean: list[dict] = []
    for s in out:
        if clean and clean[-1]["toMs"] > s["fromMs"]:
            clean[-1]["toMs"] = s["fromMs"]
        if clean and clean[-1]["toMs"] <= clean[-1]["fromMs"]:
            clean.pop()
        clean.append(dict(s))
    return clean[:200]


def speed_at_source(speeds: list[dict], src_ms: float) -> float:
    for s in speeds:
        if s["fromMs"] <= src_ms < s["toMs"]:
            return s["speed"]
    return 1.0


def speed_warp_pieces(segments, speeds: list[dict]) -> list[dict]:
    """Edit-time pieces [{startMs, endMs, speed}] for ordered keep segments (source ms)."""
    out: list[dict] = []
    t = 0

    def push(length: int, speed: float) -> None:
        nonlocal t
        if length <= 0:
            return
        if out and out[-1]["speed"] == speed:
            out[-1]["endMs"] += length
        else:
            out.append({"startMs": t, "endMs": t + length, "speed": speed})
        t += length

    for a, b in segments:
        a, b = int(a), int(b)
        if b <= a:
            continue
        cuts = {a, b}
        for s in speeds:
            if a < s["fromMs"] < b:
                cuts.add(s["fromMs"])
            if a < s["toMs"] < b:
                cuts.add(s["toMs"])
        pts = sorted(cuts)
        for x, y in zip(pts, pts[1:]):
            push(y - x, speed_at_source(speeds, x))
    return out


def has_speed_change(pieces: list[dict]) -> bool:
    return any(p["speed"] != 1 for p in pieces)


def warp_ms(pieces: list[dict], edit_ms: float) -> float:
    real = 0.0
    for p in pieces:
        if edit_ms <= p["startMs"]:
            break
        real += (min(edit_ms, p["endMs"]) - p["startMs"]) / p["speed"]
    if pieces and edit_ms > pieces[-1]["endMs"]:
        real += edit_ms - pieces[-1]["endMs"]
    return real


def warped_duration_ms(pieces: list[dict]) -> float:
    return sum((p["endMs"] - p["startMs"]) / p["speed"] for p in pieces)


def atempo_chain(speed: float) -> list[float]:
    s = float(speed)
    out: list[float] = []
    while s > 2 + 1e-9:
        out.append(2.0)
        s /= 2
    while s < 0.5 - 1e-9:
        out.append(0.5)
        s /= 0.5
    out.append(round(s * 1e6) / 1e6)
    return out


def warp_filtergraph(pieces: list[dict], fps: float, *, has_audio: bool = True) -> tuple[str, str, str | None]:
    """
    filter_complex that splits [0:v]/[0:a] at the piece edges (edit time), retimes each piece and
    concatenates. Returns (graph, video_label, audio_label|None). Pieces cover the whole input; the
    last piece runs to EOF so rounding never drops the tail.
    """
    n = len(pieces)
    parts = [f"[0:v]split={n}" + "".join(f"[vs{i}]" for i in range(n))]
    if has_audio:
        parts.append(f"[0:a]asplit={n}" + "".join(f"[as{i}]" for i in range(n)))
    cat = []
    for i, p in enumerate(pieces):
        a = p["startMs"] / 1000
        b = p["endMs"] / 1000
        rng = f"start={a:.6f}" + (f":end={b:.6f}" if i < n - 1 else "")
        s = p["speed"]
        parts.append(f"[vs{i}]trim={rng},setpts=(PTS-STARTPTS)/{s:.6f}[vp{i}]")
        cat.append(f"[vp{i}]")
        if has_audio:
            tempo = ",".join(f"atempo={f:.6f}" for f in atempo_chain(s)) if s != 1 else "anull"
            parts.append(f"[as{i}]atrim={rng},asetpts=PTS-STARTPTS,{tempo}[ap{i}]")
            cat.append(f"[ap{i}]")
    a_flag = 1 if has_audio else 0
    parts.append("".join(cat) + f"concat=n={n}:v=1:a={a_flag}[wv]" + ("[wa]" if has_audio else ""))
    parts.append(f"[wv]fps={fps:.6f}[wvf]")
    return ";".join(parts), "wvf", ("wa" if has_audio else None)
