"""Sample chat lines for clip overlay (S9)."""
from __future__ import annotations

CHAT_LAG_MS = 1500
MAX_PER_SEC = 4
MAX_CHARS = 80


def sample_chat_for_clip(
    messages: list[dict],
    clip_start_ms: int,
    clip_end_ms: int,
    *,
    lag_ms: int = CHAT_LAG_MS,
) -> list[dict]:
    """Return clip-relative lines [{tMs, user, color, text}]."""
    window_start = clip_start_ms - 5000 - lag_ms
    window_end = clip_end_ms - lag_ms
    bucket: dict[int, list[dict]] = {}
    for msg in messages:
        t = int(msg.get("tMs") or msg.get("timestamp_ms") or 0)
        if t < window_start or t > window_end:
            continue
        rel = t - clip_start_ms
        sec = max(0, rel // 1000)
        row = {
            "tMs": rel,
            "user": str(msg.get("user") or msg.get("author") or "?")[:32],
            "color": str(msg.get("color") or "#FFFFFF"),
            "text": str(msg.get("text") or "")[:MAX_CHARS],
        }
        bucket.setdefault(sec, []).append(row)
    out: list[dict] = []
    for sec in sorted(bucket.keys()):
        rows = bucket[sec]
        if len(rows) > MAX_PER_SEC:
            step = max(1, len(rows) // MAX_PER_SEC)
            rows = rows[::step][:MAX_PER_SEC]
        out.extend(rows)
    return out
