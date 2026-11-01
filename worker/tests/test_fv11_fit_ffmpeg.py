import subprocess

from clips_worker.render_clip import ffmpeg_fit_export


def _ffprobe_wh(path: str) -> tuple[int, int]:
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", path],
        text=True,
    ).strip()
    w, h = out.split(",")
    return int(w), int(h)


def test_ffmpeg_fit_export_219_and_43(tmp_path):
    src = tmp_path / "in.mp4"
    subprocess.check_call(
        ["ffmpeg", "-y", "-f", "lavfi", "-i", "testsrc=size=1280x720:d=0.3", "-pix_fmt", "yuv420p", str(src)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    out219 = tmp_path / "219.mp4"
    ffmpeg_fit_export(str(src), str(out219), 2520, 1080, blur_strength=None, canvas_bg_spec=None)
    assert _ffprobe_wh(str(out219)) == (2520, 1080)
    out43 = tmp_path / "43.mp4"
    ffmpeg_fit_export(str(src), str(out43), 960, 720, blur_strength=None, canvas_bg_spec=None)
    assert _ffprobe_wh(str(out43)) == (960, 720)
