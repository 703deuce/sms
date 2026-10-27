from clips_worker.edits_render import emphasis_indexes_for_zoom


def test_auto_emojis_enables_zoom_emphasis_picks():
    words = [{"w": "hello", "i": 0, "s": 0, "e": 1}]
    idx = emphasis_indexes_for_zoom(words, {"autoEmojis": True, "keywordHighlight": False})
    assert idx == [0]


def test_no_highlight_or_emojis_returns_empty_emphasis():
    words = [{"w": "hello", "i": 0, "s": 0, "e": 1}]
    assert emphasis_indexes_for_zoom(words, {}) == []
