"""EX-16 export stems zip."""
from __future__ import annotations

import json
import subprocess
import tempfile
import zipfile
from pathlib import Path

import pytest

from clips_worker.export_deliver import normalize_deliver
from clips_worker.export_stems import capture_stems_ctx, pack_stems_zip, wants_stems


def test_normalize_deliver_stems_flag():
    assert normalize_deliver({"stems": True}) == {
        "format": "mp4",
        "codec": "h264",
        "quality": "standard",
        "fps": "source",
        "stems": True,
    }
    assert normalize_deliver({}) is None


def test_wants_stems():
    assert wants_stems(None) is False
    assert wants_stems({"stems": True}) is True


@pytest.mark.skipif(not Path("/usr/bin/ffmpeg").exists() and not __import__("shutil").which("ffmpeg"), reason="no ffmpeg")
def test_pack_stems_zip_voice_and_music():
    with tempfile.TemporaryDirectory() as td:
        work = Path(td)
        speech = work / "speech.mp4"
        music = work / "music.mp3"
        subprocess.check_call(
            [
                "ffmpeg",
                "-y",
                "-v",
                "error",
                "-f",
                "lavfi",
                "-i",
                "color=c=black:s=320x240:d=4",
                "-f",
                "lavfi",
                "-i",
                "sine=frequency=880:duration=4",
                "-map",
                "0:v:0",
                "-map",
                "1:a:0",
                "-t",
                "4",
                "-c:v",
                "libx264",
                "-preset",
                "ultrafast",
                "-c:a",
                "aac",
                str(speech),
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
                "sine=frequency=220:duration=4",
                "-c:a",
                "libmp3lame",
                str(music),
            ],
        )
        ctx = capture_stems_ctx(
            video=speech,
            music_path=music,
            sfx_paths=[],
            length_s=4.0,
            volume=0.5,
            duck_depth=0.5,
            fade_in_s=0.0,
            fade_out_s=0.0,
        )
        zpath = work / "stems.zip"
        tracks = pack_stems_zip(ctx, work, zpath)
        assert "voice.wav" in tracks
        assert "music.wav" in tracks
        assert zpath.is_file()
        with zipfile.ZipFile(zpath) as zf:
            names = set(zf.namelist())
            assert "manifest.json" in names
            assert "voice.wav" in names
            assert "music.wav" in names
            manifest = json.loads(zf.read("manifest.json"))
            assert manifest["tracks"] == tracks
