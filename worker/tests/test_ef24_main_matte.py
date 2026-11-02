import json
import subprocess
from pathlib import Path

import pytest

from clips_worker.bg_matte_job import plan_chunks
from clips_worker.main_fx import apply_full_render_matte


def _frame_means(path: Path) -> tuple[tuple[float, float, float], tuple[float, float, float]]:
    out = subprocess.check_output(
        [
            "ffmpeg",
            "-v",
            "error",
            "-i",
            str(path),
            "-vf",
            "scale=320:568",
            "-frames:v",
            "1",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgb24",
            "-",
        ]
    )
    w, h = 320, 568
    mid = w // 2
    left = [0.0, 0.0, 0.0]
    right = [0.0, 0.0, 0.0]
    ln = rn = 0
    for y in range(h):
        for x in range(w):
            i = (y * w + x) * 3
            r, g, b = out[i], out[i + 1], out[i + 2]
            if x < mid:
                left[0] += r
                left[1] += g
                left[2] += b
                ln += 1
            else:
                right[0] += r
                right[1] += g
                right[2] += b
                rn += 1
    return (tuple(v / ln for v in left), tuple(v / rn for v in right))


def test_plan_chunks_45s():
    chunks = plan_chunks(45.0)
    assert len(chunks) == 3
    assert chunks[0][2] == 0.0
    assert all(c[2] == 1.0 for c in chunks[1:])
    assert sum(c[1] for c in chunks) == pytest.approx(45.0, abs=0.01)


def test_apply_full_render_matte_color_and_blur(tmp_path: Path):
    graded = tmp_path / "graded.mp4"
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            "testsrc2=size=320x568:rate=30",
            "-t",
            "2",
            "-pix_fmt",
            "yuv420p",
            str(graded),
        ]
    )
    matte = tmp_path / "matte.mp4"
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            "color=c=white:s=160x568",
            "-f",
            "lavfi",
            "-i",
            "color=c=black:s=160x568",
            "-filter_complex",
            "[0:v][1:v]hstack=inputs=2",
            "-t",
            "2",
            "-pix_fmt",
            "yuv420p",
            str(matte),
        ]
    )
    bgr = {
        "refine": {"feather": 0, "choke": 0},
        "background": {"type": "color", "color": "00ff00"},
    }
    out_color = tmp_path / "out_color.mp4"
    apply_full_render_matte(graded, matte, out_color, {}, bgr)
    in_l, in_r = _frame_means(graded)
    out_l, out_r = _frame_means(out_color)
    assert max(abs(out_l[i] - in_l[i]) for i in range(3)) <= 3
    assert abs(out_r[1] - 255) <= 8
    bgr_blur = {**bgr, "background": {"type": "blur", "amount": 80}}
    out_blur = tmp_path / "out_blur.mp4"
    apply_full_render_matte(graded, matte, out_blur, {}, bgr_blur)
    _, blur_r = _frame_means(out_blur)
    assert max(abs(blur_r[i] - in_r[i]) for i in range(3)) > 5
