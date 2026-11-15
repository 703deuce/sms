"""ST-CMH-014 seam gate: frame-exact handoff passes the strict thresholds on the ENCODED output; seeded faults fail."""
import os
import subprocess

import numpy as np
import pytest

from clips_worker.motion_studio.core import handoff as h


@pytest.fixture(scope="module")
def src(tmp_path_factory):
    d = tmp_path_factory.mktemp("seam")
    p = str(d / "src.mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=3", "-f", "lavfi",
                    "-i", "sine=d=3", "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-shortest", p], check=True)
    return p


def test_handoff_seams_pass_strict_thresholds(src, tmp_path):
    rec = h.render_handoff(h.HandoffSpec(clip_path=src, in_s=0.4, out_s=1.6, width=480, height=270, enter_s=0.5, exit_s=0.5),
                           str(tmp_path / "o.mp4"), str(tmp_path / "o.wav"))
    assert rec["decodeVerified"] and rec["seamPass"], rec["seamScores"]
    for k in ("enter", "exit"):
        assert rec["seamScores"][k]["psnr"] >= h.SEAM_THRESHOLDS["psnr"]
    assert rec["seamScores"]["enterRender"]["psnr"] == 99.0


def test_seeded_faults_fail(src, tmp_path):
    fr = h._decode_frames_at(src, [10, 11], 640, 360)
    a, b = fr[10], fr[11]
    assert not h._seam_ok(h._seam(a, b))                                     # grab one frame off
    crop = np.ascontiguousarray(np.pad(a, ((0, 0), (2, 0), (0, 0)), mode="edge")[:, :640])
    assert not h._seam_ok(h._seam(a, crop))                                  # 2 px crop mismatch
    grade = np.clip(a.astype(np.int16) + 6, 0, 255).astype(np.uint8)
    assert not h._seam_ok(h._seam(a, grade))                                 # grade mismatch
    blur = ((a[:-1].astype(np.uint16) + a[1:]) // 2).astype(np.uint8)
    assert not h._seam_ok(h._seam(a[:-1], blur))                             # resampled / filtered seam
    assert os.path.exists(src)
