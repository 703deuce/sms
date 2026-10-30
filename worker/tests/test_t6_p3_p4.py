from clips_worker.caption_render_model import chunk_caption_words
from clips_worker.t6_titles import pick_title_style, title_style
from clips_worker.captions_ass import build_ass


def test_chunk_timing_matches():
    words = [{"w": "a", "s": 0.0, "e": 0.2}, {"w": "b", "s": 0.2, "e": 0.4}]
    chunks = chunk_caption_words(words, {"wordsPerChunk": 2, "maxLines": 1})
    assert len(chunks) == 1
    assert chunks[0]["words"][0]["text"] == "a"


def test_pick_title_style_blur():
    style, _reason = pick_title_style({"bands": [{"fill": "blur"}]}, {"bands": {"top": {"luma": 0.3, "busy": 0.6}}}, [])
    assert style == "white_box_black"
    assert title_style(style)["font"] == "Anton"


def test_cp_preset_ass_builds(tmp_path):
    words = [{"w": "HELLO", "s": 0.0, "e": 0.5, "i": 0, "spk": 0}]
    build_ass(words, {"presetId": "cp3"}, tmp_path / "t.ass")
    body = (tmp_path / "t.ass").read_text()
    assert "Dialogue:" in body
