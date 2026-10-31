"""E4 frame / audio parity on real ffmpeg output (prod is 5.1: run also with PATH=/path/to/ffmpeg-5.1:$PATH).

* color: lut3d (.cube from color.py) on solid patches == apply_look (the preview's SVG math)
* color: per-segment looks switch exactly at the source range edges (enable=)
* speed: export_post piecewise warp → duration Σ len/speed, pitch preserved (440 Hz stays 440 Hz)
* text: ASS box / fill burn where the preview puts them
"""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import numpy as np
import pytest

from clips_worker.color import COLOR_PRESETS, apply_full_render_color, apply_look, look_for_spec
from clips_worker.export_post import apply_export_post
from clips_worker.text_items import apply_text_items

pytestmark = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not installed")

W, H = 160, 96
PATCHES = [(220, 30, 30), (30, 200, 60), (30, 30, 220), (128, 128, 128), (240, 210, 170), (20, 25, 30)]
TOL = 7  # 8-bit yuv420p round trip + 33³ LUT interpolation


def run(cmd):
    subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def patch_video(path: Path, seconds: float = 1.0) -> None:
    pw = W // 3
    ph = H // 2
    draws = []
    for i, c in enumerate(PATCHES):
        x, y = (i % 3) * pw, (i // 3) * ph
        draws.append(f"drawbox=x={x}:y={y}:w={pw}:h={ph}:color=0x{c[0]:02X}{c[1]:02X}{c[2]:02X}:t=fill")
    run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"color=c=black:s={W}x{H}:r=30:d={seconds}",
         "-f", "lavfi", "-i", f"sine=frequency=440:sample_rate=48000:d={seconds}",
         "-vf", ",".join(draws), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "1", "-c:a", "aac", "-shortest", str(path)])


def frame_rgb(path: Path, t: float) -> np.ndarray:
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", str(path), "-frames:v", "1",
                                   "-f", "rawvideo", "-pix_fmt", "rgb24", "-"])
    return np.frombuffer(raw, np.uint8).reshape(H, W, 3).astype(float)


def centres():
    pw, ph = W // 3, H // 2
    return [((i % 3) * pw + pw // 2, (i // 3) * ph + ph // 2) for i in range(len(PATCHES))]


def check_look(src: Path, out: Path, spec, t: float):
    a, b = frame_rgb(src, t), frame_rgb(out, t)
    look = look_for_spec(spec)
    for x, y in centres():
        want = np.array(apply_look(look, a[y, x] / 255.0)) * 255
        got = b[y, x]
        assert np.max(np.abs(got - want)) <= TOL, (spec, a[y, x], want, got)


@pytest.mark.parametrize("preset", sorted(COLOR_PRESETS))
def test_lut_matches_look_math(tmp_path, preset):
    src = tmp_path / "src.mp4"
    patch_video(src, 0.4)
    edits = {"color": {"video": {"preset": preset}}}
    out = apply_full_render_color(src, edits, 0, 400, tmp_path)
    assert out != src
    check_look(src, out, {"preset": preset}, 0.1)


def test_adjust_sliders_match(tmp_path):
    src = tmp_path / "src.mp4"
    patch_video(src, 0.4)
    spec = {"preset": "film", "intensity": 60, "adjust": {"brightness": 12, "contrast": -20, "saturation": 30,
                                                          "temperature": -40, "tint": 25, "vibrance": 40}}
    out = apply_full_render_color(src, {"color": {"video": spec}}, 0, 400, tmp_path)
    check_look(src, out, spec, 0.2)


def test_segment_looks_switch_on_source_ranges(tmp_path):
    src = tmp_path / "src.mp4"
    patch_video(src, 1.0)
    # Clip starts at source 10 000 ms: [10 300, 10 600) is B&W, the rest Warm, [10 600, 10 800) exempt.
    edits = {"color": {"video": {"preset": "warm"}, "segments": [
        {"fromMs": 10300, "toMs": 10600, "spec": {"preset": "bw"}},
        {"fromMs": 10600, "toMs": 10800, "spec": {}},
    ]}}
    out = apply_full_render_color(src, edits, 10000, 11000, tmp_path)
    check_look(src, out, {"preset": "warm"}, 0.1)
    check_look(src, out, {"preset": "bw"}, 0.4)
    check_look(src, out, {}, 0.7)
    check_look(src, out, {"preset": "warm"}, 0.9)


def probe_dur(p: Path, stream: str = "v") -> float:
    out = subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", f"{stream}:0", "-show_entries",
                                   "stream=duration", "-of", "csv=p=0", str(p)], text=True).strip()
    return float(out)


def dominant_hz(p: Path, t0: float, t1: float) -> float:
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-ss", f"{t0:.3f}", "-t", f"{t1 - t0:.3f}", "-i", str(p),
                                   "-vn", "-ac", "1", "-ar", "48000", "-f", "f32le", "-"])
    x = np.frombuffer(raw, np.float32)
    spec = np.abs(np.fft.rfft(x * np.hanning(len(x))))
    return float(np.argmax(spec) * 48000 / len(x))


def test_speed_warp_duration_and_pitch(tmp_path):
    src = tmp_path / "src.mp4"
    patch_video(src, 4.0)
    pieces = [{"startMs": 0, "endMs": 1000, "speed": 1}, {"startMs": 1000, "endMs": 3000, "speed": 2},
              {"startMs": 3000, "endMs": 4000, "speed": 0.5}]
    meta = {"speed_warp": pieces, "effective_edits_ms": 4000, "expected_editor_ms": 4000}
    srt = "1\n00:00:01,000 --> 00:00:03,000\nhi\n\n2\n00:00:03,500 --> 00:00:04,000\nyo\n"
    out, new_srt = apply_export_post(src, tmp_path, {"segmentSpeeds": [{"fromMs": 1000, "toMs": 3000, "speed": 2}]},
                                     meta, srt_body=srt)
    assert out != src
    want = 1.0 + 1.0 + 2.0
    assert abs(probe_dur(out, "v") - want) <= 1 / 30 + 0.02
    assert abs(probe_dur(out, "a") - want) <= 0.06
    assert meta["effective_edits_ms"] == 4000 and meta["expected_editor_ms"] == 4000
    assert "00:00:01,000 --> 00:00:02,000" in new_srt and "00:00:03,000 --> 00:00:04,000" in new_srt
    # Pitch preserved in the 2× part (out 1.0–2.0 s) and the 0.5× part (out 2.0–4.0 s).
    assert abs(dominant_hz(out, 1.1, 1.9) - 440) < 8
    assert abs(dominant_hz(out, 2.2, 3.8) - 440) < 8


def test_speed_warp_then_global_speed(tmp_path):
    src = tmp_path / "src.mp4"
    patch_video(src, 2.0)
    meta = {"speed_warp": [{"startMs": 0, "endMs": 1000, "speed": 4}, {"startMs": 1000, "endMs": 2000, "speed": 1}],
            "effective_edits_ms": 2000}
    out, _ = apply_export_post(src, tmp_path, {"speed": 1.25}, meta, srt_body="")
    want = (0.25 + 1.0) / 1.25
    assert abs(probe_dur(out, "v") - want) <= 1 / 30 + 0.02
    assert meta["effective_edits_ms"] == round(1250 / 1.25)


def test_text_box_and_fill_burn(tmp_path):
    src = tmp_path / "black.mp4"
    run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "color=c=black:s=320x240:r=30:d=1",
         "-c:v", "libx264", "-pix_fmt", "yuv420p", str(src)])
    edits = {"textItems": [{"id": "t1", "text": "MMMM", "startMs": 200, "endMs": 800, "x": 50, "y": 50,
                            "style": {"font": "Montserrat", "size": 160, "color": "#FFFFFF", "align": "center",
                                      "case": "none", "box": {"color": "#FF0000", "opacity": 100, "pad": 40}}}]}
    out = apply_text_items(src, tmp_path / "t.mp4", edits, play_w=320, play_h=240)

    def px(t, x, y):
        raw = subprocess.check_output(["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", str(out), "-frames:v", "1",
                                       "-f", "rawvideo", "-pix_fmt", "rgb24", "-"])
        return np.frombuffer(raw, np.uint8).reshape(240, 320, 3)[y, x].astype(int)

    before = px(0.05, 160, 120)
    assert max(before) < 30  # not shown before startMs
    # Box padding area just above the glyphs (anchor centre ± pad) is red; the centre row hits text or box.
    pad_px = px(0.5, 160, 120 - 10 - 2)
    centre = px(0.5, 160, 120)
    assert centre.max() > 150
    assert pad_px[0] > 150 or pad_px.min() > 150
    after = px(0.9, 160, 120)
    assert max(after) < 30
