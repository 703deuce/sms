from clips_worker.word_cut import cut_splits_word, sanitize_cut_ranges

WORDS = [
    {"s": 0.0, "e": 0.4, "w": "think"},
    {"s": 0.6, "e": 0.8, "w": "um"},
    {"s": 1.0, "e": 1.5, "w": "probably"},
    {"s": 1.6, "e": 2.0, "w": "thursday"},
]


def test_whole_word_cuts_are_kept_exactly():
    # SCRIPT_DOC3: these were rejected before, so the deleted words stayed in the export.
    assert sanitize_cut_ranges([[575, 925]], WORDS) == [[575, 925]]
    assert sanitize_cut_ranges([[600, 1500]], WORDS) == [[600, 1500]]
    assert sanitize_cut_ranges([[533, 1568]], WORDS) == [[533, 1568]]


def test_split_word_goes_to_the_old_snap_path():
    # An edge in the middle half of "probably" (1000-1500) is a real split.
    assert cut_splits_word([700, 1250], WORDS)
    assert not cut_splits_word([575, 925], WORDS)


def test_pause_cut_unchanged():
    assert sanitize_cut_ranges([[420, 580]], WORDS) == [[420, 580]]
