"""E6: stronger fit/blur background (default strong) + per-clip strength, one table for export and preview."""
from __future__ import annotations

import re
import shutil
import subprocess

import pytest

from clips_worker.filtergraph import (
    DEFAULT_FIT_BLUR_STRENGTH,
    FIT_BLUR_SIGMA_FRAC,
    fit_blur_bg_chain,
    fit_blur_overlay_filter,
    fit_blur_strength,
)

LEGACY = (
    "[0:v]split=2[a][b];[a]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,"
    "boxblur=30:3,eq=brightness=-0.06:saturation=0.9[bg];"
    "[b]scale=720:1280:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2[vout]"
)


def _sigma(chain: str) -> float:
    m = re.search(r"gblur=sigma=([0-9.]+)", chain)
    assert m, chain
    return float(m.group(1))


def test_default_is_strong_and_soft_is_legacy(monkeypatch):
    monkeypatch.delenv("FIT_BLUR_STRENGTH", raising=False)
    assert DEFAULT_FIT_BLUR_STRENGTH == "strong"
    assert fit_blur_strength(None) == "strong"
    assert fit_blur_overlay_filter("0:v", "vout", 720, 1280, "soft") == LEGACY
    assert "gblur" in fit_blur_overlay_filter("0:v", "vout", 720, 1280)


def test_strength_order_and_resolution_independent():
    s720 = [_sigma(fit_blur_bg_chain(720, 1280, s)) * 4 / 720 for s in ("strong", "max")]
    s1080 = [_sigma(fit_blur_bg_chain(1080, 1920, s)) * 4 / 1080 for s in ("strong", "max")]
    assert s720[0] < s720[1]
    assert s720 == pytest.approx(s1080, abs=1e-3)
    # strong is clearly stronger than the old export blur (~0.028·W) and the speakercrop wide (6px@/8 of 720)
    assert FIT_BLUR_SIGMA_FRAC["strong"] > 2 * FIT_BLUR_SIGMA_FRAC["soft"]
    assert FIT_BLUR_SIGMA_FRAC["strong"] * 720 / 8 > 6


def test_strength_resolution_sources(monkeypatch):
    monkeypatch.delenv("FIT_BLUR_STRENGTH", raising=False)
    assert fit_blur_strength({"layout": {"mode": "fit_blur", "blurStrength": "max"}}) == "max"
    assert fit_blur_strength({"fitBlurStrength": "soft"}) == "soft"
    assert fit_blur_strength({"layout": {"blurStrength": "bogus"}}) == "strong"
    monkeypatch.setenv("FIT_BLUR_STRENGTH", "soft")
    assert fit_blur_strength({}) == "soft"


def test_layout_router_carries_strength():
    from clips_worker.layout_router import speakercrop_settings_from_edits

    out = speakercrop_settings_from_edits({"layout": "speaker_follow"}, {"layout": {"mode": "fit_blur", "blurStrength": "max"}})
    assert out["fitBlurStrength"] == "max"
    plain = speakercrop_settings_from_edits({}, {"layout": {"mode": "fit_blur"}})
    assert "fitBlurStrength" not in plain


def test_reframe_core_wide_blur_follows_env(monkeypatch):
    from clips_worker import reframe_core as rc

    monkeypatch.setenv("FIT_BLUR_STRENGTH", "max")
    hi = rc.blur_fit_filter(720, 1280)
    monkeypatch.setenv("FIT_BLUR_STRENGTH", "soft")
    lo = rc.blur_fit_filter(720, 1280)
    assert _sigma(hi) > _sigma(lo)


def _run(fc: str, out_label: str, size: str = "640x360") -> None:
    if not shutil.which("ffmpeg"):
        pytest.skip("ffmpeg missing")
    subprocess.run(
        ["ffmpeg", "-v", "error", "-f", "lavfi", "-i", f"testsrc2=s={size}:d=0.2", "-filter_complex", fc,
         "-map", f"[{out_label}]", "-f", "null", "-"],
        check=True, capture_output=True, text=True,
    )


@pytest.mark.parametrize("strength", ["soft", "strong", "max"])
def test_graphs_run_on_ffmpeg(strength):
    _run(fit_blur_overlay_filter("0:v", "vout", 720, 1280, strength), "vout")


def test_t6_contain_blur_panels_scoped_and_run():
    from clips_worker.t6_render import build_template_filtergraph

    spec = {
        "playW": 720,
        "playH": 1280,
        "blurStrength": "strong",
        "bands": [{"dest": {"x": 0, "y": 0, "w": 720, "h": 100}, "fill": "blur"}],
        "panels": [
            {"dest": {"x": 0, "y": 0, "w": 720, "h": 640}, "src": {"x": 0, "y": 0, "w": 1, "h": 1}, "fit": "contain_blur"},
            {"dest": {"x": 0, "y": 640, "w": 720, "h": 640}, "src": {"x": 0, "y": 0, "w": 1, "h": 1}, "fit": "contain_blur"},
        ],
    }
    fc = build_template_filtergraph(spec, src_w=640, src_h=360, duration_s=0.2)
    assert "[p0_a]" in fc and "[p1_a]" in fc and "[a]" not in fc
    _run(fc, "vout")
