"""REGRESSION_BATCH1 worker tests (new file only)."""
from __future__ import annotations

from unittest.mock import patch

from clips_worker.export_deliver import deliver, deliver_cmd, encoder_available


def test_mp3_falls_back_to_m4a_when_lame_missing(tmp_path):
    src = tmp_path / "src.mp4"
    src.write_bytes(b"\x00" * 32)
    spec = {"format": "mp3", "codec": "h264", "quality": "standard", "fps": "source"}
    with patch("clips_worker.export_deliver.encoder_available", lambda name: name != "libmp3lame"):
        with patch("clips_worker.export_deliver.subprocess.check_call") as run:
            out, ext, ctype = deliver(src, tmp_path, spec, None)
    assert ext == "m4a"
    assert ctype == "audio/mp4"
    cmd = run.call_args[0][0]
    assert "aac" in cmd
    assert "libmp3lame" not in cmd


def test_soft_subtitle_mux_uses_mov_text():
    cmd = deliver_cmd(
        __import__("pathlib").Path("in.mp4"),
        __import__("pathlib").Path("out.mp4"),
        {"format": "mp4", "codec": "h264", "quality": "standard", "fps": "source", "softSubs": True},
        srt_path=__import__("pathlib").Path("subs.srt"),
    )
    joined = " ".join(cmd)
    assert "-c:s" in cmd
    assert "mov_text" in joined
    assert "language=eng" in joined or "language" in joined


def test_encoder_available_reads_ffmpeg_list():
    assert isinstance(encoder_available("libx264"), bool)
