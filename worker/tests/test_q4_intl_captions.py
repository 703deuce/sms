"""Q4: intl Noto fonts in worker ASS caption burn path."""
from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from pathlib import Path

import pytest

from clips_worker.caption_intl import ass_font_for_sample
from clips_worker.captions_ass import _ASS_FONT_FILES, build_ass, resolve_ass_font_name

V3 = Path(os.environ.get("SPEAKERCROP_DIR", "/app/v3"))


def test_ass_font_for_sample_arabic_and_japanese():
    assert ass_font_for_sample("مرحبا") == "Noto Sans Arabic"
    assert ass_font_for_sample("こんにちは") == "Noto Sans CJK JP"


def test_resolve_ass_font_name_uses_intl_sample():
    preset = {"font": "Poppins", "primary": "#fff", "active": "#ff0", "activeB": "#ff0", "outline": "#000"}
    arabic = _ASS_FONT_FILES.get("Noto Sans Arabic")
    if not arabic or not arabic.is_file():
        pytest.skip("Noto Sans Arabic not bundled")
    name = resolve_ass_font_name({"_captionSampleText": "مرحبا بالعالم"}, preset)
    assert name == "Noto Sans Arabic"


@pytest.mark.parametrize(
    "text,font",
    [("مرحبا", "Noto Sans Arabic"), ("日本語の字幕", "Noto Sans CJK JP")],
)
def test_build_ass_uses_noto_font_in_style(text, font):
    arabic_font = _ASS_FONT_FILES.get(font)
    if not arabic_font or not arabic_font.is_file():
        pytest.skip(f"{font} not bundled (worker image / intl fonts)")
    cap = {"enabled": True, "presetId": "bold_pop", "wordsPerLine": 4}
    words = [{"w": text, "s": 0.0, "e": 1.5, "i": 0}]
    with tempfile.TemporaryDirectory() as td:
        ass = Path(td) / "cap.ass"
        build_ass(words, cap, ass, play_w=720, play_h=1280)
        body = ass.read_text(encoding="utf-8")
        assert text in body
        assert f"Style: Cap,{font}," in body


@pytest.mark.parametrize(
    "text,font",
    [("مرحبا", "Noto Sans Arabic"), ("日本語", "Noto Sans CJK JP")],
)
def test_ffmpeg_burns_intl_caption_without_error(text, font):
    if not shutil.which("ffmpeg"):
        pytest.skip("ffmpeg not installed")
    font_path = _ASS_FONT_FILES.get(font)
    if not font_path or not font_path.is_file():
        pytest.skip(f"{font} not bundled")
    cap = {"enabled": True, "presetId": "bold_pop", "wordsPerLine": 2}
    words = [{"w": text, "s": 0.0, "e": 1.0, "i": 0}]
    with tempfile.TemporaryDirectory() as td:
        tdp = Path(td)
        ass = tdp / "cap.ass"
        out = tdp / "out.mp4"
        build_ass(words, cap, ass, play_w=720, play_h=1280)
        fontsdir = V3 / "fonts"
        if not fontsdir.is_dir():
            fontsdir = font_path.parent
        vf = f"ass={ass}:fontsdir={fontsdir}".replace(",", r"\,")
        subprocess.check_call(
            [
                "ffmpeg",
                "-y",
                "-v",
                "error",
                "-f",
                "lavfi",
                "-i",
                "color=c=black:s=720x1280:d=1",
                "-vf",
                vf,
                "-frames:v",
                "1",
                str(out),
            ],
        )
        assert out.stat().st_size > 500
