"""Regression: clip ends must not dangle on the next sentence opener."""
from clips_worker.picker.sentences import Sentence, build_sentences
from clips_worker.picker.snap_bounds import snap_bounds


def _words_from_text(parts: list[tuple[str, float, float]]) -> list[dict]:
    out: list[dict] = []
    for i, (w, s, e) in enumerate(parts):
        out.append({"w": w, "s": s, "e": e, "spk": 0, "i": i})
    return out


def test_go_move_clip_does_not_end_on_so_of():
    """Prod clip ended on 'of' after '...entertainment and fun. So of'."""
    parts = [
        ("Go", 0.0, 0.2),
        ("is", 0.2, 0.35),
        ("entertainment", 10.0, 10.4),
        ("and", 10.4, 10.55),
        ("fun.", 10.55, 10.9),
        ("So", 11.0, 11.2),
        ("of", 11.2, 11.35),
        ("course", 11.4, 11.7),
    ]
    words = _words_from_text(parts)
    sentences = build_sentences(words, 0, 20_000)
    clip = {
        "title": "Go move",
        "start_ms": 0,
        "end_ms": int(11.35 * 1000),
        "length_max_ms": 120_000,
    }
    snap_bounds(clip, words, sentences, 0, 20_000)
    last = words[_word_at_ms(words, clip["end_ms"])]
    assert last["w"].rstrip().endswith(".")
    assert last["w"].startswith("fun")


def test_intelligence_clip_does_not_end_on_dangling_i():
    """Prod clip ended on 'I' at the start of the next sentence."""
    parts = [
        ("Intelligence", 0.0, 0.5),
        ("isn't", 0.5, 0.8),
        ("a", 0.8, 0.9),
        ("destination.", 0.9, 1.4),
        ("I", 1.5, 1.55),
        ("think", 1.55, 1.8),
        ("we", 1.8, 2.0),
        ("grow.", 2.0, 2.3),
    ]
    words = _words_from_text(parts)
    sentences = build_sentences(words, 0, 10_000)
    clip = {
        "title": "Intelligence",
        "start_ms": 0,
        "end_ms": int(1.55 * 1000),
        "length_max_ms": 120_000,
    }
    snap_bounds(clip, words, sentences, 0, 10_000)
    last = words[_word_at_ms(words, clip["end_ms"])]
    assert last["w"].rstrip().endswith(".")
    assert "destination" in last["w"]


def test_start_after_dead_air_does_not_include_silence_pad():
    parts = [
        ("Hello", 0.0, 0.3),
        ("world.", 0.3, 0.7),
        ("Next", 2.0, 2.2),
        ("topic", 2.2, 2.5),
        ("here.", 2.5, 2.9),
    ]
    words = _words_from_text(parts)
    sentences = build_sentences(words, 0, 10_000)
    clip = {
        "title": "Next topic",
        "start_ms": int(1.0 * 1000),
        "end_ms": int(2.9 * 1000),
        "length_max_ms": 120_000,
    }
    snap_bounds(clip, words, sentences, 0, 10_000)
    assert clip["start_ms"] >= int(2.0 * 1000)


def _word_at_ms(words: list[dict], ms: int) -> int:
    t = ms / 1000.0
    for i in range(len(words) - 1, -1, -1):
        if words[i]["s"] <= t:
            return i
    return 0
