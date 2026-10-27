"""Speaker-change density (collab / diarized words) per second."""
from __future__ import annotations


def speaker_change_signal_per_second(words: list[dict], duration_s: int) -> list[float]:
    if duration_s <= 0 or not words:
        return [0.0] * max(0, duration_s)
    changes = [0.0] * duration_s
    prev = None
    for w in words:
        sp = w.get("speaker") or w.get("sp")
        if sp is None:
            continue
        try:
            sec = int(float(w.get("s", 0)))
        except (TypeError, ValueError):
            continue
        if sec < 0 or sec >= duration_s:
            continue
        if prev is not None and sp != prev:
            changes[sec] += 1.0
            if sec > 0:
                changes[sec - 1] = max(changes[sec - 1], 0.5)
        prev = sp
    peak = max(changes) if changes else 0.0
    if peak <= 0:
        return changes
    return [min(1.0, v / peak) for v in changes]
