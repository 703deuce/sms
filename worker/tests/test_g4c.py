"""G4c worker: stabilize (vidstab / deshake), smooth slow-mo, blur regions, fx keyframes."""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import numpy as np
import pytest

ff = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not installed")
W, H = 320, 192


def _run(cmd, **kw):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, **kw)


def _frames(path: Path, w: int = W, h: int = H, n: int | None = None) -> np.ndarray:
    cmd = ["ffmpeg", "-v", "error", "-i", str(path)]
    if n:
        cmd += ["-frames:v", str(n)]
    raw = subprocess.check_output(cmd + ["-f", "rawvideo", "-pix_fmt", "gray", "-"])
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(float)


def _frame_rgb(path: Path, t: float, w: int = W, h: int = H) -> np.ndarray:
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", str(path), "-frames:v", "1",
                                   "-f", "rawvideo", "-pix_fmt", "rgb24", "-"])
    return np.frombuffer(raw, np.uint8).reshape(h, w, 3).astype(float)


def _shift(a: np.ndarray, b: np.ndarray) -> tuple[float, float]:
    """Phase-correlation translation between two gray frames (centre crop)."""
    ca = a[24:-24, 40:-40] - a[24:-24, 40:-40].mean()
    cb = b[24:-24, 40:-40] - b[24:-24, 40:-40].mean()
    f = np.fft.fft2(ca) * np.conj(np.fft.fft2(cb))
    r = np.fft.ifft2(f / (np.abs(f) + 1e-9)).real
    y, x = np.unravel_index(np.argmax(r), r.shape)
    if y > r.shape[0] // 2:
        y -= r.shape[0]
    if x > r.shape[1] // 2:
        x -= r.shape[1]
    return float(x), float(y)


def _jitter(frames: np.ndarray, lo: int, hi: int) -> float:
    return float(np.mean([np.hypot(*_shift(frames[i], frames[i + 1])) for i in range(lo, hi - 1)]))


@pytest.fixture(scope="module")
def shaky(tmp_path_factory) -> Path:
    """Static textured picture with a hand-held style jitter (crop offset changes every frame)."""
    d = tmp_path_factory.mktemp("g4c")
    rng = np.random.default_rng(3)
    img = (rng.random((H + 40, W + 40)) * 255).astype(np.uint8)
    img = np.kron(img[::4, ::4], np.ones((4, 4), np.uint8))[: H + 40, : W + 40]
    png = d / "tex.pgm"
    png.write_bytes(f"P5 {img.shape[1]} {img.shape[0]} 255\n".encode() + img.tobytes())
    out = d / "shaky.mp4"
    _run(["ffmpeg", "-y", "-v", "error", "-loop", "1", "-i", str(png), "-f", "lavfi", "-i",
          "sine=f=440:d=3", "-t", "3", "-vf",
          f"fps=30,crop={W}:{H}:'20+round(9*sin(n*1.9))':'20+round(7*cos(n*2.7))',format=yuv420p",
          "-c:v", "libx264", "-crf", "8", "-c:a", "aac", "-shortest", str(out)])
    return out


# ── stabilize ──────────────────────────────────────────────────────────────

def test_normalize_stabilize():
    from clips_worker.stabilize import normalize_stabilize

    rows = normalize_stabilize([
        {"fromMs": 2000, "toMs": 3000, "amount": 500},
        {"fromMs": 0, "toMs": 2500, "amount": "40"},
        {"fromMs": 10, "toMs": 50},
        "x",
        {"fromMs": 4000, "toMs": 5000},
    ])
    assert rows == [
        {"fromMs": 0, "toMs": 2500, "amount": 40},
        {"fromMs": 2500, "toMs": 3000, "amount": 100},
        {"fromMs": 4000, "toMs": 5000, "amount": 50},
    ]
    assert normalize_stabilize(None) == []


def test_stabilize_params():
    from clips_worker.stabilize import deshake_radius, vidstab_params

    assert vidstab_params(1) == (3, 5)
    assert vidstab_params(50) == (6, 25)
    assert vidstab_params(100) == (10, 45)
    assert [deshake_radius(a) for a in (1, 25, 26, 60, 100)] == [16, 16, 32, 48, 64]


@ff
def test_ffmpeg_filter_probe():
    from clips_worker.stabilize import ffmpeg_filters, stabilize_method

    f = ffmpeg_filters()
    assert "deshake" in f and "minterpolate" in f
    assert stabilize_method() in ("vidstab", "deshake")


@ff
@pytest.mark.parametrize("method", ["vidstab", "deshake"])
def test_stabilize_reduces_jitter(shaky, tmp_path, monkeypatch, method):
    from clips_worker import stabilize as st

    if method == "vidstab" and "vidstabdetect" not in st.ffmpeg_filters():
        pytest.skip("ffmpeg without libvidstab")
    monkeypatch.setenv("CLIPS_STABILIZE_METHOD", method)
    edits = {"stabilize": [{"fromMs": 1000, "toMs": 2500, "amount": 80}]}
    out = st.apply_full_render_stabilize(shaky, edits, 0, 3000, tmp_path)
    assert out != shaky and out.is_file()
    a, b = _frames(shaky), _frames(out)
    assert abs(len(a) - len(b)) <= 1
    before, after = _jitter(a, 36, 72), _jitter(b, 36, 72)
    assert after < before * 0.6, (method, before, after)
    # outside the range the original frames are kept untouched
    assert np.mean(np.abs(a[5] - b[5])) < 3
    # audio is kept
    probe = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type", "-of", "csv=p=0", str(out)], text=True)
    assert "audio" in probe


@ff
def test_stabilize_failure_keeps_original(shaky, tmp_path, monkeypatch):
    from clips_worker import stabilize as st

    def boom(*a, **k):
        raise subprocess.CalledProcessError(1, "ffmpeg")

    monkeypatch.setattr(st, "stabilize_window", boom)
    assert st.apply_full_render_stabilize(shaky, {"stabilize": [{"fromMs": 0, "toMs": 1000}]}, 0, 3000, tmp_path) == shaky


def test_stabilize_none_without_ranges(tmp_path):
    from clips_worker.stabilize import apply_full_render_stabilize

    p = tmp_path / "x.mp4"
    assert apply_full_render_stabilize(p, {"stabilize": []}, 0, 1000, tmp_path) == p
    assert apply_full_render_stabilize(p, {"stabilize": [{"fromMs": 5000, "toMs": 6000}]}, 0, 1000, tmp_path) == p


# ── smooth slow-mo ─────────────────────────────────────────────────────────

def test_smooth_mode_gate():
    from clips_worker.speed import smooth_mode, warp_filtergraph

    slow = [{"startMs": 0, "endMs": 1000, "speed": 1.0}, {"startMs": 1000, "endMs": 3000, "speed": 0.5}]
    fast = [{"startMs": 0, "endMs": 3000, "speed": 2.0}]
    assert smooth_mode(None, slow, 1080, 1920) is None
    assert smooth_mode("motion", fast, 1080, 1920) is None
    assert smooth_mode("motion", slow, 1080, 1920) == "motion"
    assert smooth_mode("motion", slow, 2160, 3840) == "blend"
    long = [{"startMs": 0, "endMs": 20000, "speed": 0.5}]
    assert smooth_mode("motion", long, 720, 1280) == "blend"
    assert smooth_mode("blend", slow, 2160, 3840) == "blend"
    assert smooth_mode("bogus", slow, 720, 1280) is None
    g, _, _ = warp_filtergraph(slow, 30, has_audio=True, smooth="motion")
    assert g.count("minterpolate") == 1 and "mi_mode=mci" in g
    g2, _, _ = warp_filtergraph(slow, 30, has_audio=True)
    assert "minterpolate" not in g2


@ff
@pytest.mark.parametrize("mode", ["blend", "motion"])
def test_smooth_slowmo_export(shaky, tmp_path, mode, capsys):
    from clips_worker.export_post import apply_export_post

    src = tmp_path / "in.mp4"
    _run(["ffmpeg", "-y", "-v", "error", "-i", str(shaky), "-t", "2", "-c", "copy", str(src)])
    edits = {"smoothSlowmo": mode, "segmentSpeeds": [{"fromMs": 0, "toMs": 1000, "speed": 0.5}],
             "trim": {"in": 0, "out": 2000}, "cutRanges": []}
    meta = {"speed_warp": [{"startMs": 0, "endMs": 1000, "speed": 0.5}, {"startMs": 1000, "endMs": 2000, "speed": 1.0}]}
    out, _ = apply_export_post(src, tmp_path, edits, meta)
    fr = _frames(out)
    assert 85 <= len(fr) <= 95  # 2 s slowed + 1 s
    # without smoothing, the 0.5× piece repeats every frame; smoothing makes neighbours differ
    diffs = [np.mean(np.abs(fr[i] - fr[i + 1])) for i in range(10, 50)]
    dup = sum(1 for d in diffs if d < 0.5)
    assert dup <= 4, (mode, dup)
    assert f"[g4c:slowmo] mode={mode}" in capsys.readouterr().out


@ff
def test_slowmo_plain_has_duplicates(shaky, tmp_path):
    from clips_worker.export_post import apply_export_post

    src = tmp_path / "in.mp4"
    _run(["ffmpeg", "-y", "-v", "error", "-i", str(shaky), "-t", "2", "-c", "copy", str(src)])
    meta = {"speed_warp": [{"startMs": 0, "endMs": 1000, "speed": 0.5}, {"startMs": 1000, "endMs": 2000, "speed": 1.0}]}
    out, _ = apply_export_post(src, tmp_path, {"segmentSpeeds": [{"fromMs": 0, "toMs": 1000, "speed": 0.5}]}, meta)
    fr = _frames(out)
    diffs = [np.mean(np.abs(fr[i] - fr[i + 1])) for i in range(10, 50)]
    assert sum(1 for d in diffs if d < 0.5) >= 15


# ── blur regions ───────────────────────────────────────────────────────────

def test_normalize_blur_regions():
    from clips_worker.blur_regions import DEFAULT_BLUR_MASK, normalize_blur_regions

    rows = normalize_blur_regions([
        {"id": "b", "startMs": 500, "endMs": 1500, "amount": 300, "mode": "faces",
         "mask": {"shape": "rect", "x": 10, "y": 20, "w": 30, "h": 40, "rot": 0, "feather": 0}},
        {"id": "a", "startMs": 0, "endMs": 400.4},
        {"id": "a", "startMs": 0, "endMs": 900},
        {"id": "bad id", "startMs": 0, "endMs": 900},
        {"id": "c", "startMs": 0, "endMs": 50},
    ])
    assert [r["id"] for r in rows] == ["a", "b"]
    assert rows[0] == {"id": "a", "startMs": 0, "endMs": 400, "mode": "manual", "amount": 60, "mask": DEFAULT_BLUR_MASK}
    assert rows[1]["amount"] == 100 and rows[1]["mode"] == "faces" and rows[1]["mask"]["shape"] == "rect"


def test_hold_faces():
    from clips_worker.blur_regions import hold_faces

    f = [(0.5, 0.5, 0.1, 0.1)]
    assert hold_faces([f, [], [], [], [], f]) == [f, f, f, f, [], f]


@ff
def test_blur_region_manual(shaky, tmp_path):
    from clips_worker.blur_regions import apply_blur_regions

    edits = {"blurRegions": [{"id": "r1", "startMs": 1000, "endMs": 2000, "amount": 80,
                              "mask": {"shape": "rect", "x": 25, "y": 50, "w": 40, "h": 60, "rot": 0, "feather": 0}}]}
    out = tmp_path / "blur.mp4"
    assert apply_blur_regions(shaky, out, edits, W, H, tmp_path)
    a, b = _frame_rgb(shaky, 1.5), _frame_rgb(out, 1.5)
    inside = (slice(70, 120), slice(40, 110))
    outside = (slice(70, 120), slice(200, 300))
    assert b[inside].std() < a[inside].std() * 0.5
    assert np.mean(np.abs(a[outside] - b[outside])) < 4
    a0, b0 = _frame_rgb(shaky, 0.5), _frame_rgb(out, 0.5)
    assert np.mean(np.abs(a0[inside] - b0[inside])) < 4  # before the region: untouched


@ff
def test_blur_region_keyframed_mask(shaky, tmp_path):
    from clips_worker.blur_regions import apply_blur_regions

    mask = {"shape": "rect", "x": 20, "y": 50, "w": 30, "h": 60, "rot": 0, "feather": 0,
            "keys": [{"ms": 0, "x": 20}, {"ms": 1000, "x": 80}]}
    out = tmp_path / "blurk.mp4"
    assert apply_blur_regions(shaky, out, {"blurRegions": [{"id": "k", "startMs": 0, "endMs": 1000, "amount": 80, "mask": mask}]},
                              W, H, tmp_path)
    a, b = _frame_rgb(shaky, 0.9), _frame_rgb(out, 0.9)
    right, left = (slice(70, 120), slice(240, 270)), (slice(70, 120), slice(50, 80))
    assert b[right].std() < a[right].std() * 0.5
    assert np.mean(np.abs(a[left] - b[left])) < 4


@ff
def test_blur_region_faces_with_detector(shaky, tmp_path):
    from clips_worker.blur_regions import apply_blur_regions

    calls = []

    def det(fr):
        calls.append(fr.shape)
        return [(0.65, 0.3, 0.2, 0.3)]  # x, y, w, h (normalized) → centre (0.75, 0.45)

    out = tmp_path / "faces.mp4"
    edits = {"blurRegions": [{"id": "f", "startMs": 0, "endMs": 1000, "amount": 80, "mode": "faces"}]}
    assert apply_blur_regions(shaky, out, edits, W, H, tmp_path, detector=det)
    assert len(calls) == 10 and calls[0][1] == 640
    a, b = _frame_rgb(shaky, 0.5), _frame_rgb(out, 0.5)
    face = (slice(75, 100), slice(230, 250))
    far = (slice(140, 180), slice(20, 80))
    assert b[face].std() < a[face].std() * 0.5
    assert np.mean(np.abs(a[far] - b[far])) < 4


@ff
def test_blur_region_faces_without_model_uses_mask(shaky, tmp_path, monkeypatch):
    from clips_worker import blur_regions as br

    monkeypatch.setattr(br, "_yunet", lambda: (None, None))
    out = tmp_path / "fb.mp4"
    edits = {"blurRegions": [{"id": "f", "startMs": 0, "endMs": 1000, "amount": 80, "mode": "faces",
                              "mask": {"shape": "rect", "x": 25, "y": 50, "w": 40, "h": 60, "rot": 0, "feather": 0}}]}
    assert br.apply_blur_regions(shaky, out, edits, W, H, tmp_path)
    a, b = _frame_rgb(shaky, 0.5), _frame_rgb(out, 0.5)
    assert b[70:120, 40:110].std() < a[70:120, 40:110].std() * 0.5


# ── fx keyframes ───────────────────────────────────────────────────────────

def test_fx_keyframes_spec_overrides():
    from clips_worker.color_grade import color_tracks, spec_with_overrides, stepped_windows
    from clips_worker.motion import KEY_PROPS, PROP_SPECS, color_props_for_target

    assert "fxBlur" in KEY_PROPS and PROP_SPECS["fxGlow"] == (0.0, 100.0, 0.0)
    assert "fxVignette" in color_props_for_target("broll:a") and "fxGrain" in color_props_for_target("adjust:z")
    edits = {"keyframes": [{"target": "video", "prop": "fxBlur", "points": [{"tMs": 0, "v": 0}, {"tMs": 1000, "v": 100}]}]}
    tr = color_tracks(edits, "video")
    assert len(tr) == 1
    base = {"fx": {"vignette": 30}}
    assert spec_with_overrides(base, tr, 0) == {"fx": {"vignette": 30}}
    s = spec_with_overrides(base, tr, 512)  # step 500 → 50
    assert s["fx"] == {"vignette": 30, "blur": 50}
    s2 = spec_with_overrides(base, tr, 330)  # step 300 → 30
    assert s2["fx"]["blur"] == 30
    e2 = {"keyframes": [{"target": "video", "prop": "fxGlow", "points": [{"tMs": 0, "v": 0}, {"tMs": 1000, "v": 33}]}]}
    s3 = spec_with_overrides({}, color_tracks(e2, "video"), 500)
    assert s3["fx"]["glow"] == 15  # 16.5 → quantized to 5
    wins = stepped_windows({}, tr, 0, 1000)
    assert wins[0][0] == 100 and len({w[2]["fx"]["blur"] for w in wins}) == len(wins)


@ff
def test_fx_keyframes_video_export(tmp_path):
    """Keyframed blur on the main video renders through the stepped fx groups (ffmpeg 5.1)."""
    from clips_worker.color import apply_full_render_color

    src = tmp_path / "src.mp4"
    _run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"testsrc2=s={W}x{H}:r=30:d=1", "-c:v", "libx264",
          "-pix_fmt", "yuv420p", "-crf", "4", str(src)])
    edits = {"trim": {"in": 0, "out": 1000}, "cutRanges": [],
             "keyframes": [{"target": "video", "prop": "fxBlur", "points": [{"tMs": 0, "v": 0}, {"tMs": 900, "v": 100}]}]}
    out = apply_full_render_color(src, edits, 0, 1000, tmp_path)
    assert out != src
    a0, b0 = _frame_rgb(src, 0.03), _frame_rgb(out, 0.03)
    a9, b9 = _frame_rgb(src, 0.95), _frame_rgb(out, 0.95)
    assert np.mean(np.abs(a0 - b0)) < 3
    assert np.mean(np.abs(a9 - b9)) > 8


@ff
def test_fx_keyframes_adjust_layer_export(tmp_path):
    from clips_worker.adjust_layers import adjust_graph, apply_adjust_layers

    src = tmp_path / "src.mp4"
    _run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"testsrc2=s={W}x{H}:r=30:d=1", "-c:v", "libx264",
          "-pix_fmt", "yuv420p", "-crf", "4", str(src)])
    edits = {"adjustLayers": [{"id": "z", "startMs": 0, "endMs": 1000, "spec": {"adjust": {"exposure": 1}}}],
             "keyframes": [{"target": "adjust:z", "prop": "fxBlur", "points": [{"tMs": 0, "v": 100}, {"tMs": 500, "v": 0}]}]}
    g = adjust_graph(edits, W, H, tmp_path)
    assert g and g[0].count("gblur") >= 2
    out = tmp_path / "adj.mp4"
    assert apply_adjust_layers(src, out, edits, W, H, tmp_path)
    assert np.mean(np.abs(_frame_rgb(src, 0.03) - _frame_rgb(out, 0.03))) > 8
    assert np.mean(np.abs(_frame_rgb(src, 0.8) - _frame_rgb(out, 0.8))) < 4


def test_fx_keyframes_broll_filter(tmp_path):
    from clips_worker.color import broll_color_filter

    edits = {"keyframes": [{"target": "broll:b1", "prop": "fxGlow", "points": [{"tMs": 0, "v": 0}, {"tMs": 400, "v": 100}]}]}
    f = broll_color_filter(edits, "b1", tmp_path, w=W, h=H, tag="bx", start_s=1.0, end_s=2.0)
    assert f.count("blend=all_mode=screen") >= 3 and "enable='gte(t,1.1" in f
    # static fx without fx tracks keep the old single chain
    f2 = broll_color_filter({"color": {"broll": {"b1": {"fx": {"glow": 40}}}}}, "b1", tmp_path, w=W, h=H, tag="bx",
                            start_s=1.0, end_s=2.0)
    assert f2.count("blend=all_mode=screen") == 1 and "enable" not in f2


@ff
def test_smooth_slowmo_motion_timeout_falls_back(shaky, tmp_path, monkeypatch, capsys):
    from clips_worker import export_post as ep

    real = subprocess.run

    def fake(cmd, *a, **k):
        if any("mi_mode=mci" in str(c) for c in cmd):
            raise subprocess.TimeoutExpired(cmd, 1)
        return real(cmd, *a, **k)

    monkeypatch.setattr(ep.subprocess, "run", fake)
    src = tmp_path / "in.mp4"
    _run(["ffmpeg", "-y", "-v", "error", "-i", str(shaky), "-t", "2", "-c", "copy", str(src)])
    meta = {"speed_warp": [{"startMs": 0, "endMs": 1000, "speed": 0.5}, {"startMs": 1000, "endMs": 2000, "speed": 1.0}]}
    out, _ = ep.apply_export_post(src, tmp_path, {"smoothSlowmo": "motion"}, meta)
    log = capsys.readouterr().out
    assert "mode=motion failed err=TimeoutExpired" in log and "[g4c:slowmo] mode=blend" in log
    assert out.is_file()


def test_g4c_edits_never_reuse_preview():
    from clips_worker.edits_render import is_default_edits, normalize_edits

    base = normalize_edits({}, 0, 10_000)
    assert is_default_edits(base, 0, 10_000)
    for extra in ({"stabilize": [{"fromMs": 0, "toMs": 1000}]},
                  {"blurRegions": [{"id": "a", "startMs": 0, "endMs": 1000}]}):
        assert not is_default_edits(normalize_edits({**base, **extra}, 0, 10_000), 0, 10_000)
