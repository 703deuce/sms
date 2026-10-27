"""Brand intro/outro concat for T2V (lavfi sources, ≤10s total)."""
from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path

from clips_worker.brand_concat import concat_brand_bookends
from clips_worker.t2v.brand_bookends import brand_keys_from_settings


def _lavfi_mp4(path: Path, dur: float, color: str = "red") -> None:
    subprocess.run(
        [
            "ffmpeg", "-y", "-v", "error",
            "-f", "lavfi", "-i", f"color=c={color}:s=320x180:d={dur:.2f}",
            "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
            "-shortest", "-c:v", "libx264", "-preset", "veryfast", "-crf", "28", "-c:a", "aac",
            str(path),
        ],
        check=True,
        capture_output=True,
    )


def test_brand_keys_from_settings():
    assert brand_keys_from_settings({}) == (None, None)
    keys = brand_keys_from_settings(
        {"brand": {"introVideoKey": "i.mp4", "outroVideoKey": "o.mp4", "useOutro": False}}
    )
    assert keys == ("i.mp4", None)


def test_concat_brand_bookends_lavfi():
    with tempfile.TemporaryDirectory() as td:
        d = Path(td)
        intro, main, outro = d / "intro.mp4", d / "main.mp4", d / "outro.mp4"
        out = d / "final.mp4"
        _lavfi_mp4(intro, 1.0, "blue")
        _lavfi_mp4(main, 2.0, "green")
        _lavfi_mp4(outro, 1.0, "yellow")
        concat_brand_bookends(main, out, intro, outro, 320, 180, d)
        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(out)],
            capture_output=True,
            text=True,
            check=True,
        )
        dur = float(probe.stdout.strip())
        assert 3.5 < dur < 4.5
