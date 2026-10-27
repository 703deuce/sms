from clips_worker.caption_keyword_emphasis import auto_caption_emphasis_indexes


def test_auto_emphasis_picks_keyword_per_sentence():
    words = [
        {"w": "The", "s": 0.0, "e": 0.2, "i": 0},
        {"w": "secret", "s": 0.2, "e": 0.5, "i": 1},
        {"w": "works.", "s": 0.5, "e": 0.9, "i": 2},
        {"w": "Sales", "s": 1.0, "e": 1.3, "i": 3},
        {"w": "doubled.", "s": 1.3, "e": 1.7, "i": 4},
    ]
    idx = auto_caption_emphasis_indexes(words, {"captions": {"wordsPerLine": 3}})
    assert 1 in idx
    assert 3 in idx
