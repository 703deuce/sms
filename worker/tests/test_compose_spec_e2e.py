"""End-to-end compose spec render (T4.7 §4)."""
from __future__ import annotations

import json
import os
import subprocess
import tempfile
from pathlib import Path
from unittest.mock import patch

import numpy as np
import pytest

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "new-app" / "tests" / "fixtures" / "compose"


def _ffmpeg_testsrc(dest: Path, w: int = 1920, h: int = 1080, dur: float = 4.0) -> None:
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            f"color=c=0x00C853:s={w}x{h}:d={dur},drawbox=x=0:y=0:w={w}:h={h}:color=magenta@1:t=24",
            "-f",
            "lavfi",
            "-i",
            "sine=f=440:duration=4",
            "-shortest",
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-crf",
            "18",
            "-c:a",
            "aac",
            str(dest),
        ],
    )


def _frame_at(path: Path, t: float, dest: Path) -> None:
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-ss",
            f"{t:.3f}",
            "-i",
            str(path),
            "-frames:v",
            "1",
            str(dest),
        ],
    )


def _green_band_rows(img: np.ndarray) -> tuple[int, int]:
    g = img[:, :, 1].astype(np.int16)
    r = img[:, :, 0]
    b = img[:, :, 2]
    # Foreground video uses full-brightness green; blurred fill is darkened (~0.92).
    mask = (g > 200) & (r < 120) & (b < 120)
    rows = np.where(mask.sum(axis=1) >= img.shape[1] * 0.9)[0]
    if rows.size == 0:
        return 0, 0
    return int(rows[0]), int(rows[-1]) + 1


@pytest.fixture
def compose_env(monkeypatch):
    monkeypatch.setenv("EXPORT_COMPOSE_SPEC", "1")
    monkeypatch.setenv("CLIPS_STRICT_COMPOSE", "1")


@pytest.mark.parametrize("clip", ["clipA", "clipB"])
def test_compose_spec_render_edited_clip(compose_env, monkeypatch, clip: str):
    edits = json.loads((FIXTURES / f"{clip}.edits.json").read_text())
    spec = json.loads((FIXTURES / f"{clip}.spec.json").read_text())
    trim_in = int(edits["trim"]["in"])
    trim_out = int(edits["trim"]["out"])
    words = [{"w": f"word{i}", "s": trim_in + i * 400, "e": trim_in + i * 400 + 350, "i": i} for i in range(9)]

    from clips_worker.edits_render import render_edited_clip

    def _no_speakercrop(*_a, **_k):
        raise AssertionError("speakercrop must not run for compose spec jobs")

    monkeypatch.setattr("clips_worker.edits_render.run_speakercrop_layout_timeline", _no_speakercrop)

    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        src = td_path / "src.mp4"
        out = td_path / "out.mp4"
        _ffmpeg_testsrc(src)
        log = []
        with patch("builtins.print", side_effect=lambda *a, **k: log.append(" ".join(str(x) for x in a))):
            render_edited_clip(
                src,
                out,
                words,
                edits,
                trim_in,
                trim_out,
                {"aspectRatio": "9:16", "exportResolution": "1080p", "layout": "speaker_follow"},
                td_path,
                compose_spec=spec,
            )
        assert out.is_file()
        assert any("[clipper:compose_spec] applied" in line for line in log)
        assert not any("fallback" in line and "compose_spec" in line for line in log)
        for t in (0.5, 1.0):
            png = td_path / f"f_{t}.png"
            _frame_at(out, t, png)
            import PIL.Image

            img = np.array(PIL.Image.open(png).convert("RGB"))
            vy0, vy1 = _green_band_rows(img)
            expect_y0 = spec["video"]["y"]
            expect_y1 = spec["video"]["y"] + spec["video"]["h"]
            assert abs(vy0 - expect_y0) <= 16, (t, vy0, expect_y0)
            assert abs(vy1 - expect_y1) <= 16, (t, vy1, expect_y1)
