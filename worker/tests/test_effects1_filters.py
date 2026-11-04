"""EFFECTS1: every new effect's ffmpeg chain renders a 2 s synthetic clip without error (ffmpeg 5.1 in
the worker image), and the colour maths match fx-library.ts (preview == export)."""
from __future__ import annotations

import shutil
import subprocess

import pytest

from clips_worker import fx_library as fl
from clips_worker.color_grade import FX2_KEYS as GRADE_FX2_KEYS

W, H = 320, 568
CASES = [
    {"mono": 60},
    {"sepia": 80},
    {"invert": 100},
    {"invert": 40},
    {"mirror": 100},
    {"zoom": 30},
    {"zoom": 30, "mirror": 100, "shake": 50},
    {"mono": 100, "sepia": 50, "invert": 20, "zoom": 10, "glitch": 40},
]


def _run(fx: dict, en: str) -> subprocess.CompletedProcess:
    pre, cur = fl.pre_parts("src", fx, W, H, "t", en)
    sh, cur = fl.shake_parts(cur, fx, W, H, "t", en)
    graph = ";".join(["[0:v]format=gbrp[src]", *pre, *sh, f"[{cur}]format=rgb24[out]"])
    return subprocess.run(
        ["ffmpeg", "-v", "error", "-f", "lavfi", "-i", f"testsrc2=s={W}x{H}:d=2:r=30",
         "-filter_complex", graph, "-map", "[out]", "-f", "null", "-"],
        capture_output=True, text=True, timeout=120,
    )


def test_keys_match_grade_module():
    assert fl.FX2_KEYS == GRADE_FX2_KEYS
    assert fl.FX2_KEYS[-5:] == ("mono", "sepia", "invert", "mirror", "zoom")


def test_matrices():
    assert fl.mono_matrix(100)[:3] == list(fl.LUMA_709)
    assert fl.sepia_matrix(0) == [1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0]
    assert fl.zoom_size(30, W, H) == (368, 654)


@pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not on PATH")
@pytest.mark.parametrize("en", ["", ":enable='gte(t,0.5)*lt(t,1.5)'"])
@pytest.mark.parametrize("fx", CASES)
def test_chain_renders(fx, en):
    r = _run(fx, en)
    assert r.returncode == 0, r.stderr[-800:]


@pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not on PATH")
def test_invert_and_mirror_pixels():
    def px(fx):
        pre, cur = fl.pre_parts("src", fx, 4, 2, "t", "")
        sh, cur = fl.shake_parts(cur, fx, 4, 2, "t", "")
        graph = ";".join(["[0:v]format=gbrp[src]", *pre, *sh, f"[{cur}]format=rgb24[out]"])
        src = ("color=c=0xC83214:s=2x2:d=0.1,format=rgb24[a];color=c=0x1432C8:s=2x2:d=0.1,format=rgb24[b];"
               "[a][b]hstack")
        r = subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", src, "-filter_complex", graph,
                            "-map", "[out]", "-frames:v", "1", "-f", "rawvideo", "-"], capture_output=True, timeout=60)
        assert r.returncode == 0, r.stderr
        return list(r.stdout[:3]), list(r.stdout[9:12])
    assert px({"invert": 100})[0] == [55, 205, 235]
    assert px({"mirror": 100}) == ([20, 50, 200], [200, 50, 20])


def test_text_anim_new_types():
    from clips_worker import text_anim as ta

    assert "bounce_in" in ta.IN_TYPES and "zoom_out" in ta.IN_TYPES
    assert "bounce_in" not in ta.LAYER_TYPES
    assert ta.block_state("zoom_out", 0.0)["sc"] == 1.6
    assert ta.block_state("bounce_in", 1.0)["dy"] == 0.0
    assert ta.norm_layer_anim({"in": {"type": "bounce_in", "durMs": 400}})["in"]["type"] == "fade"
