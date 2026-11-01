from pathlib import Path

import pytest

from clips_worker.export_deliver import (
    DEFAULT,
    deliver_cmd,
    normalize_deliver,
    srt_slice,
)


def test_normalize_deliver_default_none():
    assert normalize_deliver(None) is None
    assert normalize_deliver({}) is None
    assert normalize_deliver({"format": "mp4", "codec": "h264", "quality": "standard", "fps": "source"}) is None


def test_deliver_cmd_h264_mp4():
    src = Path("/tmp/in.mp4")
    dest = Path("/tmp/out.mp4")
    cmd = deliver_cmd(src, dest, {"format": "mp4", "codec": "h264", "quality": "standard", "fps": "source"})
    assert "libx264" in cmd
    assert "-crf" in cmd and "23" in cmd
    assert "+faststart" in " ".join(cmd)


def test_deliver_cmd_hevc():
    cmd = deliver_cmd(Path("a.mp4"), Path("b.mp4"), {"format": "mp4", "codec": "hevc", "quality": "high"})
    assert "libx265" in cmd
    assert "hvc1" in cmd


def test_deliver_cmd_gif():
    cmd = deliver_cmd(Path("a.mp4"), Path("b.gif"), {"format": "gif", "fps": 12})
    joined = " ".join(cmd)
    assert "palettegen" in joined
    assert "fps=12" in joined


def test_deliver_cmd_mp3():
    cmd = deliver_cmd(Path("a.mp4"), Path("b.mp3"), {"format": "mp3"})
    assert "-vn" in cmd
    assert "libmp3lame" in cmd


def test_deliver_cmd_png_still():
    cmd = deliver_cmd(Path("a.mp4"), Path("b.png"), {"format": "png", "stillAtMs": 4200})
    assert "-frames:v" in cmd
    assert "1" in cmd


def test_srt_slice_shifts():
    body = "1\n00:00:02,000 --> 00:00:06,000\nHi\n\n"
    out = srt_slice(body, 2000, 6000)
    assert "00:00:00,000" in out
    assert "00:00:04,000" in out


def test_render_job_default_path_no_deliver_call():
    src = Path(__file__).resolve().parents[1].joinpath("clips_worker/render_job.py").read_text(encoding="utf-8")
    assert "if deliver_spec:" in src
    assert "run_deliver" in src


@pytest.mark.skipif(not Path("/usr/bin/ffmpeg").exists() and not __import__("shutil").which("ffmpeg"), reason="no ffmpeg")
def test_deliver_integration_smoke(tmp_path):
    import subprocess

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
            "testsrc=duration=2:size=320x180:rate=30",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440:duration=2",
            "-shortest",
            str(src),
        ]
    )
    from clips_worker.export_deliver import deliver, encoder_available

    if not encoder_available("libmp3lame"):
        pytest.skip("libmp3lame not available")
    out, ext, _ = deliver(src, tmp_path, {"format": "mp3"}, None)
    assert ext == "mp3"
    assert out.exists()
