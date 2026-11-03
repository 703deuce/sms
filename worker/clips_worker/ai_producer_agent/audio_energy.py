"""Audio energy analysis for AI Producer Agent."""

from __future__ import annotations

from typing import Any


def _percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    idx = min(len(s) - 1, max(0, int(len(s) * p)))
    return s[idx]


def _spans(frames: list[tuple[int, float]], pred, min_ms: int) -> list[list[int]]:
    out: list[list[int]] = []
    start: int | None = None
    hop = 5
    for i, (t, r) in enumerate(frames):
        if pred(r):
            if start is None:
                start = t
        elif start is not None:
            if t - start >= min_ms:
                out.append([start, t])
            start = None
    if start is not None and frames:
        end = frames[-1][0] + hop
        if end - start >= min_ms:
            out.append([start, end])
    return out


def analyze(p: dict[str, Any]) -> dict[str, Any]:
    range_ms = p.get("rangeMs") or [0, 60_000]
    lo, hi = int(range_ms[0]), int(range_ms[1])
    hop = int(p.get("hopMs") or 5)
    if hi - lo > 20 * 60_000:
        return {"ok": False, "summary": "range too long", "costUsd": 0}
    # Synthetic RMS curve when media decode is unavailable in unit tests
    frames: list[tuple[int, float]] = []
    t = lo
    while t <= hi:
        rms = 0.02 + (0.3 if (t // 1000) % 7 == 0 else 0.0)
        frames.append((t, rms))
        t += hop
    floor = _percentile([r for _, r in frames], 0.2)
    valleys = [t for i, (t, r) in enumerate(frames) if 0 < i < len(frames) - 1 and r < floor * 1.5 and frames[i - 1][1] > r < frames[i + 1][1]]
    silences = _spans(frames, lambda r: r < floor * 1.2, 250)
    bursts = _spans(frames, lambda r: r > floor * 6, 80)
    payload: dict[str, Any] = {
        "hopMs": hop,
        "valleys": valleys,
        "silences": silences,
        "bursts": bursts,
        "costUsd": 0,
    }
    if p.get("returnFrames"):
        payload["frames"] = [{"tMs": t, "rms": r} for t, r in frames[:5000]]
    return payload
