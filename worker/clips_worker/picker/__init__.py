"""Multi-pass talking-mode clip picker."""
from __future__ import annotations

from typing import Any

from clips_worker.picker.cleanup import finalize_picks
from clips_worker.picker.config import length_bucket
from clips_worker.picker.log_util import picker_info
from clips_worker.picker.pass1 import find_moments
from clips_worker.picker.pass2 import score_moments
from clips_worker.picker.sentences import build_sentences
from clips_worker.picker.signals import compute_signals
from clips_worker.picker.titles import ensure_clip_title


def _slice_words(words: list[dict], range_start_ms: int, range_end_ms: int) -> list[dict]:
    return [w for w in words if w["e"] * 1000 >= range_start_ms and w["s"] * 1000 <= range_end_ms]


def pick_talking_clips(
    words: list[dict],
    audio_path: str,
    settings: dict[str, Any],
    range_start_ms: int,
    range_end_ms: int,
) -> tuple[list[dict], str | None]:
    """Return (picks, user_message). user_message is set when no clips could be produced."""
    if settings.get("mode") == "captions":
        end = min(range_end_ms, range_start_ms + 180_000)
        return (
            [
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
            ],
            None,
        )

    genre = settings.get("genre", "podcast")
    prompt = (settings.get("prompt") or "").strip()
    source_ms = max(1, range_end_ms - range_start_ms)
    clip_length = settings.get("clipLength") or settings.get("clip_length") or "auto"
    bucket = length_bucket(clip_length, genre)
    bucket_max = int(bucket.get("max_ms", 60_000))
    if clip_length == "auto" or clip_length == "Auto":
        bucket_max = min(bucket_max, source_ms)

    picker_info(
        "picker_start",
        words_in=len(words),
        range_start_ms=range_start_ms,
        range_end_ms=range_end_ms,
        source_duration_ms=source_ms,
        genre=genre,
        clip_length=clip_length,
        length_max_ms=bucket_max,
    )

    range_words = _slice_words(words, range_start_ms, range_end_ms)
    sentences = build_sentences(words, range_start_ms, range_end_ms)
    picker_info("sentences_built", count=len(sentences))
    if not sentences:
        return [], "No transcript in the selected time range."

    signals = compute_signals(sentences, audio_path, sentences)
    sig_by = {s.sentence_idx: s for s in signals}

    moments = find_moments(sentences, signals, genre, prompt)
    if not moments:
        moments = [
            {
                "start_sentence": 0,
                "end_sentence": min(len(sentences) - 1, max(3, len(sentences) // 2)),
                "why": "fallback_full_span",
                "archetype": "story",
            }
        ]
        picker_info("pass1_fallback_span", end_sentence=moments[0]["end_sentence"])

    source_duration_s = source_ms / 1000.0
    scored, _pass2_audit = score_moments(
        moments, sentences, signals, genre, source_duration_s=source_duration_s
    )
    picks = finalize_picks(
        scored, sentences, sig_by, range_words, range_start_ms, range_end_ms, genre
    )
    picker_info("after_finalize", count=len(picks))

    if not picks:
        msg = "No complete, self-contained moments found in this segment."
        picker_info("picker_empty", message=msg)
        return [], msg

    for p in picks:
        ensure_clip_title(p, words, genre)
        ss, es = p["start_sentence"], p["end_sentence"]
        p["aiMeta"] = {
            "hook": p.get("hook"),
            "archetype": p.get("archetype"),
            "pass1_why": p.get("pass1_why"),
            "score_detail": p.get("score_detail"),
            "scoring": p.get("scoring"),
            "signals": [
                {"sentence": k, **vars(sig_by[sentences[k].idx])}
                for k in range(ss, es + 1)
                if k < len(sentences) and sentences[k].idx in sig_by
            ],
            "low_confidence": p.get("low_confidence", False),
        }
        p["scores"] = p.get("scores") or {}
    picker_info("picker_done", selected=len(picks))
    return picks, None
