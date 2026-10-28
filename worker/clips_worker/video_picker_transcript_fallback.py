"""Transcript-only moment stubs when Gemini video watch fails."""
from __future__ import annotations

import re


def transcript_picker_moments(transcript_text: str, duration_s: float, want: int) -> list[dict]:
    """Build spaced candidate moments from timestamped transcript lines."""
    dur = max(1.0, float(duration_s))
    want = max(1, int(want))
    times: list[float] = []
    for m in re.finditer(r"\[t=([0-9]+(?:\.[0-9]+)?)s?\]", transcript_text or ""):
        try:
            times.append(float(m.group(1)))
        except ValueError:
            continue
    if not times:
        step = max(5.0, dur / max(want, 6))
        times = [min(dur - 3, i * step) for i in range(want)]
    else:
        times = sorted(set(times))
    if len(times) < want:
        step = max(8.0, dur / max(want, 6))
        t = 0.0
        while len(times) < want and t < dur - 5:
            times.append(t)
            t += step
        times = sorted(set(times))[: want * 2]
    out: list[dict] = []
    span = max(12.0, min(45.0, dur / max(want, 4)))
    for i, peak in enumerate(times):
        if len(out) >= want:
            break
        if peak >= dur - 3:
            continue
        start = max(0.0, peak - span * 0.35)
        end = min(dur, start + span)
        if end - start < 5:
            start = max(0.0, end - 5)
        out.append(
            {
                "start_s": round(start, 3),
                "end_s": round(end, 3),
                "peak_s": round(min(peak, end - 0.5), 3),
                "hook_s": round(start, 3),
                "score": max(0.35, 0.72 - i * 0.03),
                "what_happened": "Transcript-highlight moment (video picker fallback).",
                "why_it_works": "Fallback from timestamped transcript when vision picker failed.",
                "confidence": 0.45,
                "touches_edge": "none",
                "category": ["talking"],
            }
        )
    return out[:want]
