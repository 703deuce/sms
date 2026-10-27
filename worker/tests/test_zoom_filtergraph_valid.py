"""FFmpeg accepts zoom filtergraphs (full frame + facecam-only, polish keyframes)."""
import shutil
import subprocess

import pytest

from clips_worker.zoom_render import _scale_factor_expr, build_zoom_keyframes


def _ffmpeg_ok(vf: str) -> None:
    if not shutil.which("ffmpeg"):
        pytest.skip("ffmpeg not installed")
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            "color=c=black:s=1080x1920:d=2",
            "-vf",
            vf,
            "-frames:v",
            "1",
            "-f",
            "null",
            "-",
        ],
    )


def test_scale_expr_flat_is_valid():
    kf = [(0.0, 1.0), (2.0, 1.0)]
    expr = _scale_factor_expr(kf)
    assert expr == "1"
    w, h = 1080, 1920
    _ffmpeg_ok(f"scale=w='trunc(iw*({expr}))':h='trunc(ih*({expr}))':eval=frame,crop={w}:{h}:(iw-{w})/2:(ih-{h})/2")


def test_polish_punch_zoom_vf_full_frame():
    words = [{"s": 0.5, "e": 1.0, "w": "hook", "i": 0}]
    kf = build_zoom_keyframes(words, [0], 5.0, 1.15)
    expr = _scale_factor_expr(kf)
    assert "if(between" in expr
    w, h = 1080, 1920
    vf = (
        f"scale=w='trunc(iw*({expr}))':h='trunc(ih*({expr}))':eval=frame,"
        f"crop={w}:{h}:(iw-{w})/2:(ih-{h})/2"
    )
    _ffmpeg_ok(vf)


def test_polish_punch_zoom_vf_facecam_band():
    words = [{"s": 0.5, "e": 1.0, "w": "hook", "i": 0}]
    kf = build_zoom_keyframes(words, [0], 5.0, 1.15)
    expr = _scale_factor_expr(kf)
    w, h = 1080, 1920
    band_h = max(1, int(h * 0.42))
    rest_h = max(1, h - band_h)
    vf = (
        f"split[full][full2];"
        f"[full]crop={w}:{band_h}:0:0,"
        f"scale=w='trunc(iw*({expr}))':h='trunc(ih*({expr}))':eval=frame,"
        f"crop={w}:{band_h}:(iw-{w})/2:(ih-{band_h})/2[topz];"
        f"[full2]crop={w}:{rest_h}:0:{band_h}[bot];"
        f"[topz][bot]vstack=inputs=2"
    )
    _ffmpeg_ok(vf)
