"""Batch 2B: all 120 recipes must reach the *real* worker ASS renderer.

This test deliberately uses the shipping libass/ffmpeg path, not browser-only
CSS screenshots. It doesn't rewrite existing golden fixtures.
"""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

import pytest

from clips_worker.caption_presets import PRESETS, resolve_preset
from clips_worker.captions_ass import build_ass

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "new-app/lib/clips/caption-presets.json"
FONTS = ROOT / "worker/v3/fonts/t6"
DESIGNS = [row for row in json.loads(SOURCE.read_text()) if row["slug"].startswith("b2b-")]


def test_recipes_are_shared_by_browser_and_worker():
    assert len(DESIGNS) == 120
    assert len({p["slug"] for p in DESIGNS}) == 120
    for p in DESIGNS:
        id_ = p["slug"].replace("-", "_")
        assert resolve_preset(id_) == p
        assert PRESETS[id_] == p
        assert re.fullmatch(r"#[0-9A-F]{6}", p["primary"])
        assert re.fullmatch(r"#[0-9A-F]{6}", p["active"])


@pytest.mark.parametrize("preset", DESIGNS, ids=lambda p: p["slug"])
def test_each_design_builds_real_worker_ass(preset, tmp_path):
    output = tmp_path / "caption.ass"
    build_ass(
        [{"i": 0, "w": "THOUGHTFUL", "s": 0.0, "e": 0.5},
         {"i": 1, "w": "MOMENTS", "s": 0.5, "e": 1.0}],
        {"presetId": preset["slug"].replace("-", "_")},
        output, play_w=320, play_h=180,
    )
    ass = output.read_text(encoding="utf-8")
    assert "Dialogue:" in ass, preset["slug"]
    assert f"Style: Cap,{preset['font']}," in ass, preset["slug"]
    assert "THOUGHTFUL" in ass or "thoughtful" in ass.lower()
    assert "MOMENTS" in ass or "moments" in ass.lower()


@pytest.mark.parametrize("preset", DESIGNS, ids=lambda p: p["slug"])
def test_each_design_burns_visible_pixels_with_libass(preset, tmp_path):
    ass = tmp_path / "caption.ass"
    png = tmp_path / "caption.png"
    build_ass(
        [{"i": 0, "w": "VISIBLE", "s": 0.0, "e": 1.0}],
        {"presetId": preset["slug"].replace("-", "_")},
        ass, play_w=240, play_h=240,
    )
    command = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-f", "lavfi", "-i", "color=c=black:s=240x240:r=30:d=1",
        "-vf", f"ass={ass}:fontsdir={FONTS}",
        "-frames:v", "1", str(png),
    ]
    subprocess.run(command, check=True, capture_output=True, timeout=30)
    from PIL import Image, ImageChops
    with Image.open(png) as source:
        im = source.convert("RGB")
        background = Image.new("RGB", im.size, (0, 0, 0))
        assert ImageChops.difference(im, background).getbbox(), preset["slug"]


@pytest.mark.parametrize("width,height", [(180, 320), (240, 240), (320, 180)])
@pytest.mark.parametrize("content", [
    "Café Привет مرحبا नमस्ते 日本語 🙂",
    "veryveryveryveryveryveryveryverylongword",
    "مرحبا بالعالم RTL",
])
def test_multiscript_long_word_and_rtl_export_keeps_dialogues(tmp_path, width, height, content):
    output = tmp_path / "unicode.ass"
    build_ass(
        [{"i": 0, "w": content, "s": 0.0, "e": 1.0}],
        {"presetId": "b2b_clean_editorial_1", "wordsPerLine": 2},
        output, play_w=width, play_h=height,
    )
    ass = output.read_text(encoding="utf-8")
    assert "Dialogue:" in ass
    assert content in ass
    assert f"PlayResX: {width}" in ass
    assert f"PlayResY: {height}" in ass
