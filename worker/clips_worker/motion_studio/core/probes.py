"""Adaptive temporal coverage for design probes and final-resolution QA.

probe_times() must not inspect only six timestamps. Coverage follows the
narration, emphasis, transitions and a duration-adaptive stride, and includes
pairs used for motion-strip inspection.
"""
from __future__ import annotations


def _duration(ctx: dict) -> float:
    try:
        d = float(ctx.get("duration") or 0)
    except (TypeError, ValueError):
        d = 0.0
    return d if d > 0 else 1.0


def _event_times(ctx: dict) -> list[float]:
    duration = _duration(ctx)
    events: list[float] = [0.12, duration * 0.25, duration * 0.5, duration * 0.75, max(0.1, duration - 0.4)]
    for line in ctx.get("lines") or []:
        if not isinstance(line, dict):
            continue
        start = float(line.get("start") or line.get("s") or 0)
        end = float(line.get("end") or line.get("e") or (start + 1.0))
        events.append(min(duration - 0.05, start + 0.12))
        events.append(min(duration - 0.05, start + 0.9))
        mid = (start + end) / 2
        events.append(min(duration - 0.05, mid))
        if line.get("emphasis") or line.get("hit") or line.get("hero"):
            events.append(min(duration - 0.05, start + 0.35))
    scene = ctx.get("scene") or {}
    for blob in (
        ctx.get("transitions"), ctx.get("cues"), ctx.get("emphasisTimes"),
        scene.get("emphasisTimes"), scene.get("events"), scene.get("transitions"),
        (ctx.get("cameraPlan") or {}).get("beats") if isinstance(ctx.get("cameraPlan"), dict) else None,
    ):
        for item in blob or []:
            if isinstance(item, (int, float)):
                events.append(float(item))
            elif isinstance(item, dict):
                for key in ("t", "time", "start", "at", "s", "inS"):
                    if item.get(key) is not None:
                        try:
                            events.append(float(item[key]))
                        except (TypeError, ValueError):
                            pass
                        break
    stride = 1.0 if duration <= 6 else 1.35 if duration <= 12 else 1.75 if duration <= 24 else 2.25
    t = 0.1
    while t < duration:
        events.append(t)
        t += stride
    # Motion-strip pairs: a short delta after each major sample so adjacent
    # frames can be compared for stalled or empty motion.
    extras = [min(duration - 0.05, e + 0.2) for e in events]
    events.extend(extras)
    return events


def _dedupe(times: list[float], duration: float, gap: float = 0.28) -> list[float]:
    out: list[float] = []
    for t in sorted(times):
        t = min(max(0.05, float(t)), max(0.05, duration - 0.05))
        if not out or t - out[-1] >= gap:
            out.append(round(t, 3))
    return out


def probe_times(ctx: dict, cap: int | None = None) -> list[float]:
    """Adaptive timestamps for still probes. Always more than six on a typical scene."""
    duration = _duration(ctx)
    times = _dedupe(_event_times(ctx), duration)
    limit = cap if cap is not None else (28 if duration > 16 else 20 if duration > 8 else 16)
    limit = max(7, limit)
    if len(times) > limit:
        # Keep first, last, and an even sample of the rest so coverage stays even.
        first, last = times[0], times[-1]
        inner = times[1:-1]
        step = max(1, int(round(len(inner) / (limit - 2))))
        times = [first] + inner[::step][: limit - 2] + [last]
        times = _dedupe(times, duration, gap=0.2)
    return times or [round(duration / 2, 3)]


def motion_strip_times(ctx: dict) -> list[tuple[float, float]]:
    """Adjacent pairs for motion-strip inspection."""
    times = probe_times(ctx)
    pairs = []
    for a, b in zip(times, times[1:]):
        if 0.15 <= (b - a) <= 2.5:
            pairs.append((a, b))
    return pairs[:12]


def final_res_times(ctx: dict) -> list[float]:
    """A short set of probes used for typography / thin-line QA at final resolution."""
    duration = _duration(ctx)
    base = [0.2, duration * 0.5, max(0.15, duration - 0.35)]
    for line in (ctx.get("lines") or [])[:4]:
        if isinstance(line, dict):
            base.append(float(line.get("start") or 0) + 0.3)
    return _dedupe(base, duration, gap=0.4)[:6]
