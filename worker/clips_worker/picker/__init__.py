"""Multi-pass talking-mode clip picker (signals → candidates → LLM ×2 → cleanup)."""
from __future__ import annotations

import json
from typing import Any

from clips_worker.picker.candidates import build_candidates
from clips_worker.picker.cleanup import finalize_picks
from clips_worker.picker.pass1 import find_moments
from clips_worker.picker.pass2 import score_moments
from clips_worker.picker.sentences import build_sentences
from clips_worker.picker.signals import compute_signals


def pick_talking_clips(
    words: list[dict],
    audio_path: str,
    settings: dict[str, Any],
    range_start_ms: int,
    range_end_ms: int,
) -> list[dict]:
    if settings.get("mode") == "captions":
        end = min(range_end_ms, range_start_ms + 180_000)
        return [
            {
                "start_ms": range_start_ms,
                "end_ms": end,
                "title": "Full clip",
                "hook": "",
                "reason": "Captions-only mode",
                "score": 80,
                "scores": {"hook": "B", "flow": "B", "value": "B", "trend": "B"},
                "aiMeta": {},
            }
        ]

    genre = settings.get("genre", "podcast")
    prompt = (settings.get("prompt") or "").strip()
    clip_length = settings.get("clipLength", "auto")

    sentences = build_sentences(words, range_start_ms, range_end_ms)
    if not sentences:
        return []

    signals = compute_signals(sentences, audio_path, sentences)
    _ = build_candidates(sentences, clip_length, range_start_ms, range_end_ms)

    moments = find_moments(sentences, signals, genre, prompt)
    if not moments:
        moments = [{"start_sentence": 0, "end_sentence": min(len(sentences) - 1, 3), "why": "fallback"}]

    scored = score_moments(moments, sentences, signals)
    picks = finalize_picks(scored, sentences, words, range_start_ms, range_end_ms)

    sig_by = {s.sentence_idx: s for s in signals}
    for p in picks:
        ss, es = p["start_sentence"], p["end_sentence"]
        p["aiMeta"] = {
            "hook": p.get("hook"),
            "pass1_why": p.get("pass1_why"),
            "score_detail": p.get("score_detail"),
            "signals": [
                {"sentence": k, **vars(sig_by[sentences[k].idx])}
                for k in range(ss, es + 1)
                if k < len(sentences) and sentences[k].idx in sig_by
            ],
            "low_confidence": p.get("low_confidence", False),
        }
        p["scores"] = p.get("scores") or {}
    return picks
