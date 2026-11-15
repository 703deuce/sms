"""RE-1 setup check for Motion Studio render boxes: `python -m clips_worker.motion_studio.check_setup [--json] [--no-render]`.

Checks: python deps (skia-python >= 87.6, numpy, pillow, scipy, librosa), ffmpeg/ffprobe with libx264 + loudnorm +
sidechaincompress, vendored engine pinned + MIT licence present, licence-clean fonts resolve for every role, no
Piper / edge-tts voices vendored, and (unless --no-render) a 6-frame sandboxed render of the fallback scene with
frame parity. Exit 0 = pass. Prints no secrets."""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
VENDOR = HERE / "vendor" / "cinematic_skill"
PINNED = "bf435561c6203f90f971300efe952b68b5ec3417"


def _ver(v: str) -> tuple:
    return tuple(int(x) for x in "".join(c if c.isdigit() or c == "." else " " for c in v).split()[0].split(".")[:2])


def run(render: bool = True) -> dict:
    checks: list[dict] = []

    def add(cid, ok, detail=""):
        checks.append({"id": cid, "pass": bool(ok), "detail": str(detail)[:300]})

    try:
        import skia
        add("skia-python", _ver(skia.__version__) >= (87, 6), skia.__version__)
    except Exception as e:  # noqa: BLE001
        add("skia-python", False, type(e).__name__)
    for mod in ("numpy", "PIL", "scipy", "librosa"):
        try:
            m = __import__(mod)
            add(mod, True, getattr(m, "__version__", "ok"))
        except Exception as e:  # noqa: BLE001
            add(mod, False, type(e).__name__)
    ff, fp = shutil.which("ffmpeg"), shutil.which("ffprobe")
    add("ffmpeg", bool(ff and fp), ff or "missing")
    if ff:
        enc = subprocess.run([ff, "-hide_banner", "-encoders"], capture_output=True, text=True).stdout
        flt = subprocess.run([ff, "-hide_banner", "-filters"], capture_output=True, text=True).stdout
        add("ffmpeg.libx264", "libx264" in enc)
        add("ffmpeg.filters", all(f in flt for f in ("loudnorm", "sidechaincompress", "atrim")))
    vend = (VENDOR / "VENDORED.md").read_text() if (VENDOR / "VENDORED.md").exists() else ""
    add("engine.pinned", PINNED in vend, PINNED[:10])
    lic = (VENDOR / "LICENSE").read_text() if (VENDOR / "LICENSE").exists() else ""
    add("engine.licence", "MIT License" in lic or "Permission is hereby granted" in lic, "MIT")
    add("voices.not_vendored", not any((VENDOR / f).exists() for f in ("tts_say.py", "piper", "voices")), "ElevenLabs only (D28)")
    try:
        from clips_worker.motion_studio.core.fonts import resolved_manifest
        man = resolved_manifest()
        bad = [m for m in man if not m["licence"]]
        add("fonts.licence_clean", not bad, json.dumps(man if bad else [f"{m['role']}={m['family']}" for m in man]))
    except Exception as e:  # noqa: BLE001
        add("fonts.licence_clean", False, type(e).__name__)
    try:
        from clips_worker.motion_studio.core.stock import available_maps, load_map
        from clips_worker.motion_studio.core.api import GeoMap
        maps = available_maps()
        world = load_map("world") if "world" in maps else {}
        add("maps.stock", "world" in maps and "Chicago" in (world.get("places") or {}) and GeoMap is not None,
            f"{maps} places={len(world.get('places') or {})}")
    except Exception as e:  # noqa: BLE001
        add("maps.stock", False, type(e).__name__)
    if render:
        try:
            from clips_worker.motion_studio.core.fallback import FALLBACK_CODE
            from clips_worker.motion_studio.core.render import ffprobe_frames, render_scene
            with tempfile.TemporaryDirectory(prefix="ms_setup_") as td:
                ctx = {"duration": 0.2, "fps": 30, "seed": 1, "lines": [{"id": "l1", "text": "Setup check", "spoken": "Setup check",
                       "hero": "SETUP", "typed": "", "start": 0.0, "end": 0.2}], "words": [{"w": "Setup", "s": 0.0, "e": 0.1, "line": "l1"},
                       {"w": "check", "s": 0.1, "e": 0.2, "line": "l1"}], "emphasis": [], "assets": {}, "data": [],
                       "style": {"palette": {"bg": "#101418", "ink": "#f2efe8", "accent": "#e8b04a", "muted": "#7d8794"}, "mood": "calm"},
                       "palette": {"bg": "#101418", "ink": "#f2efe8", "accent": "#e8b04a", "muted": "#7d8794"},
                       "scene": {"id": "s0", "index": 0, "visualType": "title", "description": "setup check", "blocks": []}}
                out = os.path.join(td, "setup.mp4")
                os.makedirs(os.path.join(td, "assets", "photos"), exist_ok=True)
                res = render_scene(FALLBACK_CODE, ctx, out, td, 320, 180, workers=1, assets_dir=os.path.join(td, "assets"))
                n = ffprobe_frames(out)
                add("render.smoke", n == 6, f"frames={n} {json.dumps(res)[:120] if isinstance(res, dict) else ''}")
        except Exception as e:  # noqa: BLE001
            add("render.smoke", False, f"{type(e).__name__}: {str(e)[:200]}")
    return {"pass": all(c["pass"] for c in checks), "checks": checks}


def main() -> int:
    res = run(render="--no-render" not in sys.argv)
    if "--json" in sys.argv:
        print(json.dumps(res, indent=2))
    else:
        for c in res["checks"]:
            print(f"[check_setup] {'ok  ' if c['pass'] else 'FAIL'} {c['id']}: {c['detail']}")
        print(f"[check_setup] {'PASS' if res['pass'] else 'FAIL'}")
    return 0 if res["pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
