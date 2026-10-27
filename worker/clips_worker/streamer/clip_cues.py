"""Clip-call cues from streamer speech, chat, and viewer clips (Rick reliability batch)."""
from __future__ import annotations

import re

STREAMER_CLIP_PHRASES = (
    r"\bclip that\b",
    r"\bclip this\b",
    r"\bthat'?s a clip\b",
    r"\bclip it\b",
    r"\bclip\s+it\b",
)

CHAT_CLIP_PATTERNS = (
    re.compile(r"!clip\b", re.I),
    re.compile(r"\bclip it\b", re.I),
    re.compile(r"\bclip this\b", re.I),
)


def streamer_clip_cue_seconds(words: list[dict], duration_s: int) -> list[float]:
    """Per-second 0..1 spike when the streamer asks for a clip."""
    if duration_s <= 0:
        return []
    out = [0.0] * duration_s
    tokens: list[tuple[int, str]] = []
    for w in words:
        text = str(w.get("w") or "").strip().lower()
        if not text:
            continue
        sec = int(float(w.get("s", 0)))
        if sec < 0 or sec >= duration_s:
            continue
        tokens.append((sec, text))
    max_window = 6
    for i in range(len(tokens)):
        for win in range(1, min(max_window, len(tokens) - i) + 1):
            sec = tokens[i][0]
            phrase = " ".join(t[1] for t in tokens[i : i + win])
            for pat in STREAMER_CLIP_PHRASES:
                if re.search(pat, phrase):
                    for d in range(-1, 3):
                        j = sec + d
                        if 0 <= j < duration_s:
                            out[j] = max(out[j], 1.0 if d == 0 else 0.85)
                    break
    return out


def chat_clip_cue_seconds(messages: list[dict], duration_s: int, lag_s: int = 6) -> list[float]:
    """Per-second signal from chat !clip / clip it (shifted by lag)."""
    if duration_s <= 0:
        return []
    out = [0.0] * duration_s
    for msg in messages:
        t = int(float(msg.get("t_s", msg.get("t", 0)))) - lag_s
        text = str(msg.get("text") or "")
        if not any(p.search(text) for p in CHAT_CLIP_PATTERNS):
            continue
        if 0 <= t < duration_s:
            out[t] = min(1.0, out[t] + 0.5)
            if t + 1 < duration_s:
                out[t + 1] = max(out[t + 1], 0.7)
    return out


def viewer_clip_cue_seconds(
    viewer_clips: list[dict],
    duration_s: int,
) -> list[float]:
    """Boost seconds where Twitch/Kick viewer clips were created."""
    if duration_s <= 0:
        return []
    out = [0.0] * duration_s
    for vc in viewer_clips:
        start_ms = int(vc.get("vod_offset_ms") or vc.get("startMs") or 0)
        sec = start_ms // 1000
        if 0 <= sec < duration_s:
            out[sec] = 1.0
            for d in (-2, -1, 1, 2):
                i = sec + d
                if 0 <= i < duration_s:
                    out[i] = max(out[i], 0.75)
    return out


def collect_clip_cue_events(
    *,
    words: list[dict],
    duration_s: int,
    chat_messages: list[dict] | None = None,
    viewer_clips: list[dict] | None = None,
) -> list[dict]:
    """Discrete cue events for fusion guaranteed picks."""
    events: list[dict] = []
    speech = streamer_clip_cue_seconds(words, duration_s)
    for sec, v in enumerate(speech):
        if v >= 0.85:
            events.append({"kind": "streamer_call", "sec": sec, "weight": 1.0})
    if chat_messages:
        chat = chat_clip_cue_seconds(chat_messages, duration_s)
        for sec, v in enumerate(chat):
            if v >= 0.5:
                events.append({"kind": "chat_call", "sec": sec, "weight": 0.95})
    if viewer_clips:
        for vc in viewer_clips:
            start_ms = int(vc.get("vod_offset_ms") or vc.get("startMs") or 0)
            events.append({"kind": "viewer_clip", "sec": start_ms // 1000, "weight": 0.9})
    return events
