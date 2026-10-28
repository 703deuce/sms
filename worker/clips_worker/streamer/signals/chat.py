"""Per-second chat activity signal (S5) — 5s bins, emote bursts, spike z-scores."""
from __future__ import annotations

import re
import statistics
from dataclasses import dataclass

CHAT_BIN_S = 5
CHAT_SPIKE_Z_THRESHOLD = 0.5

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

CLIP_IT_PATTERNS = re.compile(r"\bclip\s*it\b|\bclipit\b", re.I)


def _emote_burst_weight(text: str) -> float:
    t = text.lower()
    w = 0.0
    if any(tok in t for tok in LAUGH_EMOTE_TOKENS):
        w += 2.0
    if any(tok in t for tok in CHAT_HYPE_TOKENS):
        w += 1.0
    if re.search(r"\b[wW]\b", text) or re.search(r"\b[Ll]\b", text):
        w += 0.75
    if CLIP_IT_PATTERNS.search(text):
        w += 1.25
    return w


STREAMER_CHAT_LAG_S = 6
ROLLING_S = 300


@dataclass(frozen=True)
class ChatBinMetrics:
    bin_count: int
    spike_count: int
    z_bins: list[float]


def _robust_z_series(values: list[float]) -> list[float]:
    if len(values) < 3:
        return [0.0] * len(values)
    med = statistics.median(values)
    mad = statistics.median([abs(v - med) for v in values]) or 1e-6
    out: list[float] = []
    for v in values:
        z = (v - med) / (1.4826 * mad)
        out.append(max(0.0, min(8.0, z)) / 8.0)
    return out


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


def chat_bin_metrics(
    messages: list[dict],
    duration_s: int,
    *,
    lag_s: int = STREAMER_CHAT_LAG_S,
) -> ChatBinMetrics:
    """Messages/sec + emote bursts per 5s bin, with robust z-scores across bins."""
    if duration_s <= 0:
        return ChatBinMetrics(bin_count=0, spike_count=0, z_bins=[])
    n_bins = max(1, (duration_s + CHAT_BIN_S - 1) // CHAT_BIN_S)
    msg_counts = [0.0] * n_bins
    emote = [0.0] * n_bins
    for msg in messages:
        try:
            t = int(float(msg.get("t_s", msg.get("t", 0))))
        except (TypeError, ValueError):
            continue
        t = max(0, min(duration_s - 1, t - lag_s))
        bi = min(n_bins - 1, t // CHAT_BIN_S)
        text = str(msg.get("text") or "")
        msg_counts[bi] += 1.0
        emote[bi] += _emote_burst_weight(text)
    rates = [
        (msg_counts[i] / CHAT_BIN_S) + 0.35 * (emote[i] / CHAT_BIN_S)
        for i in range(n_bins)
    ]
    z_bins = _robust_z_series(rates)
    spikes = sum(1 for z in z_bins if z >= CHAT_SPIKE_Z_THRESHOLD)
    return ChatBinMetrics(bin_count=n_bins, spike_count=spikes, z_bins=z_bins)


def log_clipper_chat(
    *,
    vod_id: str,
    platform: str,
    message_count: int,
    metrics: ChatBinMetrics | None,
    used: bool,
    available: bool | None = None,
    fetch_ms: int | None = None,
) -> None:
    bins = metrics.bin_count if metrics else 0
    spikes = metrics.spike_count if metrics else 0
    avail = available if available is not None else message_count > 0
    extra = f" fetch_ms={fetch_ms}" if fetch_ms is not None else ""
    print(
        f"[clipper:chat] vod={vod_id} available={str(avail).lower()} total={message_count} "
        f"platform={platform} bins={bins} spikes={spikes} used={'true' if used else 'false'}{extra}",
        flush=True,
    )


def chat_signal_per_second(
    messages: list[dict],
    duration_s: int,
    *,
    lag_s: int = STREAMER_CHAT_LAG_S,
) -> list[float]:
    """5s-bin spike curve expanded to 1 Hz, blended with lag-shifted per-second activity."""
    if duration_s <= 0:
        return []
    metrics = chat_bin_metrics(messages, duration_s, lag_s=lag_s)
    n_bins = metrics.bin_count or 1
    z_bins = metrics.z_bins or [0.0]

    counts = [0.0] * duration_s
    hype = [0.0] * duration_s
    chatters: dict[int, set[str]] = {i: set() for i in range(duration_s)}

    for msg in messages:
        try:
            t = int(float(msg.get("t_s", msg.get("t", 0))))
        except (TypeError, ValueError):
            continue
        t = max(0, min(duration_s - 1, t - lag_s))
        text = str(msg.get("text") or "")
        user = str(msg.get("user") or msg.get("login") or "")
        counts[t] += 1.0
        if user:
            chatters[t].add(user)
        hype[t] += 1.0 + _emote_burst_weight(text)

    unique5 = [0.0] * duration_s
    for i in range(duration_s):
        users: set[str] = set()
        for j in range(max(0, i - 4), i + 1):
            users |= chatters.get(j, set())
        unique5[i] = float(len(users))

    raw = [counts[i] + 0.25 * hype[i] + 0.1 * unique5[i] for i in range(duration_s)]
    fine = [_median_mad_z(raw, i, ROLLING_S) for i in range(duration_s)]

    out: list[float] = []
    for i in range(duration_s):
        bi = min(n_bins - 1, i // CHAT_BIN_S)
        bin_z = z_bins[bi] if bi < len(z_bins) else 0.0
        out.append(max(fine[i], bin_z))
    return out


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
