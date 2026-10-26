import subprocess
import tempfile
from pathlib import Path

from clips_worker.broll_render import apply_broll_overlays, build_broll_filtergraph


def test_broll_filtergraph_labels_and_trim():
    specs = [
        {"local_path": "/tmp/a.mp4", "start_s": 3.0, "end_s": 6.0, "duration_s": 3.0},
        {"local_path": "/tmp/b.mp4", "start_s": 8.0, "end_s": 11.0, "duration_s": 3.0},
    ]
    fc, extra, label = build_broll_filtergraph(specs, 720, 1280)
    assert "[0:v]format=yuv420p[base]" in fc
    assert "trim=0:3.000" in fc
    assert "overlay=0:0:enable='between(t,3.000,6.000)'" in fc
    assert label == "v1"
    assert extra.count("-stream_loop") == 2


def test_broll_overlay_renders_and_changes_pixels():
    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        base = td_path / "base.mp4"
        broll = td_path / "broll.mp4"
        out = td_path / "out.mp4"
        subprocess.check_call(
            [
                "ffmpeg",
                "-y",
                "-v",
                "error",
                "-f",
                "lavfi",
                "-i",
                "color=c=red:s=720x1280:d=10",
                "-f",
                "lavfi",
                "-i",
                "sine=f=440:d=10",
                "-shortest",
                "-c:v",
                "libx264",
                "-preset",
                "ultrafast",
                "-c:a",
                "aac",
                str(base),
            ],
        )
        subprocess.check_call(
            [
                "ffmpeg",
                "-y",
                "-v",
                "error",
                "-f",
                "lavfi",
                "-i",
                "testsrc=s=720x1280:d=8",
                "-c:v",
                "libx264",
                "-preset",
                "ultrafast",
                "-an",
                str(broll),
            ],
        )
        specs = [
            {
                "local_path": broll,
                "start_s": 3.0,
                "end_s": 6.0,
                "duration_s": 3.0,
            },
        ]
        apply_broll_overlays(base, out, specs, 720, 1280)
        assert out.is_file() and out.stat().st_size > 1000

        def frame_rgb(t: float) -> tuple[int, int, int]:
            raw = subprocess.check_output(
                [
                    "ffmpeg",
                    "-v",
                    "error",
                    "-ss",
                    f"{t:.3f}",
                    "-i",
                    str(out),
                    "-frames:v",
                    "1",
                    "-f",
                    "rawvideo",
                    "-pix_fmt",
                    "rgb24",
                    "-",
                ],
            )
            return raw[0], raw[1], raw[2]

        before = frame_rgb(1.0)
        during = frame_rgb(4.5)
        assert before != during, f"expected pixel change at overlay window, got {before} vs {during}"
