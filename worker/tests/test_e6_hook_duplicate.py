from clips_worker.hook_duplicate import hook_text_duplicates_captions


def _w(text, start=0.0, step=0.3):
    return [{"w": t, "s": start + i * step, "e": start + (i + 1) * step} for i, t in enumerate(text.split())]


def test_spoken_first_line_is_duplicate():
    words = _w("Straight up boxing combat applied to MMA is the thing")
    assert hook_text_duplicates_captions("Straight up boxing combat applied to", words, 2200)


def test_editorial_hook_is_not_duplicate():
    words = _w("so we went to the store and bought bread")
    assert not hook_text_duplicates_captions("He never saw it coming", words, 2200)


def test_words_after_window_do_not_count():
    words = _w("um yeah", 0.0) + _w("straight up boxing combat", 10.0)
    assert not hook_text_duplicates_captions("Straight up boxing combat", words, 2200)


def test_punctuation_and_case_ignored():
    words = _w("a good one, honestly")
    assert hook_text_duplicates_captions("A good...", words, 2200)


def test_empty():
    assert not hook_text_duplicates_captions("", _w("a b"), 2200)
    assert not hook_text_duplicates_captions("hello there", [], 2200)
