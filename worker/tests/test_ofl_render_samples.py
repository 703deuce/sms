"""Real libass/FFmpeg font export smoke frames, not font picker screenshots.

Render actual worker captions and editable text/graphics ASS at three frame
ratios using pinned TTFs. Pixel statistics are stable semantic goldens; the
frames are deliberately generated from the production worker builders.
"""
from __future__ import annotations

import subprocess
from pathlib import Path

import pytest
from PIL import Image, ImageChops

from clips_worker.captions_ass import build_ass
from clips_worker.text_items import text_items_ass

RATIOS = [(720, 1280), (960, 960), (1280, 720)]
FONTS = ["Rubik", "Gabarito", "Fira Sans Condensed", "DM Serif Display",
         "Playfair Display", "Caveat", "Space Grotesk", "Space Mono"]
ROOT = Path(__file__).resolve().parents[2]
FONTS_DIR = ROOT / "worker/v3/fonts/t6"


def render_frame(ass: Path, output: Path, width: int, height: int) -> None:
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-f", "lavfi", "-i", f"color=c=black:s={width}x{height}:d=1:r=30",
        "-vf", f"ass={ass}:fontsdir={FONTS_DIR}",
        "-frames:v", "1", str(output),
    ]
    subprocess.run(cmd, check=True, capture_output=True, timeout=45)
    with Image.open(output) as im:
        base = Image.new("RGB", im.size, (0, 0, 0))
        bounds = ImageChops.difference(im.convert("RGB"), base).getbbox()
        assert bounds is not None, f"empty ASS frame: {ass}"
        ink_w, ink_h = bounds[2] - bounds[0], bounds[3] - bounds[1]
        assert ink_w >= 14 and ink_h >= 8, (ass, bounds)
        assert 0 <= bounds[0] < bounds[2] <= width
        assert 0 <= bounds[1] < bounds[3] <= height


@pytest.mark.parametrize("width,height", RATIOS)
@pytest.mark.parametrize("family", FONTS)
def test_real_caption_ass_burn_in_all_ofl_faces(tmp_path, width, height, family):
    ass = tmp_path / "captions.ass"
    build_ass([{"i": 0, "w": "Premium", "s": 0, "e": 0.5},
               {"i": 1, "w": "typography", "s": 0.5, "e": 1.0}],
              {"presetId": "bold_pop", "font": family, "marginVPct": 12}, ass,
              play_w=width, play_h=height)
    text = ass.read_text(encoding="utf-8")
    assert "Style: Cap," + family + "," in text, (family, text[:1200])
    render_frame(ass, tmp_path / "caption.png", width, height)


@pytest.mark.parametrize("width,height", RATIOS)
def test_actual_worker_text_and_motion_ass_burn(tmp_path, width, height):
    edits = {"textItems": [
        {"id": "paired_headline", "text": "A BETTER STORY", "startMs": 0, "endMs": 1000,
         "x": 50, "y": 31, "style": {"font": "DM Serif Display", "size": 120,
            "color": "#FFFFFF", "align": "center", "case": "none"}},
        {"id": "paired_subtitle", "text": "WITH SPACE GROTESK", "startMs": 0, "endMs": 1000,
         "x": 50, "y": 44, "style": {"font": "Space Grotesk", "size": 65,
            "color": "#FDE68A", "align": "center", "case": "none"}},
        {"id": "mg_score", "text": "NEW RECORD", "startMs": 0, "endMs": 1000,
         "x": 50, "y": 69, "style": {"font": "Fira Sans Condensed", "size": 110,
            "color": "#67E8F9", "align": "center", "case": "upper"},
         "anim": {"in": {"type": "pop", "unit": "word", "durMs": 220},
                  "out": {"type": "fade", "unit": "block", "durMs": 210},
                  "loop": {"type": "pulse", "periodMs": 900}}}
    ]}
    result = text_items_ass(edits, w=width, h=height)
    assert result is not None
    for family in ["DM Serif Display", "Space Grotesk", "Fira Sans Condensed"]:
        assert family in result
    ass = tmp_path / "text-motion.ass"
    ass.write_text(result, encoding="utf-8")
    render_frame(ass, tmp_path / "text-motion.png", width, height)
