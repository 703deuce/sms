from clips_worker.stream_headline_ass import prepare_headline_display


def test_headline_ass_uses_multiline_breaks():
    raw = "This is a longer headline that should wrap across multiple lines"
    display = prepare_headline_display(raw)
    assert r"\N" in display
    assert "WRAP" in display.upper()
