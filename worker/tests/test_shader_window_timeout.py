"""Wall-clock timeouts for shader window ffmpeg pipes."""
from __future__ import annotations

import os
import subprocess
import threading
import time

import pytest

from clips_worker.ffmpeg_util import probe_video_nb_frames
from clips_worker.shader_transitions import (
    ShaderRenderError,
    _read_exact,
    _write_all,
    shader_window_timeout_sec,
)


def test_shader_window_timeout_sec_default(monkeypatch):
    monkeypatch.delenv("SHADER_WINDOW_TIMEOUT_SEC", raising=False)
    assert shader_window_timeout_sec() == 120.0


def test_shader_window_timeout_sec_env(monkeypatch):
    monkeypatch.setenv("SHADER_WINDOW_TIMEOUT_SEC", "45")
    assert shader_window_timeout_sec() == 45.0
    monkeypatch.setenv("SHADER_WINDOW_TIMEOUT_SEC", "bad")
    assert shader_window_timeout_sec() == 120.0
    monkeypatch.setenv("SHADER_WINDOW_TIMEOUT_SEC", "0")
    assert shader_window_timeout_sec() == 1.0


def test_read_exact_wall_clock_timeout():
    r_fd, w_fd = os.pipe()
    reader = os.fdopen(r_fd, "rb", buffering=0)
    try:
        deadline = time.monotonic() + 0.25
        with pytest.raises(ShaderRenderError, match="wall_clock_timeout"):
            _read_exact(reader, 1024, deadline)
    finally:
        os.close(w_fd)
        reader.close()


def test_read_exact_short_input():
    r_fd, w_fd = os.pipe()
    reader = os.fdopen(r_fd, "rb", buffering=0)
    writer = os.fdopen(w_fd, "wb", buffering=0)
    writer.write(b"abc")
    writer.close()
    deadline = time.monotonic() + 5.0
    with pytest.raises(ShaderRenderError, match="short_input"):
        _read_exact(reader, 1024, deadline)
    reader.close()


def test_write_all_wall_clock_timeout():
    r_fd, w_fd = os.pipe()
    os.set_blocking(r_fd, False)
    os.set_blocking(w_fd, False)
    reader = os.fdopen(r_fd, "rb", buffering=0)
    writer = os.fdopen(w_fd, "wb", buffering=0)
    try:
        deadline = time.monotonic() + 0.25
        with pytest.raises(ShaderRenderError, match="wall_clock_timeout"):
            _write_all(writer, b"x" * (1024 * 1024), deadline)
    finally:
        writer.close()
        reader.close()


def test_write_all_delivers_1280x720_frame_through_nonblocking_pipe():
    """Frame bytes exceed the kernel pipe buffer (~64 KiB); writer must loop partial writes."""
    frame_size = 1280 * 720 * 3
    payload = bytes((i % 256 for i in range(frame_size)))
    r_fd, w_fd = os.pipe()
    os.set_blocking(r_fd, False)
    os.set_blocking(w_fd, False)
    reader = os.fdopen(r_fd, "rb", buffering=0)
    writer = os.fdopen(w_fd, "wb", buffering=0)
    received = bytearray()

    def consume() -> None:
        fd = reader.fileno()
        while len(received) < frame_size:
            try:
                chunk = os.read(fd, 65536)
            except BlockingIOError:
                time.sleep(0.001)
                continue
            if not chunk:
                break
            received.extend(chunk)

    t = threading.Thread(target=consume, daemon=True)
    t.start()
    try:
        _write_all(writer, payload, time.monotonic() + 30.0)
    finally:
        writer.close()
    t.join(timeout=10)
    assert len(received) == frame_size
    assert bytes(received) == payload
    reader.close()


def test_ffv1_encode_720p_via_write_all(tmp_path):
    import shutil

    if shutil.which("ffmpeg") is None:
        pytest.skip("ffmpeg missing")
    w, h = 1280, 720
    n = 8
    frame_size = w * h * 3
    out = tmp_path / "pipe720.mkv"
    enc = subprocess.Popen(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgb24",
            "-s",
            f"{w}x{h}",
            "-r",
            "30",
            "-i",
            "pipe:",
            "-frames:v",
            str(n),
            "-c:v",
            "ffv1",
            "-level",
            "3",
            str(out),
        ],
        stdin=subprocess.PIPE,
        stderr=subprocess.PIPE,
        bufsize=0,
    )
    os.set_blocking(enc.stdin.fileno(), False)
    deadline = time.monotonic() + 60.0
    try:
        assert enc.stdin
        for _ in range(n):
            _write_all(enc.stdin, bytes((i % 256 for i in range(frame_size))), deadline)
        enc.stdin.close()
        rc = enc.wait(timeout=60)
        assert rc == 0, (enc.stderr.read() if enc.stderr else b"").decode("utf-8", "replace")
    finally:
        if enc.poll() is None:
            enc.kill()
            enc.wait(timeout=5)
    got = probe_video_nb_frames(out)
    assert got >= n
    assert out.stat().st_size > 50_000
