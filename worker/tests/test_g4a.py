"""G4a color grade v2 / adjustment layers / color keyframes (worker side).

worker/tests/fixtures/g4a_parity.json is written / asserted by new-app/tests/g4a-parity.test.ts."""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest

from clips_worker.color import look_key, normalize_spec
from clips_worker.color_grade import (
    bake_grid,
    canon_grade,
    grade,
    grain_cells,
    grain_hash,
    grain_offset,
    hsl_weights,
    parse_cube,
    sharpen_kernel,
    tetra,
    vignette_mask,
)

FIX = json.loads((Path(__file__).parent / "fixtures" / "g4a_parity.json").read_text())
LUT = parse_cube(FIX["cube"])


def test_spec_normalization_matches_ts():
    for s in FIX["specs"]:
        assert normalize_spec(s["raw"]) == s["spec"]


def test_keys_and_canon_match_ts():
    for s in FIX["specs"]:
        assert look_key(s["spec"]) == s["key"]
        assert canon_grade(s["spec"]) == s["canon"]


def test_pointwise_grade_matches_ts():
    pts = np.asarray(FIX["samples"], dtype=np.float64)
    for s in FIX["specs"]:
        got = grade(s["spec"], pts, LUT)
        want = np.asarray(s["out"])
        assert np.abs(got - want).max() < 1e-6, s["key"]


def test_baked_grid_matches_ts():
    for s in FIX["specs"]:
        got = bake_grid(s["spec"], 5, LUT).ravel()
        assert np.abs(got - np.asarray(s["grid5"])).max() < 2e-5, s["key"]


def test_tetra_hsl_weights_and_fx_tables():
    pts = np.asarray(FIX["samples"][:16], dtype=np.float64) * 3
    grid = np.asarray(LUT["data"]).reshape(-1, 3)
    assert np.abs(tetra(grid, 4, pts) - np.asarray(FIX["tetra"])).max() < 1e-6
    hs = np.asarray([0, 15, 45, 90, 150, 200, 260, 300, 340, 359.5], dtype=np.float64)
    assert np.abs(hsl_weights(hs) - np.asarray(FIX["hslWeights"])).max() < 1e-8
    got = [int(grain_hash(x, y, k)) for x, y, k in [(0, 0, 0), (1, 2, 3), (640, 360, 7), (1919, 1079, 7), (12, 99, 5)]]
    assert got == FIX["grainHash"]
    assert grain_cells(30, 6, 4).ravel()[:80].tolist() == FIX["grainCells"]
    assert [list(grain_offset(f)) for f in (0, 1, 2, 7, 8, 9)] == FIX["grainOffsets"]
    assert vignette_mask(60, 16, 9).ravel().tolist() == FIX["vignette"]
    assert sharpen_kernel(40) == FIX["sharpen"]


def test_e4_only_cube_unchanged(tmp_path):
    from clips_worker.color import write_cube

    spec = {"preset": "vivid", "adjust": {"contrast": 10}}
    assert look_key(spec) == "vivid_100_0_10_0_0_0_0"
    p = write_cube(spec, tmp_path / "a.cube")
    assert p.read_text().splitlines()[1] == "LUT_3D_SIZE 33"


def test_parse_cube_errors():
    with pytest.raises(ValueError):
        parse_cube("LUT_1D_SIZE 4\n0 0 0\n")
    with pytest.raises(ValueError):
        parse_cube("LUT_3D_SIZE 2\n0 0 0\n")


# ── real ffmpeg (prod 5.1: PATH=/path/to/ffmpeg-5.1:$PATH) ──────────────────

import shutil  # noqa: E402
import subprocess  # noqa: E402

ff = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not installed")
W, H = 160, 96
PATCHES = [(220, 30, 30), (30, 200, 60), (30, 30, 220), (128, 128, 128), (240, 210, 170), (20, 25, 30)]
TOL = 7


def _run(cmd):
    subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def _patch_video(path: Path, seconds: float = 1.0) -> None:
    pw, ph = W // 3, H // 2
    draws = [f"drawbox=x={(i % 3) * pw}:y={(i // 3) * ph}:w={pw}:h={ph}:color=0x{c[0]:02X}{c[1]:02X}{c[2]:02X}:t=fill"
             for i, c in enumerate(PATCHES)]
    _run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"color=c=black:s={W}x{H}:r=30:d={seconds}",
          "-f", "lavfi", "-i", f"sine=frequency=440:sample_rate=48000:d={seconds}",
          "-vf", ",".join(draws), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "1", "-c:a", "aac", "-shortest",
          str(path)])


def _frame(path: Path, t: float) -> np.ndarray:
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", str(path), "-frames:v", "1",
                                   "-f", "rawvideo", "-pix_fmt", "rgb24", "-"])
    return np.frombuffer(raw, np.uint8).reshape(H, W, 3).astype(float)


def _centres():
    pw, ph = W // 3, H // 2
    return [((i % 3) * pw + pw // 2, (i // 3) * ph + ph // 2) for i in range(len(PATCHES))]


def _check(src, out, spec, t, lut=None, tol=TOL):
    a, b = _frame(src, t), _frame(out, t)
    for x, y in _centres():
        want = grade(spec, a[y, x][None, :] / 255.0, lut)[0] * 255
        assert np.max(np.abs(b[y, x] - want)) <= tol, (spec, a[y, x], want, b[y, x])


@ff
def test_v2_grade_export_matches_model(tmp_path):
    from clips_worker.color import apply_full_render_color

    src = tmp_path / "src.mp4"
    _patch_video(src, 0.4)
    for i, s in enumerate(FIX["specs"][:8]):
        spec = s["spec"]
        edits = {"color": {"video": spec}, "_lutData": {"demo": LUT}}
        wd = tmp_path / f"w{i}"
        wd.mkdir()
        out = apply_full_render_color(src, edits, 0, 400, wd)
        assert out != src
        _check(src, out, spec, 0.2, LUT)


@ff
def test_color_keyframes_step_in_export(tmp_path):
    """Video-target cBrightness 0 → 100 over output 0..1000 ms: stepped every 100 ms like the preview."""
    from clips_worker.color import apply_full_render_color, video_grade_ranges

    src = tmp_path / "src.mp4"
    _patch_video(src, 1.0)
    edits = {"trim": {"in": 0, "out": 1000}, "cutRanges": [], "color": {},
             "keyframes": [{"target": "video", "prop": "cBrightness", "points": [{"tMs": 0, "v": 0}, {"tMs": 1000, "v": 100}]}]}
    ranges = video_grade_ranges(edits, 0, 1000)
    assert [r[0] for r in ranges][:3] == [100, 200, 300]  # step 0 has brightness 0 → identity (dropped)
    assert ranges[2][2] == {"adjust": {"brightness": 30}}
    out = apply_full_render_color(src, edits, 0, 1000, tmp_path)
    _check(src, out, {}, 0.05)
    _check(src, out, {"adjust": {"brightness": 30}}, 0.35)
    _check(src, out, {"adjust": {"brightness": 70}}, 0.75)


@ff
def test_fx_vignette_and_grain_render(tmp_path):
    from clips_worker.color import apply_full_render_color

    src = tmp_path / "src.mp4"
    _run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"color=c=0x808080:s={W}x{H}:r=30:d=0.4",
          "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "1", str(src)])
    out = apply_full_render_color(src, {"color": {"video": {"fx": {"vignette": 100}}}}, 0, 400, tmp_path)
    f = _frame(out, 0.2)
    m = vignette_mask(100, W, H).astype(float) / 255
    want = np.floor(128 * m)  # blend multiply on gbrp: A·B/255 (8-bit)
    assert abs(f[H // 2, W // 2, 1] - want[H // 2, W // 2]) <= 3
    assert abs(f[2, 2, 1] - want[2, 2]) <= 4 and f[2, 2, 1] < 70
    out2 = apply_full_render_color(src, {"color": {"video": {"fx": {"grain": 100, "sharpen": 50}}}}, 0, 400,
                                   tmp_path / ".")
    g = _frame(out2, 0.2)
    assert 3 < g[..., 1].std() < 40 and abs(g[..., 1].mean() - 128) < 6


@ff
def test_adjust_layer_pass(tmp_path):
    from clips_worker.adjust_layers import apply_adjust_layers, normalize_adjust_layers

    src = tmp_path / "src.mp4"
    _patch_video(src, 1.0)
    spec = {"adjust": {"exposure": 30, "contrast": 20}, "hsl": {"red": {"h": 10, "s": 0, "l": 0}}}
    edits = {"adjustLayers": [{"id": "a1", "startMs": 300, "endMs": 700, "spec": spec}]}
    ly = normalize_adjust_layers(edits["adjustLayers"])
    assert "hsl" in ly[0]["spec"]  # EF-12: adjustment layers may carry HSL / LUT
    out = tmp_path / "adj.mp4"
    assert apply_adjust_layers(src, out, edits, W, H, tmp_path)
    _check(src, out, {}, 0.1)
    _check(src, out, ly[0]["spec"], 0.5)
    _check(src, out, {}, 0.85)
    assert not apply_adjust_layers(src, out, {**edits, "timelineLanes": {"adjust": {"hidden": True}}}, W, H, tmp_path)


@ff
def test_broll_graph_with_fx_and_keyframes_is_valid(tmp_path):
    from clips_worker.broll_render import build_broll_filtergraph

    b = tmp_path / "b.mp4"
    _patch_video(b, 1.0)
    base = tmp_path / "base.mp4"
    _patch_video(base, 1.0)
    edits = {"broll": [{"id": "x1", "startMs": 100, "endMs": 900}],
             "color": {"broll": {"x1": {"adjust": {"exposure": 20}, "fx": {"vignette": 50, "grain": 20, "sharpen": 30}}}},
             "keyframes": [{"target": "broll:x1", "prop": "cSaturation", "points": [{"tMs": 0, "v": -100}, {"tMs": 500, "v": 0}]}]}
    graph, extra, label = build_broll_filtergraph(
        [{"local_path": str(b), "start_s": 0.1, "end_s": 0.9, "duration_s": 0.8, "id": "x1"}], W, H, edits, tmp_path)
    out = tmp_path / "o.mp4"
    _run(["ffmpeg", "-y", "-v", "error", "-i", str(base), *extra, "-filter_complex", graph, "-map", f"[{label}]",
          "-t", "1", "-c:v", "libx264", "-pix_fmt", "yuv420p", str(out)])
    f = _frame(out, 0.15)
    gray = f[_centres()[0][1], _centres()[0][0]]
    assert np.ptp(gray) < 25  # saturation −100 at local 0..100 ms


# ── runtime fixture shared with tests/g4a-model.test.ts (keyframe stepping, adjust layers) ──


def test_color_keyframe_steps_and_layers_match_ts():
    from clips_worker.adjust_layers import normalize_adjust_layers
    from clips_worker.color_grade import color_tracks, spec_with_overrides

    fx = json.loads((Path(__file__).parent / "fixtures" / "g4a_runtime.json").read_text())
    edits = fx["edits"]
    layers = normalize_adjust_layers(edits["adjustLayers"])
    assert layers == fx["layers"]
    vt = color_tracks(edits, "video")
    at = color_tracks(edits, "adjust:a1")
    base = normalize_spec(edits["color"]["video"]) or {}
    for row in fx["video"]:
        s = spec_with_overrides(base, vt, row["t"])
        assert (s.get("adjust") or {}) == row["adjust"], row
        assert look_key(s) == row["key"], row
    for row in fx["adjust"]:
        s = spec_with_overrides(layers[0]["spec"], at, row["t"])
        assert (s.get("adjust") or {}) == row["adjust"], row
        assert look_key(s) == row["key"], row
