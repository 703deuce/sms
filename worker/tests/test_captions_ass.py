from pathlib import Path
import tempfile

from clips_worker.captions_ass import build_ass, margin_lr_px

SAMPLE = [
    {"w": "one", "s": 0.0, "e": 0.3, "spk": 0, "i": 0},
    {"w": "two", "s": 0.3, "e": 0.6, "spk": 0, "i": 1},
    {"w": "three", "s": 0.6, "e": 0.9, "spk": 1, "i": 2},
    {"w": "four", "s": 0.9, "e": 1.2, "spk": 1, "i": 3},
    {"w": "five", "s": 1.2, "e": 1.5, "spk": 0, "i": 4},
    {"w": "six", "s": 1.5, "e": 1.8, "spk": 0, "i": 5},
]

EXPECTED = {
    "bold_pop": "\\fscx85",
    "clean_white": "One",
    "boxed": "Dialogue: 0",
    "karaoke": "\\kf",
    "minimal": "Style: Cap",
    "neon": "\\blur",
    "bounce": "\\fscy70",
    "typewriter": "\\alpha",
    "slide_up": "\\move",
    "highlighter": "Box",
}


def test_caption_horizontal_margins_scale_with_play_res():
    assert margin_lr_px(720) >= 56
    assert margin_lr_px(1080) >= 86
    with tempfile.TemporaryDirectory() as td:
        ass = Path(td) / "t.ass"
        build_ass(SAMPLE, {"presetId": "clean_white"}, ass, play_w=1080, play_h=1920)
        text = ass.read_text()
        assert f",{margin_lr_px(1080)},{margin_lr_px(1080)}," in text
        assert "WrapStyle: 2" in text


def test_all_presets_ass_tags():
    out_lines = []
    for slug, needle in EXPECTED.items():
        with tempfile.TemporaryDirectory() as td:
            ass = Path(td) / "t.ass"
            build_ass(SAMPLE, {"presetId": slug}, ass)
            text = ass.read_text()
            assert needle in text, f"{slug} missing {needle}"
            out_lines.append(f"{slug}: ok ({needle})")
    print("\n".join(out_lines))
