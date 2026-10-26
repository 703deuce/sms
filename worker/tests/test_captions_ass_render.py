"""Render gray plate + ASS; assert caption scale and boxed yellow pixels."""
from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

from clips_worker.captions_ass import build_ass

SAMPLE = [
    {"w": "CLIP", "s": 0.0, "e": 0.5, "spk": 0, "i": 0},
    {"w": "THIS", "s": 0.5, "e": 1.0, "spk": 0, "i": 1},
    {"w": "NOW", "s": 1.0, "e": 1.5, "spk": 0, "i": 2},
]


def _render_ass(preset_id: str, ass_path: Path, out_mp4: Path) -> None:
    build_ass(SAMPLE, {"presetId": preset_id, "size": 6.5}, ass_path, play_w=720, play_h=1280)
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
            "color=c=gray:s=720x1280:d=3",
            "-vf",
            vf,
            "-t",
            "3",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            str(out_mp4),
        ],
    )


def _is_caption_pixel(p: tuple[int, int, int]) -> bool:
    r, g, b = p
    # gray plate ~128; captions are white/yellow/black strokes
    if max(r, g, b) > 210:
        return True
    if min(r, g, b) < 45:
        return True
    if r >= 214 and g >= 204 and b <= 40:
        return True
    return False


def _caption_bbox_height(frame_path: Path) -> int:
    im = Image.open(frame_path).convert("RGB")
    w, h = im.size
    crop = im.crop((0, int(h * 0.55), w, h))
    px = list(crop.getdata())
    ys = [i // crop.size[0] for i, p in enumerate(px) if _is_caption_pixel(p)]
    return max(ys) - min(ys) + 1 if ys else 0


def _yellow_pixels(frame_path: Path) -> int:
    im = Image.open(frame_path).convert("RGB")
    count = 0
    for r, g, b in im.getdata():
        if r >= 214 and g >= 204 and b <= 40:
            count += 1
    return count


def _extract_frame(mp4: Path, frame_path: Path, t: float = 0.35) -> None:
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
            str(frame_path),
        ],
    )


def test_caption_render_metrics():
    results: dict[str, object] = {}
    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        for preset in ("bold_pop", "boxed"):
            ass = td_path / f"{preset}.ass"
            mp4 = td_path / f"{preset}.mp4"
            png = td_path / f"{preset}.png"
            _render_ass(preset, ass, mp4)
            _extract_frame(mp4, png, 0.35)
            bbox_h = _caption_bbox_height(png)
            results[f"{preset}_bbox_h"] = bbox_h
            if preset == "boxed":
                results["boxed_yellow_px"] = _yellow_pixels(png)

    bold_h = int(results["bold_pop_bbox_h"])
    assert 35 <= bold_h <= 110, f"bold_pop bbox height {bold_h}px outside 35-110"
    boxed_h = int(results["boxed_bbox_h"])
    assert 60 <= boxed_h <= 110, f"boxed bbox height {boxed_h}px outside 60-110"
    yellow = int(results["boxed_yellow_px"])
    assert yellow > 80, f"boxed yellow pixels {yellow} too low"
    print(json.dumps(results, indent=2))
