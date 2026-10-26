import subprocess
import tempfile
from pathlib import Path

from clips_worker.brand_render import apply_brand_logo


def test_brand_logo_overlay_changes_corner_pixel():
    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        base = td_path / "base.mp4"
        logo = td_path / "logo.png"
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
                "color=c=blue:s=720x1280:d=2",
                "-f",
                "lavfi",
                "-i",
                "sine=f=440:d=2",
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
                "color=c=red:s=200x200",
                "-frames:v",
                "1",
                str(logo),
            ],
        )

        import sys
        from types import ModuleType

        def fake_download(_key, dest: Path):
            dest.write_bytes(logo.read_bytes())

        stub = ModuleType("clips_worker.storage")
        stub.download_object = fake_download
        with tempfile.TemporaryDirectory() as td2:
            work = Path(td2)
            sys.modules["clips_worker.storage"] = stub
            apply_brand_logo(
                base,
                out,
                "brand/ws_1/logo.png",
                {"logoPosition": "TR", "logoSizePct": 20, "logoOpacity": 1},
                work,
            )

        probe = subprocess.check_output(
            [
                "ffmpeg",
                "-v",
                "error",
                "-i",
                str(out),
                "-vf",
                "crop=8:8:712:0",
                "-frames:v",
                "1",
                "-f",
                "rawvideo",
                "-pix_fmt",
                "rgb24",
                "pipe:",
            ],
        )
        assert any(b > 0 for b in probe[0:3]), "expected non-blue pixels in top-right corner"
