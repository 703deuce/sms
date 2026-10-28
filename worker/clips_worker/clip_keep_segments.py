"""Shared keep-segment logic (matches web keepSegments; drops out-of-range cuts)."""
from __future__ import annotations


def keep_segments(trim_in: int, trim_out: int, cut_ranges: list) -> list[tuple[int, int]]:
    segs: list[tuple[int, int]] = []
    t = int(trim_in)
    hi = int(trim_out)
    for s, e in sorted(cut_ranges, key=lambda x: x[0]):
        s, e = int(s), int(e)
        if e <= t or s >= hi:
            continue
        s = max(s, t)
        e = min(e, hi)
        if e <= s:
            continue
        if s > t:
            segs.append((t, s))
        t = max(t, e)
    if t < hi:
        segs.append((t, hi))
    return [(a, b) for a, b in segs if b - a >= 80]
