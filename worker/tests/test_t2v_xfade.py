import shutil
import subprocess
from pathlib import Path

import pytest

from clips_worker.t2v.assemble import Scene, SceneMedia, probe_duration, xfade_chain, xfade_filter


def test_xfade_filter_offsets_at_scene_boundaries():
    fc, label = xfade_filter([2.5, 2.5, 2.0], [("fade", 0.5), ("slideleft", 0.5)])
    assert label == "[vout]"
    assert "offset=2.000" in fc
    assert "offset=4.000" in fc
    assert "xfade=transition=slideleft" in fc


@pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg required")
def test_xfade_chain_lavfi_under_10s(tmp_path: Path):
    w, h, fps = 320, 180, 24
    clips = []
    for i in range(3):
        p = tmp_path / f"c{i}.mp4"
        subprocess.run(
            [
                "ffmpeg", "-y", "-v", "error", "-f", "lavfi",
                f"-i", f"testsrc2=s={w}x{h}:r={fps}:d=1.5",
                "-t", "1.5", "-pix_fmt", "yuv420p", str(p),
            ],
            check=True,
            capture_output=True,
        )
        clips.append(p)
    out = tmp_path / "out.mp4"
    xfade_chain(clips, [1.5, 1.5, 1.0], [("fade", 0.5), ("fade", 0.5)], out, fps)
    dur = probe_duration(out)
    assert 2.5 < dur <= 3.6
