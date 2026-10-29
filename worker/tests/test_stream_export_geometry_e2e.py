"""End-to-end export vs preview geometry parity (clip A / clip B fixtures)."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

import pytest

from clips_worker.export_compose_geometry import compose_geometry_manifest, export_overlay_layout, preview_overlay_layout
from clips_worker.headline_fit import fit_headline_bold_news_for_box
from clips_worker.stream_headline_ass import format_headline_for_export
from clips_worker.streamer.layout.stream_frame import render_fit_top_stream

FIXTURES = Path(__file__).resolve().parents[2] / "new-app" / "tests" / "fixtures" / "export-dialog-edits"
PLAY_W, PLAY_H = 1080, 1920
TOL_FRAC = 0.02


def _load(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def _within_tol(actual: int, expected: int, play_h: int = PLAY_H) -> bool:
    return abs(actual - expected) <= int(play_h * TOL_FRAC)


def _make_test_src(dest: Path, *, w: int = 1280, h: int = 720, sec: float = 4.0) -> None:
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            f"testsrc=size={w}x{h}:rate=30:duration={sec}",
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-pix_fmt",
            "yuv420p",
            str(dest),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def _frame_image(path: Path, t: float = 3.0):
    out = path.parent / "frame.png"
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-ss",
            f"{t:.3f}",
            "-i",
            str(path),
            "-frames:v",
            "1",
            str(out),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    from PIL import Image

    return Image.open(out).convert("RGB")


@pytest.mark.parametrize("fixture", ["stream_headline_clipA.json", "stream_v3_clipB.json"])
def test_preview_and_export_layout_manifest_match(fixture: str):
    edits = _load(fixture)
    prev = preview_overlay_layout(edits, play_w=PLAY_W, play_h=PLAY_H)
    exp = export_overlay_layout(edits, play_w=PLAY_W, play_h=PLAY_H)
    for key in ("headline_top", "headline_h", "video_y", "video_h", "bottom_y"):
        assert prev[key] == exp[key], f"{fixture} {key} preview/export mismatch"


@pytest.mark.parametrize("fixture", ["stream_headline_clipA.json", "stream_v3_clipB.json"])
def test_compose_geometry_within_preview_tolerance(fixture: str):
    edits = _load(fixture)
    manifest = compose_geometry_manifest(edits, play_w=PLAY_W, play_h=PLAY_H)
    prev = preview_overlay_layout(edits, play_w=PLAY_W, play_h=PLAY_H)
    assert _within_tol(manifest["headline_top"], prev["headline_top"])
    assert _within_tol(manifest["video_y"], prev["video_y"])
    assert _within_tol(manifest["video_h"], prev["video_h"])
    if manifest.get("badge"):
        assert manifest["badge"]["y"] < prev["headline_top"] + prev["headline_h"]


def test_bold_news_headline_fills_width():
    edits = _load("stream_headline_clipA.json")
    tpl = edits["exportTemplate"]
    text = format_headline_for_export(tpl["headlineBar"]["text"])
    box_w = int(PLAY_W * 0.96)
    lay = preview_overlay_layout(edits, play_w=PLAY_W, play_h=PLAY_H)
    lines, font_px = fit_headline_bold_news_for_box(text, box_w, lay["headline_h"])
    assert lines
    assert font_px >= 48
    widest = max(len(ln) * font_px * 0.48 for ln in lines)
    assert widest >= box_w * 0.55


@pytest.mark.parametrize("fixture", ["stream_headline_clipA.json", "stream_v3_clipB.json"])
def test_rendered_frame_band_positions(fixture: str, tmp_path: Path):
    edits = _load(fixture)
    manifest = compose_geometry_manifest(edits, play_w=PLAY_W, play_h=PLAY_H)
    src = tmp_path / "src.mp4"
    out = tmp_path / "out.mp4"
    _make_test_src(src)
    render_fit_top_stream(src, out, edits, play_w=PLAY_W, play_h=PLAY_H)
    assert out.is_file() and out.stat().st_size > 1000
    im = _frame_image(out, 1.0)
    w, h = im.size
    mid_headline_y = manifest["headline_top"] + manifest["headline_h"] // 2
    mid_video_y = manifest["video_y"] + manifest["video_h"] // 2
    hx = w // 2
    headline_px = im.getpixel((hx, int(mid_headline_y * h / PLAY_H)))
    video_px = im.getpixel((hx, int(mid_video_y * h / PLAY_H)))
    assert headline_px != video_px
    if manifest.get("badge"):
        bx = int((manifest["badge"]["x"] + manifest["badge"]["w"] // 2) * w / PLAY_W)
        by = int((manifest["badge"]["y"] + manifest["badge"]["h"] // 2) * h / PLAY_H)
        badge_px = im.getpixel((bx, by))
        assert badge_px[0] > 40 or badge_px[2] > 100
