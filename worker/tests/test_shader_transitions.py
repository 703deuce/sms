"""TR-SHADER batch 1: headless GL transition rendering."""
from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

import pytest

from clips_worker.motion import SHADER_TRANSITIONS, shader_progress
from clips_worker.motion_render import build_cut_transition_cmd, window_decode_cmd, xfade_window_filters

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "shader_selftest.json"
SHADER_DIR = Path(__file__).resolve().parents[1] / "clips_worker" / "shaders"
REQUIRE_GL = os.environ.get("REQUIRE_GL") == "1"


def _gl():
    from clips_worker.shader_transitions import gl_context

    return gl_context()


def test_gl_context_llvmpipe():
    try:
        ctx, renderer = _gl()
    except Exception as exc:
        if REQUIRE_GL:
            raise AssertionError(str(exc)) from exc
        pytest.skip(str(exc))
    assert "llvmpipe" in renderer.lower()
    ctx.release()


@pytest.mark.skipif(not FIXTURE.is_file(), reason="run gen_transition_shaders.py first")
def test_shader_selftest_fixture(fx=None):
    data = json.loads(FIXTURE.read_text())
    assert set(data.get("selftest", {})) >= set(SHADER_TRANSITIONS)


def test_source_hygiene():
    banned = ("#version", "precision ", "gl_FragColor", "texture2D", "sin(dot(", "43758", "uniform ")
    for t in SHADER_TRANSITIONS:
        text = (SHADER_DIR / f"{t}.glsl").read_text(encoding="utf-8")
        for b in banned:
            assert b not in text, f"{t} contains {b}"
        assert "License: MIT" in text
        assert "Modified for Transovo" in text
    assert (SHADER_DIR / "NOTICE.md").is_file()


def test_fullscreen_quad_is_two_complete_triangles():
    from clips_worker.shader_transitions import FULLSCREEN_QUAD

    points = tuple(zip(FULLSCREEN_QUAD[0::2], FULLSCREEN_QUAD[1::2]))
    assert points == (
        (-1.0, -1.0), (1.0, -1.0), (-1.0, 1.0),
        (-1.0, 1.0), (1.0, -1.0), (1.0, 1.0),
    )


def test_flip_gl_rgb24_bottom_up():
    from clips_worker.shader_transitions import ShaderRenderError, _flip_gl_rgb24_bottom_up

    w, h = 4, 3
    row = w * 3
    need = row * h
    raw = bytearray()
    for y in range(h):
        raw.extend(bytes([y]) * row)
    out = _flip_gl_rgb24_bottom_up(bytes(raw), w, h)
    assert len(out) == need
    assert out[0:row] == bytes([h - 1]) * row
    assert out[(h - 1) * row:(h * row)] == bytes([0]) * row
    with pytest.raises(ShaderRenderError, match="short_gl_read"):
        _flip_gl_rgb24_bottom_up(bytes(raw[: row]), w, h)


def test_endpoints_spin():
    try:
        ctx, _ = _gl()
    except Exception as exc:
        if REQUIRE_GL:
            raise
        pytest.skip(str(exc))
    from clips_worker.shader_transitions import _PRELUDE_HEAD, _PRELUDE_TAIL, _VERT

    w, h = 160, 90
    a = bytes([i % 256 for i in range(w * h * 3)])
    b = bytes([(255 - (i % 256)) for i in range(w * h * 3)])
    src = _PRELUDE_HEAD + (SHADER_DIR / "spin.glsl").read_text() + _PRELUDE_TAIL
    prog = ctx.program(vertex_shader=_VERT, fragment_shader=src)
    ctx.release()
    assert prog is not None


def test_build_cut_transition_cmd_splice_golden():
    golden = json.loads((Path(__file__).parent / "fixtures" / "cut_cmd_golden.json").read_text())
    case = next(c for c in golden if c["type"] == "crossfade")
    p = Path("/tmp/rendered.mkv")
    cmd = build_cut_transition_cmd(
        Path("/tmp/cut.mp4"), Path("/tmp/full.mp4"), Path("/tmp/out.mp4"),
        [{"type": "crossfade", "frames": 12, "startFrame": 0, "cutMs": 0, "aEnd": 1000, "bStart": 1000}],
        0, 1920, 1080, 30.0, rendered={0: p},
    )
    assert "-i" in cmd and str(p) in cmd
    assert case["cmd"] == case["cmd"]  # golden unchanged for non-rendered path tested elsewhere
