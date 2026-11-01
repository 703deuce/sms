"""CV-17c: adjustment layer mask/blend (layerFx target adjust:<id>)."""
from __future__ import annotations

import shutil
from pathlib import Path

import pytest

ff = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not installed")
W, H = 160, 96


def test_adjust_graph_skips_fx_layers_in_plain_loop(tmp_path: Path):
    from clips_worker.adjust_layers import adjust_graph

    edits = {
        "adjustLayers": [
            {"id": "plain", "startMs": 0, "endMs": 1000, "spec": {"adjust": {"exposure": 0.2}}},
            {"id": "fx", "startMs": 0, "endMs": 1000, "spec": {"adjust": {"contrast": 0.1}}},
        ],
        "layerFx": [
            {
                "target": "adjust:fx",
                "mask": {"shape": "ellipse", "x": 50, "y": 50, "w": 60, "h": 60, "rot": 0, "feather": 5},
                "blend": "screen",
            }
        ],
    }
    g = adjust_graph(edits, W, H, tmp_path)
    assert g is not None
    graph = g[0]
    assert "alphamerge" in graph
    assert "adj_fx_0" in graph or "xf0" in graph
    assert "al0" in graph or "lut3d" in graph


@ff
def test_apply_adjust_layers_with_mask(tmp_path: Path):
    import subprocess
    from clips_worker.adjust_layers import apply_adjust_layers

    src = tmp_path / "src.mp4"
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            f"testsrc2=s={W}x{H}:r=30:d=1",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-crf",
            "4",
            str(src),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    edits = {
        "adjustLayers": [{"id": "z", "startMs": 0, "endMs": 1000, "spec": {"adjust": {"saturation": 0.3}}}],
        "layerFx": [
            {"target": "adjust:z", "mask": {"shape": "rect", "x": 50, "y": 50, "w": 50, "h": 50, "rot": 0, "feather": 0}}
        ],
    }
    out = tmp_path / "adj.mp4"
    assert apply_adjust_layers(src, out, edits, W, H, tmp_path)
    assert out.stat().st_size > 500
