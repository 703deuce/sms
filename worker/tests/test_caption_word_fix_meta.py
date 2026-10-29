from clips_worker.caption_words import build_caption_words


def test_word_fix_meta_maps_by_source_time_on_fallback():
    words = [{"i": 99, "w": "hello", "s": 5.0, "e": 5.4}]
    edits = {
        "trim": {"in": 0, "out": 10_000},
        "cutRanges": [],
        "wordFixes": {"3": "HELLO"},
        "wordFixMeta": {"3": {"s": 5.05, "w": "hello"}},
        "_wordsFallback": True,
    }
    out = build_caption_words(words, edits, words_fallback=True)
    assert len(out) == 1
    assert out[0]["text"] == "HELLO"
