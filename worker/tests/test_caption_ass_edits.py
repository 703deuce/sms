from pathlib import Path

from clips_worker.captions_ass import build_ass
from clips_worker.preview_edits_match import preview_export_matches
from clips_worker.edits_render import default_edits


def test_build_ass_honors_case_position_and_wpl(tmp_path: Path):
    ass = tmp_path / "t.ass"
    words = [{"w": "hello", "s": 0.0, "e": 1.0, "idx": 0}]
    build_ass(
        words,
        {
            "presetId": "bold_pop",
            "case": "sentence",
            "position": "top",
            "wordsPerLine": 3,
            "size": 1,
            "animation": "pop",
        },
        ass,
        play_w=1080,
        play_h=1920,
    )
    body = ass.read_text(encoding="utf-8")
    assert ",8," in body.split("Style: Cap")[1][:120]
    assert "Hello" in body


def test_preview_reuse_false_when_captions_differ():
    edits = default_edits(0, 60_000)
    edits = {
        **edits,
        "captions": {
            **edits["captions"],
            "case": "sentence",
            "position": "top",
            "wordsPerLine": 3,
        },
    }
    assert not preview_export_matches(edits, 0, 60_000)
