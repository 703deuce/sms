import subprocess
from pathlib import Path

from clips_worker.brand_render import overlay_image


def _px(video: Path, x: int, y: int) -> tuple[int, int, int]:
    raw = subprocess.check_output(
        [
            "ffmpeg",
            "-v",
            "error",
            "-i",
            str(video),
            "-vf",
            f"crop=1:1:{x}:{y}",
            "-frames:v",
            "1",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgb24",
            "-",
        ]
    )
    return raw[0], raw[1], raw[2]


def test_watermark_lands_at_br_pixel(tmp_path: Path):
    src, wm, out = tmp_path / "s.mp4", tmp_path / "w.png", tmp_path / "o.mp4"
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            "color=black:s=1080x1920:d=1:r=10",
            "-pix_fmt",
            "yuv420p",
            str(src),
        ]
    )
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            "color=red:s=100x100",
            "-frames:v",
            "1",
            str(wm),
        ]
    )
    overlay_image(src, out, wm, "BR", 10, 1.0)
    r, g, b = _px(out, 1002, 1842)
    assert r > 180 and g < 70 and b < 70
    r, g, b = _px(out, 500, 500)
    assert r < 40 and g < 40 and b < 40
    r, g, b = _px(out, 1070, 1910)
    assert r < 40
