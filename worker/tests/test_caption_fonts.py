from pathlib import Path

from clips_worker.captions_ass import build_ass, resolve_ass_font_name


def test_default_poppins_ass_font_name():
    name = resolve_ass_font_name({}, {"font": "Poppins"})
    assert name == "Poppins ExtraBold"


def test_anton_font_when_ttf_present():
    name = resolve_ass_font_name({"font": "Anton"}, {"font": "Poppins"})
    font_path = Path(__file__).resolve().parents[1] / "clips_worker" / "v3" / "fonts" / "Anton-Regular.ttf"
    if font_path.is_file():
        assert name == "Anton"
    else:
        assert name == "Poppins ExtraBold"


def test_build_ass_default_font_line(tmp_path: Path):
    ass = tmp_path / "cap.ass"
    build_ass(
        [{"w": "Hi", "s": 0.0, "e": 0.5, "spk": 0}],
        {"presetId": "bold_pop", "enabled": True},
        ass,
        play_w=720,
        play_h=1280,
    )
    text = ass.read_text(encoding="utf-8")
    assert "Style: Cap,Poppins ExtraBold," in text
