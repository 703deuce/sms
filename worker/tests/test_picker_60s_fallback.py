"""60s talking-head sources must yield at least one clip after finalize fallbacks."""
from __future__ import annotations

from unittest.mock import patch

from clips_worker.picker import pick_talking_clips
from clips_worker.picker.cleanup import finalize_picks, min_pick_duration_ms
from clips_worker.picker.sentences import Sentence, build_sentences


def _words_60s_interview():
    """~138 words over 60s (similar density to test_interview_60s)."""
    words = []
    t = 0.0
    for i in range(138):
        token = f"w{i}." if i % 12 == 11 else f"w{i}"
        words.append({"w": token, "s": t, "e": t + 0.35})
        t += 0.43
    return words


def test_min_pick_duration_60s_source():
    assert min_pick_duration_ms(0, 60_000) == 15_000
    assert min_pick_duration_ms(0, 60_000, relax=True) == 7_500


def test_finalize_60s_keeps_short_snapped_candidates_via_pool():
    words = _words_60s_interview()
    sentences = build_sentences(words, 0, 60_000)
    assert len(sentences) >= 3
    mid = len(sentences) // 3
    scored = [
        {
            "start_sentence": 0,
            "end_sentence": mid,
            "score": 72,
            "final": 7.2,
            "title": "Opening",
            "archetype": "story",
        },
        {
            "start_sentence": mid + 1,
            "end_sentence": min(mid * 2, len(sentences) - 1),
            "score": 68,
            "final": 6.8,
            "title": "Middle",
            "archetype": "story",
        },
    ]
    out = finalize_picks(scored, sentences, {}, words, 0, 60_000, "podcast")
    assert len(out) >= 1
    assert out[0]["end_ms"] > out[0]["start_ms"]


def test_pick_talking_clips_60s_when_pass2_empty():
    words = _words_60s_interview()
    settings = {
        "mode": "talking",
        "genre": "podcast",
        "clipLength": "auto",
    }

    with (
        patch("clips_worker.picker.score_moments", return_value=([], [{"gate_reject": True}])),
        patch("clips_worker.picker.compute_signals", return_value=[]),
        patch(
            "clips_worker.picker.find_moments",
            return_value=[{"start_sentence": 0, "end_sentence": 5, "why": "t", "archetype": "story"}],
        ),
    ):
        picks, msg = pick_talking_clips(words, "", settings, 0, 60_000)

    assert msg is None
    assert 1 <= len(picks) <= 3
    for p in picks:
        assert p["end_ms"] - p["start_ms"] >= 2_500
