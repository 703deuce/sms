import subprocess
import tempfile
from pathlib import Path

from clips_worker.frame_sampler import sample_frames


def test_sample_frames_synthetic_30s():
    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        video = td_path / "clip.mp4"
        subprocess.check_call(
            [
                "ffmpeg",
                "-y",
                "-v",
                "error",
                "-f",
                "lavfi",
                "-i",
                "testsrc=duration=30:size=320x180:rate=30",
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                str(video),
            ],
        )
        frames = sample_frames(video, td_path / "frames", duration_s=30.0)
        assert len(frames) >= 20
