"""Headless EGL shader cut transitions (TR-SHADER batch 1)."""
from __future__ import annotations

import errno
import os
import select
import subprocess
import struct
import threading
import time
from pathlib import Path

from clips_worker.ffmpeg_util import probe_video_nb_frames, stderr_tail
from clips_worker.motion import MOTION_FPS, SHADER_TRANSITIONS, shader_progress
from clips_worker.motion_render import _window_inputs, window_decode_cmd

SHADER_DIR = Path(__file__).resolve().parent / "shaders"
SHADER_TYPES = tuple(sorted(SHADER_TRANSITIONS))
_PRELUDE_HEAD = (SHADER_DIR / "prelude_head.glsl").read_text(encoding="utf-8")
_PRELUDE_TAIL = (SHADER_DIR / "prelude_tail.glsl").read_text(encoding="utf-8")
_VERT = """
#version 300 es
in vec2 in_pos;
out vec2 vUv;
void main() {
  vUv = vec2((in_pos.x + 1.0) * 0.5, (1.0 - in_pos.y) * 0.5);
  gl_Position = vec4(in_pos, 0.0, 1.0);
}
"""


class ShaderUnavailable(Exception):
    pass


class ShaderRenderError(Exception):
    pass


def shader_window_timeout_sec() -> float:
    raw = os.environ.get("SHADER_WINDOW_TIMEOUT_SEC", "120")
    try:
        return max(1.0, float(raw))
    except ValueError:
        return 120.0


def _pipe_wait_read(fd: int, deadline: float) -> None:
    while time.monotonic() < deadline:
        wait = min(1.0, max(0.0, deadline - time.monotonic()))
        ready, _, _ = select.select([fd], [], [], wait)
        if ready:
            return
    raise ShaderRenderError("wall_clock_timeout")


def _pipe_wait_write(fd: int, deadline: float) -> None:
    while time.monotonic() < deadline:
        wait = min(1.0, max(0.0, deadline - time.monotonic()))
        _, ready, _ = select.select([], [fd], [], wait)
        if ready:
            return
    raise ShaderRenderError("wall_clock_timeout")


def _read_exact(stream, nbytes: int, deadline: float) -> bytes:
    buf = bytearray()
    fd = stream.fileno()
    while len(buf) < nbytes:
        _pipe_wait_read(fd, deadline)
        try:
            chunk = os.read(fd, nbytes - len(buf))
        except OSError as exc:
            if exc.errno in (errno.EAGAIN, errno.EINTR):
                continue
            raise
        except BlockingIOError:
            continue
        if not chunk:
            raise ShaderRenderError("short_input")
        buf.extend(chunk)
    return bytes(buf)


def _flip_gl_rgb24_bottom_up(raw: bytes | bytearray, w: int, h: int) -> bytes:
    """OpenGL read() returns bottom-up RGB24; convert to top-down for ffmpeg rawvideo."""
    row = w * 3
    need = row * h
    if len(raw) < need:
        raise ShaderRenderError(f"short_gl_read:{len(raw)}<{need}")
    data = bytes(raw[:need])
    out = bytearray(need)
    for y in range(h):
        src = (h - 1 - y) * row
        dst = y * row
        out[dst:dst + row] = data[src:src + row]
    return bytes(out)


def _write_all(stream, data: bytes | memoryview, deadline: float) -> None:
    mv = memoryview(data) if not isinstance(data, memoryview) else data
    offset = 0
    total = len(mv)
    fd = stream.fileno()
    while offset < total:
        _pipe_wait_write(fd, deadline)
        try:
            n = os.write(fd, mv[offset:])
        except OSError as exc:
            if exc.errno in (errno.EAGAIN, errno.EINTR):
                continue
            if exc.errno == errno.EPIPE:
                raise ShaderRenderError("encode_pipe_closed") from exc
            raise
        except BlockingIOError:
            continue
        except BrokenPipeError as exc:
            raise ShaderRenderError("encode_pipe_closed") from exc
        if n <= 0:
            raise ShaderRenderError("encode_pipe_closed")
        offset += n
    if offset != total:
        raise ShaderRenderError("short_write")


def _source(shader_type: str) -> str:
    body = (SHADER_DIR / f"{shader_type}.glsl").read_text(encoding="utf-8")
    return _PRELUDE_HEAD + body + _PRELUDE_TAIL


def gl_context():
    os.environ["EGL_PLATFORM"] = "surfaceless"
    os.environ["LP_NUM_THREADS"] = str(min(4, os.cpu_count() or 1))
    os.environ.pop("DISPLAY", None)
    import moderngl

    ctx = moderngl.create_standalone_context(backend="egl", require=330)
    info = ctx.info or {}
    renderer = str(info.get("GL_RENDERER") or "")
    if "llvmpipe" not in renderer.lower():
        ctx.release()
        raise ShaderUnavailable(f"renderer_not_llvmpipe:{renderer[:80]}")
    return ctx, renderer


def program(ctx, shader_type: str):
    if not hasattr(program, "_cache"):
        program._cache = {}
    key = (id(ctx), shader_type)
    if key in program._cache:
        return program._cache[key]
    src = _source(shader_type)
    prog = ctx.program(vertex_shader=_VERT, fragment_shader=src)
    program._cache[key] = prog
    return prog


def _stop_proc(p: subprocess.Popen | None, *, grace_s: float = 5.0) -> None:
    if p is None or p.poll() is not None:
        return
    if p.stdin and not p.stdin.closed:
        try:
            p.stdin.close()
        except OSError:
            pass
    try:
        p.wait(timeout=grace_s)
    except subprocess.TimeoutExpired:
        p.kill()
        try:
            p.wait(timeout=5)
        except subprocess.TimeoutExpired:
            p.kill()


def render_window(
    ctx,
    shader_type: str,
    a_cmd: list[str],
    b_cmd: list[str],
    n: int,
    w: int,
    h: int,
    out_path: Path,
) -> None:
    if w % 2 or h % 2:
        raise ShaderRenderError("odd_size")
    need = w * h * 3
    pa = subprocess.Popen(a_cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, bufsize=0)
    pb = subprocess.Popen(b_cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, bufsize=0)
    enc = subprocess.Popen(
        [
            "ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}",
            "-r", str(MOTION_FPS), "-i", "pipe:", "-c:v", "ffv1", "-level", "3", str(out_path),
        ],
        stdin=subprocess.PIPE,
        stderr=subprocess.PIPE,
        bufsize=0,
    )
    os.set_blocking(pa.stdout.fileno(), False)
    os.set_blocking(pb.stdout.fileno(), False)
    os.set_blocking(enc.stdin.fileno(), False)
    enc_stderr_tail: list[bytes] = []

    def _drain_enc_stderr() -> None:
        try:
            if enc.stderr:
                enc_stderr_tail.append(enc.stderr.read() or b"")
        except OSError:
            pass

    stderr_thread = threading.Thread(target=_drain_enc_stderr, daemon=True)
    stderr_thread.start()
    deadline = time.monotonic() + shader_window_timeout_sec()
    prog = program(ctx, shader_type)
    ratio = w / h
    fbo = ctx.framebuffer(color_attachments=[ctx.texture((w, h), 3)])
    # Default ModernGL VAO rendering uses TRIANGLES. Six vertices are required for
    # a full-screen rectangle; the old four-vertex buffer rendered only one triangle,
    # leaving a diagonal half-frame black during every shader transition.
    quad = ctx.buffer(struct.pack(
        "12f",
        -1, -1,  1, -1, -1,  1,
        -1,  1,  1, -1,  1,  1,
    ))
    vao = ctx.vertex_array(prog, [(quad, "2f", "in_pos")])
    tex_a = ctx.texture((w, h), 3)
    tex_b = ctx.texture((w, h), 3)
    tex_a.filter = (ctx.LINEAR, ctx.LINEAR)
    tex_b.filter = (ctx.LINEAR, ctx.LINEAR)
    try:
        assert pa.stdout and pb.stdout and enc.stdin
        for k in range(n):
            if time.monotonic() >= deadline:
                raise ShaderRenderError("wall_clock_timeout")
            fa = _read_exact(pa.stdout, need, deadline)
            fb = _read_exact(pb.stdout, need, deadline)
            tex_a.write(fa)
            tex_b.write(fb)
            prog["uFrom"].value = 0
            prog["uTo"].value = 1
            prog["progress"].value = shader_progress(k, n)
            prog["ratio"].value = ratio
            prog["uRes"].value = (float(w), float(h))
            tex_a.use(0)
            tex_b.use(1)
            fbo.use()
            vao.render()
            raw = fbo.read(components=3, alignment=1)
            frame = _flip_gl_rgb24_bottom_up(raw, w, h)
            if len(frame) != need:
                raise ShaderRenderError(f"short_gl_read:{len(frame)}<{need}")
            _write_all(enc.stdin, frame, deadline)
        enc.stdin.close()
        enc.stdin = None
        try:
            enc_rc = enc.wait(timeout=shader_window_timeout_sec())
        except subprocess.TimeoutExpired:
            enc.kill()
            enc.wait(timeout=5)
            raise ShaderRenderError("encode_timeout")
        stderr_thread.join(timeout=5)
        enc_err = enc_stderr_tail[0] if enc_stderr_tail else b""
        if enc_rc != 0:
            tail = stderr_tail(enc_err.decode("utf-8", "replace"), lines=12)
            raise ShaderRenderError(f"encode_failed:{tail[:240] or enc_rc}")
        got = probe_video_nb_frames(out_path)
        if got < n:
            raise ShaderRenderError(f"short_mkv:frames={got}<{n}")
    finally:
        for p in (pa, pb):
            if p.stdout:
                try:
                    p.stdout.close()
                except OSError:
                    pass
            _stop_proc(p)
        _stop_proc(enc, grace_s=2.0)
        fbo.release()
        tex_a.release()
        tex_b.release()
        vao.release()


def render_shader_windows(
    windows: list[dict],
    full_render: Path,
    clip_start_ms: int,
    full_dur_s: float,
    w: int,
    h: int,
    work_dir: Path,
    render_meta: dict | None,
) -> tuple[dict[int, Path], int, int, str, list[dict]]:
    rendered: dict[int, Path] = {}
    fb_meta: list[dict] = []
    shader_n = 0
    fallback_n = 0
    ctx, renderer = gl_context()
    try:
        for i, win in enumerate(windows):
            if win["type"] not in SHADER_TRANSITIONS:
                continue
            n = int(win["frames"])
            a_s, b_s, a_pad, b_pad, span = _window_inputs(win, clip_start_ms, full_dur_s)
            a_cmd = window_decode_cmd(full_render, a_s, span, a_pad, n, w, h)
            b_cmd = window_decode_cmd(full_render, b_s, span, b_pad, n, w, h)
            out_path = work_dir / f"win_shader_{i}.mkv"
            t0 = time.perf_counter()
            try:
                render_window(ctx, win["type"], a_cmd, b_cmd, n, w, h, out_path)
                rendered[i] = out_path
                shader_n += 1
                ms = int((time.perf_counter() - t0) * 1000)
                print(f"[clipper:transitions] shader_ok type={win['type']} win={i} ms={ms}", flush=True)
            except Exception as exc:  # noqa: BLE001
                fallback_n += 1
                reason = f"{type(exc).__name__}:{str(exc)[:120]}"
                fb_meta.append({"type": win["type"], "win": i, "reason": reason})
                print(f"[clipper:transitions] shader_fallback type={win['type']} win={i} reason={reason}", flush=True)
    finally:
        ctx.release()
    return rendered, shader_n, fallback_n, renderer, fb_meta
