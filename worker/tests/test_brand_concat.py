import subprocess
import tempfile
from pathlib import Path

from clips_worker.brand_concat import concat_brand_bookends
from clips_worker.probe import probe_duration


def test_concat_duration_intro_main_outro():
    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        intro = td_path / "intro.mp4"
        main = td_path / "main.mp4"
        outro = td_path / "outro.mp4"
        for p, d in [(intro, 1.0), (main, 2.0), (outro, 1.0)]:
            subprocess.check_call(
                [
                    "ffmpeg",
                    "-y",
                    "-v",
                    "error",
                    "-f",
                    "lavfi",
                    "-i",
                    f"testsrc=s=320x240:d={d}",
                    "-f",
                    "lavfi",
                    "-i",
                    f"sine=f=440:d={d}",
                    "-shortest",
                    "-c:v",
                    "libx264",
                    "-c:a",
                    "aac",
                    str(p),
                ],
            )
        out = td_path / "out.mp4"
        concat_brand_bookends(main, out, intro, outro, 320, 240, td_path)
        total = probe_duration(out)
        assert abs(total - 4.0) <= 0.15
