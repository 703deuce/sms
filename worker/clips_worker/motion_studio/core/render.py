"""Part 1 / ST-BLK-20, ST-RW-013/014: parallel chunk render -> lossless join -> frame parity -> atomic write.

Each chunk runs in its own sandbox process (sandbox/runner.py) with a stripped environment (no keys).
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from clips_worker.motion_studio.sandbox.policy import PolicyViolation, check_code

APP_ROOT = str(Path(__file__).resolve().parents[3])   # dir that contains clips_worker/


class SandboxError(Exception):
    def __init__(self, kind: str, message: str, trace: list[str] | None = None):
        super().__init__(message)
        self.kind = kind
        self.trace = trace or []


def sandbox_env(scratch: str) -> dict:
    """ST-SBX-003: no keys, tokens, cookies or URLs reach generated code."""
    return {
        "PATH": "/usr/local/bin:/usr/bin:/bin",
        "PYTHONPATH": APP_ROOT,
        "HOME": scratch,
        "TMPDIR": scratch,
        "OMP_NUM_THREADS": "1",
        "OPENBLAS_NUM_THREADS": "1",
        "MKL_NUM_THREADS": "1",
        "FONTCONFIG_PATH": "/etc/fonts",
        "XDG_CACHE_HOME": scratch,
        "PYTHONDONTWRITEBYTECODE": "1",
        "LANG": "C.UTF-8",
    }


def default_limits() -> dict:
    return {
        "cpu_s": int(os.environ.get("MOTION_STUDIO_SANDBOX_CPU_S", "1200")),
        "mem_mb": int(os.environ.get("MOTION_STUDIO_SANDBOX_MEM_MB", "2560")),
        "wall_s": int(os.environ.get("MOTION_STUDIO_SANDBOX_WALL_S", "900")),
    }


def render_workers() -> int:
    try:
        n = int(os.environ.get("MOTION_STUDIO_RENDER_WORKERS", "0"))
    except ValueError:
        n = 0
    if n <= 0:
        n = max(1, min(6, (os.cpu_count() or 2) - 2))
    return n


def _spawn(job: dict, scratch: str) -> subprocess.Popen:
    jp = os.path.join(scratch, f"job_{job['tag']}.json")
    with open(jp, "w") as f:
        json.dump(job, f)
    return subprocess.Popen([sys.executable, "-m", "clips_worker.motion_studio.sandbox.runner", jp],
                            cwd=scratch, env=sandbox_env(scratch), stdout=subprocess.PIPE, stderr=subprocess.STDOUT)


def _collect(procs: list[tuple[dict, subprocess.Popen]], scratch: str, wall_s: int) -> list[dict]:
    out = []
    deadline = time.time() + wall_s + 60
    for job, p in procs:
        try:
            p.wait(timeout=max(1, deadline - time.time()))
        except subprocess.TimeoutExpired:
            p.kill()
            raise SandboxError("sandbox_limit", "wall clock exceeded") from None
        rp = os.path.join(scratch, f"result_{job['tag']}.json")
        if not os.path.exists(rp):
            tail = (p.stdout.read() if p.stdout else b"")[-1500:].decode("utf-8", "replace")
            killed = p.returncode is not None and p.returncode < 0
            raise SandboxError("sandbox_limit" if killed else "sandbox_error", f"runner exited {p.returncode}: {tail}")
        res = json.load(open(rp))
        if not res.get("ok"):
            raise SandboxError(res.get("errorKind", "sandbox_error"), res.get("error", "failed"), res.get("generatedTrace"))
        out.append(res)
    return out


def write_inputs(scratch: str, code: str, ctx: dict) -> tuple[str, str]:
    cp, xp = os.path.join(scratch, "scene.py"), os.path.join(scratch, "ctx.json")
    Path(cp).write_text(code)
    Path(xp).write_text(json.dumps(ctx))
    return cp, xp


def probe_stills(code: str, ctx: dict, scratch: str, times: list[float], width=960, height=540, assets_dir=None) -> dict:
    """Low-res stills + text audit + cue list: the cheap check used by the fix loop before a full render."""
    try:
        check_code(code)
    except PolicyViolation as exc:
        raise SandboxError("sandbox_policy", str(exc)) from None
    cp, xp = write_inputs(scratch, code, ctx)
    lim = default_limits()
    lim["wall_s"] = min(lim["wall_s"], 240)
    job = {"tag": "probe", "code_path": cp, "ctx_path": xp, "scratch": scratch, "mode": "stills", "width": width,
           "height": height, "times": times, "limits": lim, "assets_dir": assets_dir or scratch, "cues": True}
    return _collect([(job, _spawn(job, scratch))], scratch, lim["wall_s"])[0]


def probe_video(path: str) -> dict:
    """Width, height, fps, pix_fmt, and frame count without decoding the stream.

    Prefers container ``nb_frames``, then a packet count (index read). Falls back to a
    full decode only when those are missing — ``-count_frames`` is far too slow to use
    on every assemble segment.
    """
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-count_packets",
                        "-show_entries", "stream=width,height,avg_frame_rate,r_frame_rate,pix_fmt,nb_frames,nb_read_packets,codec_name",
                        "-of", "json", path], capture_output=True, text=True)
    try:
        s = (json.loads(r.stdout) or {}).get("streams") or [{}]
        s = s[0] if s else {}
    except (json.JSONDecodeError, IndexError, TypeError):
        s = {}

    def _num(v):
        try:
            if v in (None, "", "N/A"):
                return None
            return int(v)
        except (TypeError, ValueError):
            return None

    def _fps(v):
        try:
            if not v or v in ("N/A", "0/0"):
                return None
            if "/" in str(v):
                a, b = str(v).split("/", 1)
                return float(a) / float(b) if float(b) else None
            return float(v)
        except (TypeError, ValueError, ZeroDivisionError):
            return None

    frames = _num(s.get("nb_frames")) or _num(s.get("nb_read_packets"))
    return {
        "width": _num(s.get("width")),
        "height": _num(s.get("height")),
        "fps": _fps(s.get("avg_frame_rate")) or _fps(s.get("r_frame_rate")),
        "pix_fmt": s.get("pix_fmt"),
        "codec": s.get("codec_name"),
        "frames": frames if frames is not None else -1,
    }


def ffprobe_frames(path: str) -> int:
    n = probe_video(path).get("frames", -1)
    if n and n > 0:
        return int(n)
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-count_frames", "-show_entries",
                        "stream=nb_read_frames", "-of", "csv=p=0", path], capture_output=True, text=True)
    try:
        return int(r.stdout.strip().split(",")[0])
    except ValueError:
        return -1


def segment_ready(src: str, frames: int, width: int, height: int, fps: int) -> bool:
    """True when the segment can be stream-copied into the picture (right size, fps, frames)."""
    info = probe_video(src)
    got_fps = info.get("fps") or 0
    return (info.get("frames") == frames and info.get("width") == width and info.get("height") == height
            and info.get("pix_fmt") == "yuv420p" and abs(float(got_fps) - fps) < 0.05)


def atomic_replace(tmp: str, final: str) -> None:
    os.replace(tmp, final)


def render_scene(code: str, ctx: dict, out_path: str, scratch: str, width=854, height=480, crf=22,
                 workers: int | None = None, assets_dir: str | None = None, preset: str = "fast") -> dict:
    """Render the whole scene in parallel chunks; returns {frames, cues, durationMs}. Raises SandboxError."""
    try:
        check_code(code)
    except PolicyViolation as exc:
        raise SandboxError("sandbox_policy", str(exc)) from None
    cp, xp = write_inputs(scratch, code, ctx)
    fps = int(ctx.get("fps", 30))
    n = int(round(float(ctx["duration"]) * fps))
    k = max(1, min(workers or render_workers(), n // 30 or 1))
    bounds = [n * i // k for i in range(k + 1)]
    lim = default_limits()
    t0 = time.time()
    procs = []
    for i in range(k):
        job = {"tag": f"c{i:03d}", "code_path": cp, "ctx_path": xp, "scratch": scratch, "mode": "render",
               "width": width, "height": height, "f0": bounds[i], "f1": bounds[i + 1], "crf": crf,
               "preset": preset, "out": os.path.join(scratch, f"chunk_{i:03d}.mp4"), "limits": lim,
               "assets_dir": assets_dir or scratch,
               "cues": i == 0}
        procs.append((job, _spawn(job, scratch)))
    results = _collect(procs, scratch, lim["wall_s"])
    lst = os.path.join(scratch, "chunks.txt")
    Path(lst).write_text("".join(f"file '{os.path.join(scratch, f'chunk_{i:03d}.mp4')}'\n" for i in range(k)))
    tmp = out_path + ".tmp.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy",
                    "-movflags", "+faststart", tmp], check=True)
    got = ffprobe_frames(tmp)
    if got != n:
        os.unlink(tmp)
        raise SandboxError("parity", f"frame parity failed: rendered {n}, muxed {got}")
    atomic_replace(tmp, out_path)
    cues = next((r.get("cues") for r in results if r.get("cues")), [])
    return {"frames": n, "cues": cues, "durationMs": int((time.time() - t0) * 1000), "workers": k,
            "spotlightLint": results[0].get("spotlightLint", [])}


def scratch_dir(prefix: str = "ms_") -> str:
    base = os.environ.get("MOTION_STUDIO_SCRATCH") or tempfile.gettempdir()
    os.makedirs(base, exist_ok=True)
    return tempfile.mkdtemp(prefix=prefix, dir=base)
