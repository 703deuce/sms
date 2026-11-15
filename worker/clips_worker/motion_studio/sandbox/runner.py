"""Sandboxed scene runner (ST-SBX-001..007). Run as a separate process:

    python -m clips_worker.motion_studio.sandbox.runner <job.json>

job.json: {code_path, ctx_path, scratch, mode: render|stills|probe, width, height, f0, f1, out, crf,
           times, limits: {cpu_s, mem_mb, wall_s}, assets_dir}
Writes <scratch>/result_<tag>.json. The parent passes an environment with no keys, tokens or URLs.
Order matters: trusted imports, font warm-up and the encoder pipe happen BEFORE the audit hook; the
generated code runs after it, so it cannot open sockets, spawn processes, or read/write outside the
allowed roots. A violation raises inside the generated code and is reported as `sandbox_policy`.
"""
from __future__ import annotations

import json
import math
import os
import random
import resource
import sys
import time
import traceback


def _limits(lim: dict) -> None:
    mem = int(lim.get("mem_mb", 2560)) * 1024 * 1024
    cpu = int(lim.get("cpu_s", 900))
    for res, val in ((resource.RLIMIT_AS, mem), (resource.RLIMIT_CPU, cpu), (resource.RLIMIT_FSIZE, 4 * 1024 ** 3),
                     (resource.RLIMIT_NOFILE, 512)):
        try:
            resource.setrlimit(res, (val, val))
        except (ValueError, OSError):
            pass


def main(job_path: str) -> int:
    job = json.load(open(job_path))
    scratch = os.path.realpath(job["scratch"])
    tag = job.get("tag", "x")
    result_path = os.path.join(scratch, f"result_{tag}.json")
    result: dict = {"ok": False, "tag": tag}
    t_start = time.time()
    enc = None
    try:
        _limits(job.get("limits") or {})
        import numpy as np
        import subprocess
        from PIL import Image

        from clips_worker.motion_studio.core import api, blocks
        from clips_worker.motion_studio.core.world import HOUSE, StudioFilm
        from clips_worker.motion_studio.core.camera import ensure_camera_hold
        from clips_worker.motion_studio.core.wordclock import WordClock
        from clips_worker.motion_studio.sandbox.policy import SAFE_BUILTINS, check_code
        from clips_worker.motion_studio.vendor.cinematic_skill import engine as E

        code = open(job["code_path"]).read()
        check_code(code)
        ctx_raw = json.load(open(job["ctx_path"]))
        W, H = int(job.get("width", 1920)), int(job.get("height", 1080))
        for role in ("cond", "label", "labelm", "mono", "serif", "hand"):
            E.resolve_typeface(role, ctx_raw.get("fonts_dir"))

        class Ctx:
            pass

        ctx = Ctx()
        for k in ("duration", "fps", "seed", "style", "lines", "words", "emphasis", "assets", "data", "scene"):
            setattr(ctx, k, ctx_raw.get(k))
        ctx.width, ctx.height = W, H
        ctx.palette = {k: blocks.hexrgb(v) for k, v in (ctx_raw.get("palette") or {}).items()}
        clock = WordClock(ctx_raw.get("words") or [])
        ctx.W = clock.W
        ctx.rand = random.Random(int(ctx_raw.get("seed") or 1))
        ctx.rgb = lambda name, default=(240, 240, 240): ctx.palette.get(name, default)
        look = blocks.look_from_style(ctx_raw.get("style"))
        ctx.film = lambda drift=1.0, wobble=1.0: StudioFilm(float(ctx_raw["duration"]), int(ctx_raw.get("fps", 30)), look, drift, wobble)
        # RE-11: stock maps for generated worlds (trusted helpers; files come from assets_dir / package).
        from clips_worker.motion_studio.core import stock as _stock
        from clips_worker.motion_studio.vendor.cinematic_skill.engine import GeoMap as _GeoMap
        _map_cache = {}
        ctx.maps = tuple(_stock.available_maps())
        ctx.world = ((ctx_raw.get("scene") or {}).get("world")
                     or (ctx_raw.get("style") or {}).get("world") or "")

        def _mapdata(name="world"):
            key = str(name or "world").lower()
            if key not in _map_cache:
                _map_cache[key] = _stock.load_map(key)
            return _map_cache[key]

        def _geo(name="world", K=20000, origin=(0, 0), look="explainer"):
            return _GeoMap(_mapdata(name), K, origin=origin, look=look)

        def _place(geomap, name):
            return geomap.place(name)

        def _ll(geomap, lat, lon):
            return _stock.geo_ll(geomap, float(lat), float(lon))

        ctx.geo, ctx.place, ctx.ll, ctx.map = _geo, _place, _ll, _mapdata

        mode = job.get("mode", "render")
        out = job.get("out")
        if mode == "render":
            out = os.path.realpath(out)
            if not out.startswith(scratch + os.sep):
                raise ValueError("output must be inside scratch")
            crf = str(job.get("crf", 22))
            preset = str(job.get("preset") or "fast")
            enc = subprocess.Popen(
                ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r",
                 str(ctx_raw.get("fps", 30)), "-i", "-", "-c:v", "libx264", "-preset", preset, "-crf", crf,
                 "-pix_fmt", "yuv420p", "-x264-params", "keyint=60:min-keyint=60:scenecut=0", "-movflags", "+faststart", out],
                stdin=subprocess.PIPE, env={"PATH": os.environ.get("PATH", "/usr/bin:/bin")})

        # ---- audit hook (cannot be removed once installed) ----
        allowed_read = [os.path.realpath(p) for p in (
            scratch, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
            sys.prefix, sys.base_prefix, "/usr/lib", "/usr/local/lib", "/usr/share/fonts", "/usr/local/share/fonts",
            "/etc/fonts", "/var/cache/fontconfig", "/app/v3/fonts", job.get("assets_dir") or scratch, "/dev/null", "/dev/urandom",
            "/proc/self",
        ) if p]
        armed = [False]

        def hook(event, args):
            if not armed[0]:
                return
            if event in ("socket.connect", "socket.bind", "socket.__new__", "socket.getaddrinfo", "subprocess.Popen",
                         "os.system", "os.exec", "os.posix_spawn", "os.spawn", "os.fork", "os.forkpty", "ctypes.dlopen",
                         "ctypes.dlsym", "os.putenv", "os.unsetenv", "os.kill", "os.chmod", "os.remove", "os.rename",
                         "os.rmdir", "shutil.rmtree", "urllib.Request", "webbrowser.open", "sys.addaudithook"):
                raise PermissionError(f"sandbox_policy: {event} blocked")
            if event == "open":
                path, mode_ = args[0], (args[1] or "r")
                if isinstance(path, int):
                    return
                p = os.path.realpath(os.fsdecode(path))
                writing = any(ch in str(mode_) for ch in "wax+") or (isinstance(mode_, int) and mode_ & (os.O_WRONLY | os.O_RDWR))
                if writing:
                    if not p.startswith(scratch + os.sep):
                        raise PermissionError("sandbox_policy: write outside scratch")
                elif not any(p == r or p.startswith(r + os.sep) for r in allowed_read):
                    raise PermissionError("sandbox_policy: read outside allowed roots")

        sys.addaudithook(hook)
        blocks.AUDIT_ON[0] = mode in ("stills", "probe") or bool(job.get("audit"))

        import builtins as _b
        import importlib as _il
        safe = {n: getattr(_b, n) for n in SAFE_BUILTINS if hasattr(_b, n)}
        safe["__build_class__"] = _b.__build_class__
        allowed_mods = {"math", "random", "numpy", "skia", "colorsys", "itertools", "functools", "statistics",
                        "dataclasses", "typing", "bisect", "collections"}

        def _imp(name, globals=None, locals=None, fromlist=(), level=0):
            root = name.split(".")[0]
            if name == "motion_core":
                return api
            if root not in allowed_mods:
                raise ImportError(f"sandbox_policy: import {name} blocked")
            return _il.import_module(name) if not fromlist else __import__(name, globals, locals, fromlist, level)
        safe["__import__"] = _imp
        # Pre-provide the same names the API reference says are in scope, so
        # `from motion_core import *` is not required to use skia.Rect / random / math / numpy.
        import numpy
        import skia
        ns = {"__builtins__": safe, "__name__": "generated_scene",
              "skia": skia, "random": random, "math": math, "numpy": numpy, "np": numpy}
        armed[0] = True
        exec(compile(code, "generated_scene.py", "exec"), ns)  # noqa: S102 (policy-checked, audited)
        film = ns["build_scene"](ctx)
        if not isinstance(film, StudioFilm):
            raise TypeError("build_scene must return ctx.film()")
        # Engine HOW: typography-only or custom scenes may omit film.cam; hold still.
        ensure_camera_hold(film, ctx_raw.get("duration") or getattr(film, "duration", 0) or 0)
        film.fade_in = film.fade_out = 0.0          # ST-RW-015: segments never fade
        film.duration = float(ctx_raw["duration"])
        r = E.Renderer(film, W, H)
        r.res.prep = __import__("pathlib").Path(job.get("assets_dir") or scratch)
        r.res.meta = ctx_raw.get("asset_meta") or {}
        blocks.per_frame_grain(r)
        maxk = int(HOUSE["max_motion_blur_subframes"])

        def frame(n):
            t = n / film.fps
            sp = film.screen_speed(t) * r.s
            k = int(max(1, min(maxk, math.ceil(sp / (6 * max(r.s, 0.5))))))
            if k == 1:
                img = r.draw_world(t).astype(np.float32)
            else:
                acc = np.zeros((H, W, 3), np.float32)
                for i in range(k):
                    acc += r.draw_world(t + (i / k - 0.5) * 0.5 / film.fps)
                img = acc / k
            return r.post(img, n)

        wall = float((job.get("limits") or {}).get("wall_s", 900))
        if mode == "render":
            f0, f1 = int(job["f0"]), int(job["f1"])
            for n in range(f0, f1):
                if time.time() - t_start > wall:
                    raise TimeoutError("sandbox_limit: wall clock")
                enc.stdin.write(np.ascontiguousarray(frame(n)).tobytes())
            armed[0] = False
            enc.stdin.close()
            rc = enc.wait()
            enc = None
            if rc != 0:
                raise RuntimeError(f"encoder exit {rc}")
            result["frames"] = f1 - f0
        elif mode == "stills":
            stills = []
            for t in job.get("times") or []:
                n = int(round(float(t) * film.fps))
                blocks.AUDIT.clear()
                img = frame(n)
                p = os.path.join(scratch, f"still_{tag}_{n:05d}.png")
                Image.fromarray(img).save(p)
                stills.append({"t": round(n / film.fps, 3), "path": p, "audit": list(blocks.AUDIT)})
            result["stills"] = stills
        armed[0] = False
        result["cues"] = film.all_cues() if job.get("cues") else []
        result["spotlightLint"] = film.spotlight_lint()
        result["ok"] = True
    except BaseException as exc:  # noqa: BLE001
        kind = "sandbox_policy" if "sandbox_policy" in str(exc) or exc.__class__.__name__ == "PolicyViolation" else (
            "sandbox_limit" if isinstance(exc, (MemoryError, TimeoutError)) or "sandbox_limit" in str(exc) else "sandbox_error")
        tb = traceback.extract_tb(exc.__traceback__)
        gen = [f"line {f.lineno}: {f.line}" for f in tb if f.filename == "generated_scene.py"]
        full = traceback.format_exception(type(exc), exc, exc.__traceback__)
        result.update({"ok": False, "errorKind": kind, "error": f"{exc.__class__.__name__}: {str(exc)[:600]}",
                       "generatedTrace": gen + [ln.rstrip() for ln in full][:80]})
        if enc is not None:
            try:
                enc.kill()
            except Exception:  # noqa: BLE001
                pass
    result["durationMs"] = int((time.time() - t_start) * 1000)
    with open(result_path, "w") as f:
        json.dump(result, f)
    return 0 if result["ok"] else 3


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
