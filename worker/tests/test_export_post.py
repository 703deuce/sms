from pathlib import Path
from unittest.mock import patch

import pytest

from clips_worker.export_post import apply_export_post, scale_srt


def test_scale_srt_125():
    body = "1\n00:00:10,000 --> 00:00:12,000\nHi\n"
    out = scale_srt(body, 0.8)
    assert "00:00:08,000 --> 00:00:09,600" in out


def test_speed_filter_string_in_ffmpeg():
    td = Path("/tmp/export_post_test")
    td.mkdir(exist_ok=True)
    inp = td / "in.mp4"
    inp.write_bytes(b"fake")
    meta: dict = {"effective_edits_ms": 10000}
    edits = {"speed": 1.25}

    with patch("clips_worker.export_post.subprocess.check_call") as mock_call:
        with patch("clips_worker.export_post._probe_duration_sec", side_effect=[10.0, 8.0]):
            with patch("clips_worker.export_post._probe_fps", return_value=30.0):
                out, _ = apply_export_post(inp, td, edits, meta)
    assert mock_call.called
    args = mock_call.call_args[0][0]
    fc = args[args.index("-filter_complex") + 1]
    assert "setpts=PTS/1.25" in fc
    assert "atempo=1.25" in fc
    assert out.name == "export_post.mp4"


def test_fallback_returns_input():
    td = Path("/tmp/export_post_fallback")
    td.mkdir(exist_ok=True)
    inp = td / "in.mp4"
    inp.write_bytes(b"x")
    meta: dict = {}
    with patch("clips_worker.export_post.subprocess.check_call", side_effect=RuntimeError("boom")):
        with patch("clips_worker.export_post._probe_duration_sec", return_value=5.0):
            out, srt = apply_export_post(inp, td, {"speed": 1.5}, meta, srt_body="1\n")
    assert out == inp
    assert srt == "1\n"


def test_no_speed_no_op():
    td = Path("/tmp/export_post_noop")
    td.mkdir(exist_ok=True)
    inp = td / "in.mp4"
    inp.write_bytes(b"x")
    with patch("clips_worker.export_post.subprocess.check_call") as mock_call:
        out, _ = apply_export_post(inp, td, {}, {})
    assert out == inp
    mock_call.assert_not_called()
