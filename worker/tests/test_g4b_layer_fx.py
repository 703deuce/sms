"""G4b per-B-roll layer effects in the export graph (ffmpeg 5.1): mask, chroma key, blend, reverse."""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import numpy as np
import pytest

from clips_worker.layer_fx import chroma_params, mask_alpha, mask_geom_at, normalize_layer_fx

ff = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not installed")
W, H = 160, 96


def _run(cmd):
    subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def _lavfi(path: Path, src: str, vf: str | None = None, seconds: float = 1.0):
    cmd = ["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"{src}:s={W}x{H}:r=30:d={seconds}"]
    if vf:
        cmd += ["-vf", vf]
    _run(cmd + ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "1", str(path)])


def _frame(path: Path, t: float) -> np.ndarray:
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", str(path), "-frames:v", "1",
                                   "-f", "rawvideo", "-pix_fmt", "rgb24", "-"])
    return np.frombuffer(raw, np.uint8).reshape(H, W, 3).astype(float)


def _render(tmp: Path, broll: Path, item: dict, layer_fx: list, extra_edits: dict | None = None) -> Path:
    from clips_worker.broll_render import build_broll_filtergraph

    base = tmp / "base.mp4"
    if not base.exists():
        _lavfi(base, "color=c=0x808080")
    edits = {"broll": [item], "layerFx": layer_fx, **(extra_edits or {})}
    spec = {"local_path": str(broll), "start_s": item["startMs"] / 1000, "end_s": item["endMs"] / 1000,
            "duration_s": (item["endMs"] - item["startMs"]) / 1000, "id": item["id"],
            **({k: item[k] for k in ("transitionIn", "transitionOut") if k in item})}
    graph, extra, label = build_broll_filtergraph([spec], W, H, edits, tmp)
    out = tmp / f"o_{len(list(tmp.glob('o_*.mp4')))}.mp4"
    _run(["ffmpeg", "-y", "-v", "error", "-i", str(base), *extra, "-filter_complex", graph, "-map", f"[{label}]",
          "-t", "1", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "4", str(out)])
    return out


ITEM = {"id": "x1", "startMs": 100, "endMs": 900}
RED = np.array([220, 30, 30], float)


def _close(px, want, tol=14):
    assert np.max(np.abs(np.asarray(px) - np.asarray(want, float))) <= tol, (px, want)


@ff
def test_no_layer_fx_graph_unchanged(tmp_path):
    from clips_worker.broll_render import build_broll_filtergraph

    b = tmp_path / "b.mp4"
    _lavfi(b, "color=c=0xDC1E1E")
    spec = {"local_path": str(b), "start_s": 0.1, "end_s": 0.9, "duration_s": 0.8, "id": "x1"}
    g0, e0, _ = build_broll_filtergraph([spec], W, H, {"broll": [ITEM]}, tmp_path)
    g1, e1, _ = build_broll_filtergraph([spec], W, H, {"broll": [ITEM], "layerFx": []}, tmp_path)
    assert g0 == g1 and e0 == e1 == ["-stream_loop", "-1", "-i", str(b)]
    assert "alphamerge" not in g0 and "blend=" not in g0


@ff
def test_mask_rect_hard_edge(tmp_path):
    b = tmp_path / "b.mp4"
    _lavfi(b, "color=c=0xDC1E1E")
    out = _render(tmp_path, b, ITEM, [{"target": "broll:x1", "mask": {"shape": "rect", "x": 50, "y": 50, "w": 50,
                                                                         "h": 50, "rot": 0, "feather": 0}}])
    f = _frame(out, 0.5)
    _close(f[H // 2, W // 2], RED)
    _close(f[4, 4], [128, 128, 128])
    _close(f[H // 2, 8], [128, 128, 128])
    # Before / after the item: base only.
    _close(_frame(out, 0.03)[H // 2, W // 2], [128, 128, 128])


@ff
def test_mask_keyframes_move(tmp_path):
    b = tmp_path / "b.mp4"
    _lavfi(b, "color=c=0xDC1E1E")
    mask = {"shape": "rect", "x": 25, "y": 50, "w": 30, "h": 80, "rot": 0, "feather": 0,
            "keys": [{"ms": 0, "x": 25, "y": 50, "w": 30, "h": 80, "rot": 0, "feather": 0},
                     {"ms": 600, "x": 75, "y": 50, "w": 30, "h": 80, "rot": 0, "feather": 0}]}
    out = _render(tmp_path, b, ITEM, [{"target": "broll:x1", "mask": mask}])
    early, late = _frame(out, 0.15), _frame(out, 0.85)
    _close(early[H // 2, W // 4], RED)
    _close(early[H // 2, 3 * W // 4], [128, 128, 128])
    _close(late[H // 2, 3 * W // 4], RED)
    _close(late[H // 2, W // 4], [128, 128, 128])


@ff
def test_chroma_key(tmp_path):
    b = tmp_path / "b.mp4"
    _lavfi(b, "color=c=0x00FF00", vf=f"drawbox=x={W // 2 - 20}:y={H // 2 - 20}:w=40:h=40:color=0xDC1E1E:t=fill")
    out = _render(tmp_path, b, ITEM, [{"target": "broll:x1", "key": {"color": "#00ff00", "sim": 40, "blend": 10,
                                                                        "spill": 50}}])
    f = _frame(out, 0.5)
    _close(f[H // 2, W // 2], RED, tol=20)
    _close(f[6, 6], [128, 128, 128])


@ff
def test_key_and_mask_multiply(tmp_path):
    b = tmp_path / "b.mp4"
    _lavfi(b, "color=c=0x00FF00", vf="drawbox=x=0:y=0:w=80:h=96:color=0xDC1E1E:t=fill")
    fx = [{"target": "broll:x1", "key": {"color": "#00ff00", "sim": 40, "blend": 0, "spill": 0},
           "mask": {"shape": "rect", "x": 25, "y": 25, "w": 50, "h": 50, "rot": 0, "feather": 0}}]
    f = _frame(_render(tmp_path, b, ITEM, fx), 0.5)
    _close(f[H // 4, W // 4], RED, tol=20)          # red + inside mask
    _close(f[3 * H // 4, W // 4], [128, 128, 128])  # red but masked out
    _close(f[H // 4, 3 * W // 4], [128, 128, 128])  # keyed out


@ff
@pytest.mark.parametrize("mode,want", [
    ("multiply", [128 * 220 / 255, 128 * 30 / 255, 128 * 30 / 255]),
    ("screen", [255 - 127 * 35 / 255, 255 - 127 * 225 / 255, 255 - 127 * 225 / 255]),
    ("darken", [128, 30, 30]),
    ("lighten", [220, 128, 128]),
    ("difference", [92, 98, 98]),
])
def test_blend_modes(tmp_path, mode, want):
    b = tmp_path / "b.mp4"
    _lavfi(b, "color=c=0xDC1E1E")
    f = _frame(_render(tmp_path, b, ITEM, [{"target": "broll:x1", "blend": mode}]), 0.5)
    _close(f[H // 2, W // 2], want, tol=8)
    _close(_frame(tmp_path / "o_0.mp4", 0.95)[H // 2, W // 2], [128, 128, 128])


@ff
def test_blend_with_motion_and_transition_runs(tmp_path):
    b = tmp_path / "b.mp4"
    _lavfi(b, "color=c=0xDC1E1E")
    item = {**ITEM, "transitionIn": {"type": "circle_open", "ms": 300}}
    kf = {"keyframes": [{"target": "broll:x1", "prop": "scale", "points": [{"tMs": 0, "v": 50}, {"tMs": 800, "v": 100}]}]}
    fx = [{"target": "broll:x1", "blend": "screen",
           "mask": {"shape": "ellipse", "x": 50, "y": 50, "w": 80, "h": 80, "rot": 0, "feather": 20}}]
    f = _frame(_render(tmp_path, b, item, fx, kf), 0.85)
    assert f[H // 2, W // 2][0] > 200  # screen of red over gray, centre unmasked


@ff
def test_reverse(tmp_path):
    b = tmp_path / "b.mp4"
    _lavfi(b, "color=c=black", vf="geq=lum='min(255,T*250)':cb=128:cr=128")
    fwd = _frame(_render(tmp_path, b, ITEM, []), 0.2)[H // 2, W // 2][0]
    rev_out = _render(tmp_path, b, ITEM, [{"target": "broll:x1", "reverse": True}])
    rev_a = _frame(rev_out, 0.2)[H // 2, W // 2][0]
    rev_b = _frame(rev_out, 0.8)[H // 2, W // 2][0]
    assert fwd < 60
    # local 0.1 s → source 0.8 − 0.1 − 1/30 ≈ 0.667 s; local 0.7 s → ≈ 0.067 s
    assert abs(rev_a - 0.667 * 250) < 20, rev_a
    assert rev_b < 40, rev_b


def test_normalize_and_mask_model():
    rows = normalize_layer_fx([
        {"target": "broll:a", "mask": {"shape": "ellipse", "x": 500, "feather": -3}, "blend": "normal"},
        {"target": "broll:b", "key": {"color": "#00FF00"}, "blend": "screen", "reverse": True},
        {"target": "bad target"}, {"target": "broll:c"},
    ])
    assert [r["target"] for r in rows] == ["broll:a", "broll:b"]
    assert rows[0]["mask"]["x"] == 150 and rows[0]["mask"]["feather"] == 0 and "blend" not in rows[0]
    assert rows[1]["key"] == {"color": "#00ff00", "sim": 40, "blend": 10, "spill": 50}
    m = {"shape": "rect", "x": 0, "y": 0, "w": 10, "h": 10, "rot": 0, "feather": 0,
         "keys": [{"ms": 0, "x": 0, "y": 0, "w": 10, "h": 10, "rot": 0, "feather": 0},
                  {"ms": 1000, "x": 100, "y": 0, "w": 10, "h": 10, "rot": 0, "feather": 0}]}
    assert mask_geom_at(m, 149)["x"] == pytest.approx(10)
    assert mask_geom_at(m, 150)["x"] == pytest.approx(10)
    assert mask_geom_at(m, 200)["x"] == pytest.approx(20)
    a = mask_alpha("ellipse", {"x": 50, "y": 50, "w": 50, "h": 50, "rot": 0, "feather": 0}, False, 160, 160)
    assert a[80, 80] == 255 and a[2, 2] == 0
    assert chroma_params({"color": "#0000ff", "sim": 0, "blend": 0, "spill": 100})["despill"]["type"] == 1
