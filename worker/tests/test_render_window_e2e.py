"""End-to-end render_window: GL shader + ffv1 mux must produce N frames."""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

from clips_worker.ffmpeg_util import probe_video_nb_frames
from clips_worker.motion import cut_transition_windows
from clips_worker.motion_render import _window_inputs, window_decode_cmd
from clips_worker.shader_transitions import gl_context, render_shader_windows, render_window

needs_ff = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg missing")


@needs_ff
def test_render_window_spin_shader_ok(tmp_path: Path) -> None:
    try:
        ctx, renderer = gl_context()
    except Exception as exc:
        pytest.skip(str(exc))
    assert "llvmpipe" in renderer.lower()

    w, h = 320, 180
    full = tmp_path / "full.mp4"
    subprocess.check_call(
        [
            "ffmpeg", "-y", "-v", "error",
            "-f", "lavfi", "-i", f"testsrc=s={w}x{h}:d=6:r=30",
            "-f", "lavfi", "-i", "sine=f=440:d=6:sample_rate=48000",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", str(full),
        ],
        stdout=subprocess.DEVNULL,
    )
    segs = [(0, 4500), (4600, 6000)]
    trs = [{"srcMs": 4600, "type": "spin", "durMs": 1000}]
    wins = cut_transition_windows(segs, trs)
    win = wins[0]
    n = int(win["frames"])
    full_dur = 6.0
    a_s, b_s, a_pad, b_pad, span = _window_inputs(win, 0, full_dur)
    a_cmd = window_decode_cmd(full, a_s, span, a_pad, n, w, h)
    b_cmd = window_decode_cmd(full, b_s, span, b_pad, n, w, h)
    out = tmp_path / "win_shader_0.mkv"
    try:
        render_window(ctx, "spin", a_cmd, b_cmd, n, w, h, out)
    finally:
        ctx.release()
    got = probe_video_nb_frames(out)
    assert got >= n, f"expected>={n} frames, got {got}"


@needs_ff
def test_render_window_spin_shader_ok_720p(tmp_path: Path) -> None:
    """Regression: non-blocking ffv1 stdin must write full 1280x720 rgb24 frames (>> pipe buffer)."""
    try:
        ctx, renderer = gl_context()
    except Exception as exc:
        pytest.skip(str(exc))
    assert "llvmpipe" in renderer.lower()

    w, h = 1280, 720
    full = tmp_path / "full_720.mp4"
    subprocess.check_call(
        [
            "ffmpeg", "-y", "-v", "error",
            "-f", "lavfi", "-i", f"testsrc=s={w}x{h}:d=6:r=30",
            "-f", "lavfi", "-i", "sine=f=440:d=6:sample_rate=48000",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", str(full),
        ],
        stdout=subprocess.DEVNULL,
    )
    segs = [(0, 4500), (4600, 6000)]
    trs = [{"srcMs": 4600, "type": "spin", "durMs": 1000}]
    wins = cut_transition_windows(segs, trs)
    win = wins[0]
    n = int(win["frames"])
    a_s, b_s, a_pad, b_pad, span = _window_inputs(win, 0, 6.0)
    a_cmd = window_decode_cmd(full, a_s, span, a_pad, n, w, h)
    b_cmd = window_decode_cmd(full, b_s, span, b_pad, n, w, h)
    out = tmp_path / "win_shader_720.mkv"
    try:
        render_window(ctx, "spin", a_cmd, b_cmd, n, w, h, out)
    finally:
        ctx.release()
    got = probe_video_nb_frames(out)
    assert got >= n, f"expected>={n} frames, got {got}"
    assert out.stat().st_size > n * 10_000, "ffv1 output suspiciously small (truncated encode?)"


@needs_ff
def test_render_shader_windows_spin_720p_shader_ok_no_fallback(tmp_path: Path, capsys) -> None:
    """Export path: render_shader_windows must log shader_ok and never shader_fallback at 1280×720."""
    try:
        ctx, renderer = gl_context()
        ctx.release()
    except Exception as exc:
        pytest.skip(str(exc))
    assert "llvmpipe" in renderer.lower()

    w, h = 1280, 720
    full = tmp_path / "full_720.mp4"
    subprocess.check_call(
        [
            "ffmpeg", "-y", "-v", "error",
            "-f", "lavfi", "-i", f"testsrc=s={w}x{h}:d=6:r=30",
            "-f", "lavfi", "-i", "sine=f=440:d=6:sample_rate=48000",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", str(full),
        ],
        stdout=subprocess.DEVNULL,
    )
    segs = [(0, 4500), (4600, 6000)]
    trs = [{"srcMs": 4600, "type": "spin", "durMs": 1000}]
    wins = cut_transition_windows(segs, trs)
    rendered, shader_n, fallback_n, _renderer, fb_meta = render_shader_windows(
        wins, full, 0, 6.0, w, h, tmp_path, None,
    )
    assert shader_n == 1, f"expected one shader window, got shader_n={shader_n}"
    assert fallback_n == 0, f"expected no fallback, got fallback_n={fallback_n} meta={fb_meta}"
    assert len(rendered) == 1
    got = probe_video_nb_frames(next(iter(rendered.values())))
    n = int(wins[0]["frames"])
    assert got >= n, f"expected>={n} frames, got {got}"
    captured = capsys.readouterr()
    combined = captured.out + captured.err
    assert "shader_ok" in combined
    assert "shader_fallback" not in combined


def test_communicate_after_stdin_close_raises():
    """Document why render_window uses wait() instead of communicate() after stdin.close()."""
    enc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "nullsrc=s=16x16:d=0.1", "-frames:v", "1", "-f", "null", "-"],
        stdin=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    assert enc.stdin
    enc.stdin.close()
    with pytest.raises(ValueError, match="flush of closed file"):
        enc.communicate(timeout=5)
    enc.kill()
    enc.wait(timeout=5)
