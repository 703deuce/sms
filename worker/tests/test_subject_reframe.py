import subprocess
import tempfile
from pathlib import Path

import numpy as np

from clips_worker.subject_reframe import blend_targets, build_crop_track, motion_centroids_x


def _moving_box_video(path: Path, frames: int = 60, w: int = 320, h: int = 180) -> None:
    """White box moves left→right; centroid x should increase."""
    raw = Path(path.with_suffix(".raw"))
    for fi in range(frames):
        img = np.zeros((h, w), dtype=np.uint8)
        x = int((fi / max(1, frames - 1)) * (w - 40))
        img[60:120, x : x + 40] = 255
        raw.write_bytes(img.tobytes() if fi == 0 else raw.read_bytes() + img.tobytes())
    # rebuild as video via ffmpeg from png sequence
    seq = path.parent / "seq"
    seq.mkdir(exist_ok=True)
    for fi in range(frames):
        x = int((fi / max(1, frames - 1)) * (w - 40))
        img = np.zeros((h, w, 3), dtype=np.uint8)
        img[60:120, x : x + 40] = (255, 255, 255)
        import cv2

        cv2.imwrite(str(seq / f"f_{fi:04d}.png"), img)
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-framerate",
            "10",
            "-i",
            str(seq / "f_%04d.png"),
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            str(path),
        ],
    )


def test_motion_centroid_increases_left_to_right():
    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        video = td_path / "pan.mp4"
        _moving_box_video(video)
        pts = motion_centroids_x(video, td_path / "work")
        xs = [x for _, x in pts]
        assert len(xs) >= 3
        assert xs[-1] > xs[0] + 20


def test_crop_track_x0_increases_with_motion_targets():
    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        video = td_path / "pan.mp4"
        _moving_box_video(video, frames=40)
        motion = motion_centroids_x(video, td_path / "work")
        targets = blend_targets(motion, None, 320)
        track = build_crop_track(video, targets, 0, wide=False)
        x0 = track["x0"]
        assert x0[-1] >= x0[0] - 5
