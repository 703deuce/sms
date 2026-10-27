"""Short sources (<30s) should still allow at least one clip after finalize."""
from clips_worker.picker.cleanup import finalize_picks, min_pick_duration_ms
from clips_worker.picker.sentences import Sentence


def test_min_pick_duration_relaxes_under_30s():
    assert min_pick_duration_ms(0, 25_000) == 15_000
    assert min_pick_duration_ms(0, 12_000) == 12_000
    assert min_pick_duration_ms(0, 60_000) == 15_000


def test_finalize_keeps_clip_on_25s_source():
    sentences = [
        Sentence(
            idx=0,
            start_ms=0,
            end_ms=25_000,
            speaker="A",
            text="hello world",
            word_start=0,
            word_end=1,
        )
    ]
    words = [{"w": "hello", "s": 0.0, "e": 24.0}]
    scored = [
        {
            "start_sentence": 0,
            "end_sentence": 0,
            "score": 80,
            "title": "Short",
            "final": 8.0,
            "archetype": "story",
        }
    ]
    out = finalize_picks(scored, sentences, {}, words, 0, 25_000, "podcast")
    assert len(out) >= 1
    assert out[0]["end_ms"] - out[0]["start_ms"] >= min_pick_duration_ms(0, 25_000)
