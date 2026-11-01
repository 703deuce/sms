"""Shader window decode must not EOF before N frames (cut near clip end)."""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

from clips_worker.motion import MOTION_FPS, cut_transition_windows
from clips_worker.motion_render import _window_inputs, window_decode_cmd
from clips_worker.shader_transitions import _read_exact, shader_window_timeout_sec

needs_ff = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg missing")


@needs_ff
def test_window_decode_near_clip_end(tmp_path):
    """Repro: cut in last segment — fast input seek + short -t used to yield short_input for Spin."""
    full = tmp_path / "full.mp4"
    subprocess.check_call(
        [
            "ffmpeg", "-y", "-v", "error",
            "-f", "lavfi", "-i", "testsrc=s=320x180:d=6:r=30",
            "-f", "lavfi", "-i", "sine=f=440:d=6:sample_rate=48000",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", str(full),
        ],
        stdout=subprocess.DEVNULL,
    )
    clip_start = 0
    # Keep segments: 0–4.5s and 4.6–6s (cut at 4.6s ≈ end-adjacent, like a late word removal).
    segs = [(0, 4500), (4600, 6000)]
    trs = [{"srcMs": 4600, "type": "spin", "durMs": 1000}]
    wins = cut_transition_windows(segs, trs)
    assert len(wins) == 1
    win = wins[0]
    _, _, full_dur = __import__("clips_worker.motion_render", fromlist=["probe_size_duration"]).probe_size_duration(full)
    a_s, b_s, a_pad, b_pad, span = _window_inputs(win, clip_start, full_dur)
    n = int(win["frames"])
    w, h = 320, 180
    need = w * h * 3
    deadline = __import__("time").monotonic() + shader_window_timeout_sec()
    for seek, pad in ((a_s, a_pad), (b_s, b_pad)):
        cmd = window_decode_cmd(full, seek, span, pad, n, w, h)
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        assert proc.stdout
        for _ in range(n):
            _read_exact(proc.stdout, need, deadline)
        proc.kill()
        proc.wait(timeout=5)


def test_window_inputs_runway_at_eof():
    win = {
        "frames": 30,
        "startFrame": 120,
        "cutMs": 4500,
        "w0Ms": 4000.0,
        "aEnd": 4500,
        "bStart": 4600,
    }
    a_s, b_s, _, _, span = _window_inputs(win, 0, 6.0)
    assert a_s <= 6.0 - span
    assert b_s <= 6.0 - span
