"""EFFECTS1b: flash / light leak / Ken Burns chains render on a 2 s synthetic clip (worker ffmpeg 5.1) and
match the TS maths; rotate-in text animation mirrors render-plan/text-anim.ts."""
from __future__ import annotations

import shutil
import subprocess

import pytest

from clips_worker import fx_library as fl
from clips_worker.color_grade import FX2_KEYS as GRADE_FX2_KEYS

W, H = 320, 568
CASES = [{"flash": 70}, {"leak": 60}, {"kenburns": 100}, {"kenburns": 50, "mirror": 100, "zoom": 20, "shake": 30},
         {"leak": 40, "flash": 30, "flicker": 20, "scanlines": 30}]


def _graph(fx: dict, en: str, tmp_path, w=W, h=H) -> tuple[str, str]:
    pre, cur = fl.pre_parts("src", fx, w, h, "t", en)
    post, cur = fl.post_parts(cur, fx, w, h, tmp_path, "t", en)
    sh, cur = fl.shake_parts(cur, fx, w, h, "t", en)
    return ";".join(["[0:v]format=gbrp[src]", *pre, *post, *sh, f"[{cur}]format=rgb24[out]"]), cur


def test_keys():
    assert fl.FX2_KEYS == GRADE_FX2_KEYS
    assert fl.FX2_KEYS[-3:] == ("flash", "leak", "kenburns")


def test_leak_image():
    img = fl.leak_image(100, 64, 32)
    assert img.shape == (32, 64, 3)
    assert all(abs(int(a) - b) <= 4 for a, b in zip(img[0, 0], fl.LEAK_RGB))
    assert int(img[-1, -1].max()) < int(img[0, 0].max())


@pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not on PATH")
@pytest.mark.parametrize("en", ["", ":enable='gte(t,0.5)*lt(t,1.5)'"])
@pytest.mark.parametrize("fx", CASES)
def test_chain_renders(fx, en, tmp_path):
    g, _ = _graph(fx, en, tmp_path)
    r = subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", f"testsrc2=s={W}x{H}:d=2:r=30",
                        "-filter_complex", g, "-map", "[out]", "-f", "null", "-"],
                       capture_output=True, text=True, timeout=180)
    assert r.returncode == 0, r.stderr[-800:]


@pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not on PATH")
def test_flash_pixels(tmp_path):
    g, _ = _graph({"flash": 100}, "", tmp_path, 2, 2)
    r = subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "color=c=0x404040:s=2x2:d=0.2:r=30",
                        "-filter_complex", g, "-map", "[out]", "-frames:v", "3", "-f", "rawvideo", "-"],
                       capture_output=True, timeout=60)
    assert r.returncode == 0, r.stderr
    f0, f2 = r.stdout[0], r.stdout[2 * 12]
    assert f0 == round(64 + (255 - 64) * 0.8) or abs(f0 - round(64 + 191 * 0.8)) <= 1  # frame 0 flashes
    assert f2 == 64  # frame 2 does not


def test_rotate_in():
    from clips_worker import text_anim as ta

    assert ta.block_state("rotate_in", 0.0)["rot"] == -90.0
    fa = ta.frame_anim({"in": {"type": "rotate_in", "unit": "block", "durMs": 500}}, 0, 0, 2000, 500, 0)
    assert fa["rot"] == -90.0
    assert "rotate_in" not in ta.LAYER_TYPES
