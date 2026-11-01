"""Wall-clock timeouts for shader window ffmpeg pipes."""
from __future__ import annotations

import os
import subprocess
import time

import pytest

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
