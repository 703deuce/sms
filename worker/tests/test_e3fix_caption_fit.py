"""E3fix: burned captions wrap / shrink inside the safe width (WrapStyle 2 never wraps).

Live repro: Ludwig clip, bold_pop + Montserrat Black 6.5% at 1080x1920, 3-word chunk
"Energy, capital, whatever" drew as one ~1115px line on a 1080px frame and was clipped at
both edges ("Energy, capital, whateve").
"""
from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path

import numpy as np
import pytest

from clips_worker.caption_fit import apply_line_scale, fit_caption_line, join_caption_parts, text_width_px
from clips_worker.captions_ass import _ASS_FONT_FILES, build_ass

LUDWIG_CAP = {
    "case": "sentence",
    "size": 6.5,
    "enabled": True,
    "emphasis": [0, 2],
    "position": "bottom",
    "presetId": "bold_pop",
    "animation": "pop",
    "marginVPct": 14,
    "presetConfig": {
        "font": "Montserrat Black",
        "active": "#FFD93D",
        "weight": 900,
        "primary": "#FFFFFF",
        "outlineW": 8,
        "emphasisScale": 1.12,
    },
    "wordsPerLine": 3,
}
LONG = [
    {"w": "Energy,", "s": 0.0, "e": 0.3, "i": 0},
    {"w": "capital,", "s": 0.3, "e": 0.6, "i": 1},
    {"w": "whatever", "s": 0.6, "e": 1.4, "i": 2},
]
SHORT = [
    {"w": "Of", "s": 0.0, "e": 0.2, "i": 10},
    {"w": "forming", "s": 0.2, "e": 0.5, "i": 11},
    {"w": "a", "s": 0.5, "e": 0.7, "i": 12},
]


def _dialogues(ass: Path) -> list[str]:
    return [ln for ln in ass.read_text().splitlines() if ln.startswith("Dialogue:")]


def _build(words: list[dict], cap: dict, play_w: int = 1080, play_h: int = 1920) -> Path:
    d = Path(tempfile.mkdtemp())
    ass = d / "cap.ass"
    build_ass(words, cap, ass, play_w=play_w, play_h=play_h)
    return ass


def test_text_width_matches_repro_overflow():
    # fontsize 125 (6.5% of 1920), Montserrat Black: the repro line is wider than the frame.
    assert text_width_px("Energy, capital, whatever", "Montserrat Black", 125) > 1080
    assert text_width_px("Of forming a", "Montserrat Black", 125) < 700


def test_fit_breaks_long_chunk_and_keeps_short_chunk():
    breaks, scale = fit_caption_line(
        ["Energy,", "capital,", "whatever"], font="Montserrat Black", fontsize=125, max_width_px=972, peak_scale=1.12, pad_px=8
    )
    assert breaks == [2] and scale == 1.0
    breaks, scale = fit_caption_line(
        ["Of", "forming", "a"], font="Montserrat Black", fontsize=125, max_width_px=972, peak_scale=1.12, pad_px=8
    )
    assert breaks == [] and scale == 1.0


def test_fit_shrinks_single_overlong_word():
    breaks, scale = fit_caption_line(
        ["Supercalifragilisticexpialidocious"], font="Montserrat Black", fontsize=125, max_width_px=972, peak_scale=1.12
    )
    assert breaks == [] and 0.4 <= scale < 1.0
    line = apply_line_scale(r"{\fscx112\fscy112}WORD", scale)
    assert line.startswith(r"{\fscx") and r"\fscx112" not in line


def test_join_parts_inserts_hard_break():
    assert join_caption_parts(["a", "b", "c"], [2]) == r"a b\Nc"
    assert join_caption_parts(["a", "b"], []) == "a b"


def test_build_ass_wraps_long_chunk_only():
    long_lines = _dialogues(_build(LONG, LUDWIG_CAP))
    assert long_lines and all(r"\N" in ln for ln in long_lines)
    short_lines = _dialogues(_build(SHORT, LUDWIG_CAP))
    assert short_lines and not any(r"\N" in ln for ln in short_lines)


def test_build_ass_default_bold_pop_720_unchanged_for_short_lines():
    words = [{"w": w, "s": i * 0.4, "e": i * 0.4 + 0.4, "i": i} for i, w in enumerate(["CLIP", "THIS", "NOW"])]
    lines = _dialogues(_build(words, {"presetId": "bold_pop", "size": 6.5}, 720, 1280))
    assert lines and not any(r"\N" in ln or ln.split(",,", 1)[-1].startswith(r"{\fscx") for ln in lines)


@pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not installed")
@pytest.mark.skipif(not _ASS_FONT_FILES["Montserrat Black"].is_file(), reason="Montserrat Black TTF missing")
def test_render_long_chunk_stays_inside_frame():
    ass = _build(LONG, LUDWIG_CAP)
    fontsdir = _ASS_FONT_FILES["Montserrat Black"].parent
    vf = f"ass={ass}:fontsdir={fontsdir}".replace(",", r"\,")
    out = ass.parent / "f.gray"
    for t in ("0.45", "1.0"):
        subprocess.check_call(
            [
                "ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "color=black:s=1080x1920:d=2",
                "-vf", vf, "-ss", t, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "gray", str(out),
            ]
        )
        a = np.fromfile(out, np.uint8).reshape(1920, 1080)
        cols = np.where(a.max(axis=0) > 40)[0]
        assert len(cols), "caption not drawn"
        assert cols.min() >= 40 and cols.max() <= 1080 - 40, (t, cols.min(), cols.max())
