from clips_worker.sw.pdf_melt import PdfLine, classify_line


def test_classify_scene_heading():
    assert classify_line(PdfLine("INT. HOUSE - DAY", 1.5)) == "scene_heading"


def test_classify_character_and_dialogue():
    assert classify_line(PdfLine("JACK", 3.5)) == "character"
    assert classify_line(PdfLine("Hello there.", 2.5)) == "dialogue"
