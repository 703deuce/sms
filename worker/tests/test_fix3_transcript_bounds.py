"""FIX3: transcript-final clip bounds (video + words must agree)."""
from __future__ import annotations

from clips_worker.picker.sentences import build_sentences
from clips_worker.picker.snap_bounds import snap_bounds


def _words_from_text(parts: list[tuple[str, float, float]]) -> list[dict]:
    out: list[dict] = []
    for i, (w, s, e) in enumerate(parts):
        out.append({"w": w, "s": s, "e": e, "spk": 0, "i": i})
    return out


def _word_at_ms(words: list[dict], ms: int) -> int:
    t = ms / 1000.0
    for i in range(len(words) - 1, -1, -1):
        if words[i]["s"] <= t:
            return i
    return 0


def test_hold_mid_sentence_extends_to_sentence_end():
    """Prod clip_a08e7… ended on 'Hold' after 'Man, still got blasted.' — extend forward to period."""
    parts = [
        ("Man,", 0.0, 0.25),
        ("still", 0.25, 0.45),
        ("got", 0.45, 0.65),
        ("blasted.", 0.65, 1.05),
        ("Hold", 1.15, 1.35),
        ("onto", 1.35, 1.55),
        ("your", 1.55, 1.75),
        ("belts.", 1.75, 2.05),
    ]
    words = _words_from_text(parts)
    sentences = build_sentences(words, 0, 20_000)
    clip = {
        "title": "Try New Things to Find Blessings",
        "start_ms": 0,
        "end_ms": int(1.35 * 1000),
        "length_max_ms": 120_000,
    }
    snap_bounds(clip, words, sentences, 0, 20_000)
    last_idx = _word_at_ms(words, clip["end_ms"])
    last = words[last_idx]
    assert last["w"].rstrip().endswith(".")
    assert "belt" in last["w"].lower()
    assert clip["end_ms"] >= int(1.75 * 1000)


def test_hold_extends_backward_when_no_forward_room():
    """If forward is blocked by length_max, snap to previous sentence end ('blasted.')."""
    parts = [
        ("Man,", 0.0, 0.25),
        ("still", 0.25, 0.45),
        ("got", 0.45, 0.65),
        ("blasted.", 0.65, 1.05),
        ("Hold", 8.0, 8.2),
        ("on.", 8.2, 8.5),
    ]
    words = _words_from_text(parts)
    sentences = build_sentences(words, 0, 20_000)
    clip = {
        "title": "Blessings",
        "start_ms": 0,
        "end_ms": int(8.2 * 1000),
        "length_max_ms": 1500,
    }
    snap_bounds(clip, words, sentences, 0, 20_000)
    last = words[_word_at_ms(words, clip["end_ms"])]
    assert "blasted" in last["w"]
