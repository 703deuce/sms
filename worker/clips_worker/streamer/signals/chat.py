"""Per-second chat activity signal (S5)."""
from __future__ import annotations

import re
import statistics

CHAT_HYPE_TOKENS = (
    "kekw",
    "lul",
    "omegalul",
    "lmao",
    "pogchamp",
    "pog",
    "letsgo",
    "let's go",
    "monkas",
    "clap",
    "!!!",
    "+1",
)

LAUGH_EMOTE_TOKENS = (
    "lul",
    "kekw",
    "omegalul",
    "lmao",
    "rofl",
    "lol",
)

def _emote_laugh_weight(text: str) -> float:
    t = text.lower()
    w = 0.0
    if any(tok in t for tok in LAUGH_EMOTE_TOKENS):
        w += 2.0
    if any(tok in t for tok in CHAT_HYPE_TOKENS):
        w += 1.0
    if re.search(r"\b[wW]\b", text) or re.search(r"\b[Ll]\b", text):
        w += 0.75
    return w


STREAMER_CHAT_LAG_S = 6
ROLLING_S = 300


def _median_mad_z(values: list[float], idx: int, window: int) -> float:
    lo = max(0, idx - window // 2)
    hi = min(len(values), idx + window // 2 + 1)
    window_vals = values[lo:hi]
    if len(window_vals) < 5:
        return 0.0
    med = statistics.median(window_vals)
    devs = [abs(v - med) for v in window_vals]
    mad = statistics.median(devs) or 1e-6
    z = (values[idx] - med) / (1.4826 * mad)
    return max(0.0, min(8.0, z)) / 8.0


def chat_signal_per_second(
    messages: list[dict],
    duration_s: int,
    *,
    lag_s: int = STREAMER_CHAT_LAG_S,
) -> list[float]:
    """Message-rate + hype lexicon spikes, lag-shifted, normalised 0–1."""
    if duration_s <= 0:
        return []
    counts = [0.0] * duration_s
    hype = [0.0] * duration_s
    chatters: dict[int, set[str]] = {i: set() for i in range(duration_s)}

    for msg in messages:
        try:
            t = int(float(msg.get("t_s", msg.get("t", 0))))
        except (TypeError, ValueError):
            continue
        t = max(0, min(duration_s - 1, t - lag_s))
        text = str(msg.get("text") or "").lower()
        user = str(msg.get("user") or msg.get("login") or "")
        counts[t] += 1.0
        if user:
            chatters[t].add(user)
        weight = 1.0 + _emote_laugh_weight(text)
        hype[t] += weight

    unique5 = [0.0] * duration_s
    for i in range(duration_s):
        users: set[str] = set()
        for j in range(max(0, i - 4), i + 1):
            users |= chatters.get(j, set())
        unique5[i] = float(len(users))

    raw = [counts[i] + 0.25 * hype[i] + 0.1 * unique5[i] for i in range(duration_s)]
    return [_median_mad_z(raw, i, ROLLING_S) for i in range(duration_s)]


def chat_baseline_ratio(messages: list[dict], peak_s: int, duration_s: int, lag_s: int = STREAMER_CHAT_LAG_S) -> float:
    """Ratio of local chat rate vs rolling median (for reason chips)."""
    if duration_s <= 0:
        return 0.0
    counts = [0.0] * duration_s
    for msg in messages:
        try:
            t = int(float(msg.get("t_s", msg.get("t", 0))))
        except (TypeError, ValueError):
            continue
        t = max(0, min(duration_s - 1, t - lag_s))
        counts[t] += 1.0
    lo = max(0, peak_s - 30)
    hi = min(duration_s, peak_s + 30)
    window = counts[lo:hi] or [0.0]
    win_mean = sum(window) / len(window)
    med = statistics.median(counts) or 1e-6
    return win_mean / med if med > 0 else 0.0
