"""Headless EGL shader cut transitions (TR-SHADER batch 1)."""
from __future__ import annotations

import os
import select
import subprocess
import struct
import time
from pathlib import Path

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


def _read_exact(stream, nbytes: int, deadline: float) -> bytes:
    buf = bytearray()
    fd = stream.fileno()
    while len(buf) < nbytes:
        if time.monotonic() >= deadline:
            raise ShaderRenderError("wall_clock_timeout")
        wait = min(1.0, max(0.0, deadline - time.monotonic()))
        ready, _, _ = select.select([stream], [], [], wait)
        if not ready:
            continue
        try:
            chunk = os.read(fd, nbytes - len(buf))
        except BlockingIOError:
            continue
        if not chunk:
            raise ShaderRenderError("short_input")
        buf.extend(chunk)
    return bytes(buf)


def _write_all(stream, data: bytes, deadline: float) -> None:
    offset = 0
    total = len(data)
    fd = stream.fileno()
    while offset < total:
        if time.monotonic() >= deadline:
            raise ShaderRenderError("wall_clock_timeout")
        wait = min(1.0, max(0.0, deadline - time.monotonic()))
        _, wready, _ = select.select([], [stream], [], wait)
        if not wready:
            continue
        try:
            n = os.write(fd, data[offset:])
        except BlockingIOError:
            continue
        except BrokenPipeError as exc:
            raise ShaderRenderError("encode_pipe_closed") from exc
        if n == 0:
            raise ShaderRenderError("encode_pipe_closed")
        offset += n


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
    pa = subprocess.Popen(a_cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    pb = subprocess.Popen(b_cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    enc = subprocess.Popen(
        [
            "ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}",
            "-r", str(MOTION_FPS), "-i", "pipe:", "-c:v", "ffv1", "-level", "3", str(out_path),
        ],
        stdin=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )
    os.set_blocking(pa.stdout.fileno(), False)
    os.set_blocking(pb.stdout.fileno(), False)
    os.set_blocking(enc.stdin.fileno(), False)
    deadline = time.monotonic() + shader_window_timeout_sec()
    prog = program(ctx, shader_type)
    ratio = w / h
    fbo = ctx.framebuffer(color_attachments=[ctx.texture((w, h), 3)])
    quad = ctx.buffer(struct.pack("8f", -1, -1, 1, -1, -1, 1, 1, 1))
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
            _write_all(enc.stdin, bytes(raw[h - 1 :: -1]), deadline)
        enc.stdin.close()
    finally:
        for p in (pa, pb, enc):
            if p.stdin:
                try:
                    p.stdin.close()
                except OSError:
                    pass
            if p.stdout:
                try:
                    p.stdout.close()
                except OSError:
                    pass
            p.kill()
            try:
                p.wait(timeout=5)
            except subprocess.TimeoutExpired:
                p.kill()
                p.wait(timeout=2)
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
