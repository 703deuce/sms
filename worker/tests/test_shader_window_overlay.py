"""End-to-end ffmpeg overlay of a shader-window ffv1 clip onto cut.mp4."""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

from clips_worker.motion import MOTION_FPS, cut_transition_windows
from clips_worker.ffmpeg_util import probe_video_nb_frames
from clips_worker.motion_render import (
    build_cut_transition_cmd,
    shader_rendered_window_filter,
)

needs_ff = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg missing")


def _make_h264(path: Path, w: int, h: int, dur: float) -> None:
    subprocess.check_call(
        [
            "ffmpeg", "-y", "-v", "error",
            "-f", "lavfi", "-i", f"testsrc=s={w}x{h}:d={dur}:r={MOTION_FPS}",
            "-f", "lavfi", "-i", f"sine=f=440:d={dur}:sample_rate=48000",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", str(path),
        ],
        stdout=subprocess.DEVNULL,
    )


def _make_ffv1_window(path: Path, w: int, h: int, n: int) -> None:
    dur = n / MOTION_FPS
    subprocess.check_call(
        [
            "ffmpeg", "-y", "-v", "error",
            "-f", "lavfi", "-i", f"testsrc2=s={w}x{h}:d={dur}:r={MOTION_FPS}",
            "-c:v", "ffv1", "-level", "3", "-frames:v", str(n), str(path),
        ],
        stdout=subprocess.DEVNULL,
    )


@needs_ff
def test_shader_rendered_window_filter_overlay(tmp_path: Path) -> None:
    w, h = 320, 180
    full = tmp_path / "full.mp4"
    cut = tmp_path / "cut.mp4"
    _make_h264(full, w, h, 6.0)
    subprocess.check_call(
        [
            "ffmpeg", "-y", "-v", "error", "-i", str(full),
            "-filter_complex",
            "[0:v]trim=0:4.5,setpts=PTS-STARTPTS[v0];"
            "[0:a]atrim=0:4.5,asetpts=PTS-STARTPTS[a0];"
            "[0:v]trim=4.6:6,setpts=PTS-STARTPTS[v1];"
            "[0:a]atrim=4.6:6,asetpts=PTS-STARTPTS[a1];"
            "[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]",
            "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-c:a", "aac", str(cut),
        ],
        stdout=subprocess.DEVNULL,
    )
    segs = [(0, 4500), (4600, 6000)]
    trs = [{"srcMs": 4600, "type": "spin", "durMs": 1000}]
    wins = cut_transition_windows(segs, trs)
    assert len(wins) == 1
    win = wins[0]
    n = int(win["frames"])
    shader_mkv = tmp_path / "win_shader_0.mkv"
    _make_ffv1_window(shader_mkv, w, h, n)
    assert probe_video_nb_frames(shader_mkv) >= n

    out = tmp_path / "cut_transitions.mp4"
    cmd = build_cut_transition_cmd(
        cut, full, out, wins, 0, w, h, 6.0, rendered={0: shader_mkv},
    )
    proc = subprocess.run(cmd, capture_output=True, text=True)
    assert proc.returncode == 0, (proc.stderr or proc.stdout)[-2000:]
    assert out.is_file() and out.stat().st_size > 1000

    w0 = win["startFrame"] / MOTION_FPS
    fc = shader_rendered_window_filter(1, n, w, h, w0, "x0")
    assert f"trim=end_frame={n}" in fc
    assert f"setpts=PTS-STARTPTS+{w0:.6f}/TB" in fc


@needs_ff
def test_apply_cut_transitions_overlay_shader_fallback(monkeypatch, tmp_path: Path) -> None:
    from clips_worker.motion_render import apply_cut_transitions

    w, h = 320, 180
    full = tmp_path / "full.mp4"
    cut = tmp_path / "cut.mp4"
    _make_h264(full, w, h, 3.0)
    subprocess.check_call(
        [
            "ffmpeg", "-y", "-v", "error", "-i", str(full),
            "-filter_complex",
            "[0:v]trim=0:1,setpts=PTS-STARTPTS[v0];[0:a]atrim=0:1,asetpts=PTS-STARTPTS[a0];"
            "[0:v]trim=2:3,setpts=PTS-STARTPTS[v1];[0:a]atrim=2:3,asetpts=PTS-STARTPTS[a1];"
            "[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]",
            "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-c:a", "aac", str(cut),
        ],
        stdout=subprocess.DEVNULL,
    )
    segs = [(0, 1000), (2000, 3000)]
    trs = [{"srcMs": 2000, "type": "spin", "durMs": 400}]

    def fake_shader_windows(windows, full_render, clip_start_ms, full_dur, w, h, work_dir, render_meta):
        bad = work_dir / "win_shader_0.mkv"
        bad.write_bytes(b"\x00" * 128)
        return {0: bad}, 1, 0, "llvmpipe", []

    import clips_worker.shader_transitions as st

    monkeypatch.setattr(st, "render_shader_windows", fake_shader_windows)
    out = tmp_path / "out.mp4"
    meta: dict = {}
    assert apply_cut_transitions(cut, full, out, segs, trs, 0, work_dir=tmp_path, render_meta=meta)
    reasons = [e.get("reason") for e in meta.get("shader_fallback", [])]
    assert any("overlay_failed" in (r or "") or "short_mkv" in (r or "") for r in reasons)
    assert out.is_file() and out.stat().st_size > 500
