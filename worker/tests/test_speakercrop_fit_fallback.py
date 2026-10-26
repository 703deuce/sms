from pathlib import Path
from unittest.mock import MagicMock, patch

from clips_worker.render_clip import run_speakercrop


def test_speakercrop_fit_fallback_records_meta_and_warns(tmp_path):
    clip = tmp_path / "in.mp4"
    clip.write_bytes(b"x")
    words = tmp_path / "w.json"
    words.write_text("[]")
    out = tmp_path / "out.mp4"
    meta: dict = {}

    fail = MagicMock(returncode=1, stderr="speakercrop boom", stdout="")
    with patch("clips_worker.render_clip.subprocess.run", return_value=fail):
        with patch("clips_worker.render_clip.ffmpeg_fit_export") as fit:
            with patch("builtins.print") as printed:
                run_speakercrop(
                    clip,
                    out,
                    words,
                    {"aspectRatio": "9:16", "exportResolution": "720p", "captions": {"enabled": False}},
                    tmp_path,
                    render_id="rnd_test",
                    render_meta=meta,
                )
            fit.assert_called_once()
    assert meta.get("fit_fallback") is True
    assert "speakercrop boom" in meta.get("speakercrop_tail", "")
    warn_line = " ".join(str(c) for c in printed.call_args[0])
    assert "rnd_test" in warn_line
    assert "ffmpeg_fit_export" in warn_line
