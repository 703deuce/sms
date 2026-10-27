import subprocess
import tempfile
from pathlib import Path

from clips_worker.t2v.titles_ass import TextItem, build_ass, burn_ass, hex_to_ass_color


def test_hex_to_ass_color():
    assert hex_to_ass_color("#FACC15") == "&H0015CCFA"


def test_build_ass_contains_title_and_lower_third():
    ass = build_ass(
        [
            TextItem("title", "Hello", 0, 2000),
            TextItem("lower_third", "Jane Doe", 500, 2500, subtitle="CEO"),
        ],
        w=640,
        h=360,
    )
    assert "Style: Title" in ass
    assert "Hello" in ass
    assert "Jane Doe" in ass
    assert "CEO" in ass
    assert "PlayResX: 640" in ass
    assert "&H0015CCFA" in build_ass(
        [TextItem("title", "Brand", 0, 1000)],
        w=640,
        h=360,
        primary_color="#FACC15",
    )


def test_burn_ass_lavfi_under_10s():
    with tempfile.TemporaryDirectory() as td:
        d = Path(td)
        src = d / "src.mp4"
        subprocess.run(
            [
                "ffmpeg", "-y", "-v", "error",
                "-f", "lavfi", "-i", "color=c=black:s=640x360:d=2",
                "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
                "-shortest", "-c:v", "libx264", "-preset", "veryfast", "-crf", "28",
                "-c:a", "aac", str(src),
            ],
            check=True,
            capture_output=True,
        )
        ass_path = d / "t.ass"
        ass_path.write_text(build_ass([TextItem("title", "Hi", 0, 1500)], w=640, h=360))
        out = d / "out.mp4"
        burn_ass(src, ass_path, out)
        assert out.is_file() and out.stat().st_size > 1000
