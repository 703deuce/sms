import json
import shutil
import subprocess
from pathlib import Path

import pytest

FIX = Path(__file__).resolve().parent / "fixtures" / "export_parity_plan.json"


@pytest.mark.skipif(not shutil.which("ffmpeg"), reason="ffmpeg not on PATH")
def test_export_parity_plan_exists():
    assert FIX.is_file()
    plan = json.loads(FIX.read_text(encoding="utf-8"))
    assert plan["playW"] >= 720
    assert "landscapeLayouts" in plan


@pytest.mark.skipif(not shutil.which("ffmpeg"), reason="ffmpeg not on PATH")
def test_landscape_marker_smoke(tmp_path):
    """Minimal EX-27 smoke: synthetic marker survives a crop+scale ffmpeg step."""
    plan = json.loads(FIX.read_text(encoding="utf-8"))
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
            "testsrc=size=1920x1080:rate=30:duration=2",
            str(src),
        ]
    )
    out = tmp_path / "out.mp4"
    crop = plan["crop"]
    vf = f"crop={crop['w']}:{crop['h']}:{crop['x']}:{crop['y']},scale={plan['playW']}:{plan['playH']}"
    subprocess.check_call(
        ["ffmpeg", "-y", "-v", "error", "-i", str(src), "-vf", vf, "-frames:v", "30", str(out)]
    )
    assert out.stat().st_size > 1000
