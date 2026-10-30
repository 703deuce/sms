"""Generate / verify T6 template golden frames (SSIM >= 0.98)."""
from __future__ import annotations

import os
import subprocess
from pathlib import Path

import pytest

from clips_worker.t6_geometry import resolve_template_geometry
from clips_worker.t6_registry import TEMPLATE_IDS, TEMPLATES
from clips_worker.t6_render import extract_frame_png, render_template
from clips_worker.t6_signals import signals_or_defaults

GOLDEN_DIR = Path(__file__).resolve().parent / "golden"
SRC_DIR = GOLDEN_DIR / "src"
FRAMES_DIR = GOLDEN_DIR / "T"


def _ensure_sample_src() -> Path:
    SRC_DIR.mkdir(parents=True, exist_ok=True)
    out = SRC_DIR / "t6_sample.mp4"
    if out.is_file() and out.stat().st_size > 10_000:
        return out
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            "testsrc2=size=1920x1080:rate=30:duration=6",
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-pix_fmt",
            "yuv420p",
            str(out),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return out


def _ssim(a: Path, b: Path) -> float:
    from skimage.metrics import structural_similarity
    from skimage.io import imread

    img_a = imread(a)
    img_b = imread(b)
    if img_a.shape != img_b.shape:
        h = min(img_a.shape[0], img_b.shape[0])
        w = min(img_a.shape[1], img_b.shape[1])
        img_a = img_a[:h, :w]
        img_b = img_b[:h, :w]
    return float(structural_similarity(img_a, img_b, channel_axis=2 if img_a.ndim == 3 else None))


@pytest.mark.parametrize("template_id", TEMPLATE_IDS)
def test_template_golden_frame(template_id: str, tmp_path: Path):
    src = _ensure_sample_src()
    FRAMES_DIR.mkdir(parents=True, exist_ok=True)
    golden = FRAMES_DIR / f"T_{template_id}.png"
    signals = signals_or_defaults(
        {
            "clipType": TEMPLATES[template_id]["lane"],
            "facecamLayout": {"facecam": {"x": 0.75, "y": 0.02, "w": 0.22, "h": 0.25}, "confidence": 0.9},
            "signals": {
                "facecam_box": {"x": 0.75, "y": 0.02, "w": 0.22, "h": 0.25},
                "facecam_conf": 0.9,
                "action_box": {"x": 0.05, "y": 0.05, "w": 0.9, "h": 0.9},
                "type_conf": 0.9,
                "clip_type": TEMPLATES[template_id]["lane"],
            },
        }
    )
    edits = {
        "layout": {
            "template": {"id": template_id},
            "facecam": {"box": {"x": 0.75, "y": 0.02, "w": 0.22, "h": 0.25}},
        }
    }
    spec = resolve_template_geometry(TEMPLATES[template_id], signals, edits)
    rendered = tmp_path / f"{template_id}.mp4"
    render_template(src, rendered, spec, tmp_path, duration_s=6.0)
    actual = tmp_path / f"{template_id}.png"
    extract_frame_png(rendered, actual, t_s=2.0)
    if os.environ.get("UPDATE_GOLDEN") == "1" or not golden.is_file():
        golden.write_bytes(actual.read_bytes())
        pytest.skip("golden updated")
    score = _ssim(actual, golden)
    assert score >= 0.98, f"{template_id} SSIM {score:.4f}"
