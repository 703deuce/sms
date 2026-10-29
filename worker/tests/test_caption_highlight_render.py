"""Real libass render: highlight active word box centered on line."""
from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path

from PIL import Image

from clips_worker.captions_ass import build_ass

WORDS = [
    {"w": "ONE", "s": 0.0, "e": 0.33, "spk": 0, "i": 0},
    {"w": "TWO", "s": 0.33, "e": 0.66, "spk": 0, "i": 1},
    {"w": "THREE", "s": 0.66, "e": 1.0, "spk": 0, "i": 2},
]


def _render_highlight(out_mp4: Path, ass_path: Path) -> None:
    build_ass(
        WORDS,
        {
            "presetId": "bold_pop",
            "size": 6.5,
            "wordsPerLine": 3,
            "activeStyle": "highlight",
            "highlightColor": "#FFD400",
            "animation": "pop",
        },
        ass_path,
        play_w=720,
        play_h=1280,
    )
    fontsdir = Path(__import__("os").environ.get("SPEAKERCROP_DIR", "/app/v3")) / "fonts"
    vf = f"ass={ass_path}:fontsdir={fontsdir}".replace(",", r"\,")
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
            "-t",
            "1",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            str(out_mp4),
        ],
    )


def _extract_frame(mp4: Path, png: Path, t: float = 0.5) -> None:
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-ss",
            f"{t:.3f}",
            "-i",
            str(mp4),
            "-frames:v",
            "1",
            str(png),
        ],
    )


def _yellow_mask(im: Image.Image) -> list[tuple[int, int]]:
    w, h = im.size
    pts: list[tuple[int, int]] = []
    for y in range(h):
        for x in range(w):
            r, g, b = im.getpixel((x, y))[:3]
            if r >= 214 and g >= 204 and b <= 40:
                pts.append((x, y))
    return pts


def test_caption_highlight_box_centered():
    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        ass = td_path / "h.ass"
        mp4 = td_path / "h.mp4"
        png = td_path / "f.png"
        _render_highlight(mp4, ass)
        _extract_frame(mp4, png, 0.5)
        im = Image.open(png).convert("RGB")
        pts = _yellow_mask(im)
        assert len(pts) > 80, f"expected yellow highlight pixels, got {len(pts)}"
        cx = sum(p[0] for p in pts) / len(pts)
        w = im.size[0]
        assert abs(cx - w / 2) <= w * 0.08, f"yellow centroid {cx} not near center {w/2}"
        left_cut = w * 0.25
        right_cut = w * 0.75
        for x, _y in pts:
            assert left_cut <= x <= right_cut, f"yellow pixel at x={x} outside middle 50%"
