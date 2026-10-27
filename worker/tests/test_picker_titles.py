from clips_worker.picker.titles import strip_internal_sentence_refs, trim_title


def test_strip_internal_sentence_refs():
    assert strip_internal_sentence_refs("Story (s34-s35) about comics") == "Story about comics"


def test_trim_title_strips_refs():
    assert "(s47)" not in trim_title("Hook (s47) line")
