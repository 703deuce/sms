from pathlib import Path
from unittest.mock import MagicMock, patch

from clips_worker.render_clip import run_speakercrop


@patch("subprocess.run")
def test_preserve_existing_crop_track_skips_crop_write(mock_run: MagicMock, tmp_path: Path) -> None:
    mock_run.return_value = MagicMock(returncode=0, stderr="", stdout="")
    clip = tmp_path / "clip.mp4"
    clip.write_bytes(b"\x00")
    words = tmp_path / "words.json"
    words.write_text("[]")
    out = tmp_path / "out.mp4"
    crop = tmp_path / "crop_track.json"
    crop.write_text('{"cropMethod":"subject_follow"}')

    run_speakercrop(
        clip,
        out,
        words,
        {"layout": "fit"},
        tmp_path,
        crop_track_out=None,
        preserve_existing_crop_track=True,
        no_render=True,
    )

    env = mock_run.call_args.kwargs["env"]
    assert env.get("WRITE_CROP_TRACK") == "0"
    assert "CROP_TRACK_OUT" not in env
    assert crop.read_text().startswith('{"cropMethod":"subject_follow"')
