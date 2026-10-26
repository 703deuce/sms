import os
import subprocess
import tempfile
import time
import urllib.request

import modal

from modal_app.app import app

# ffmpeg scratch image has no apt; uploads use urllib in Python.
image = modal.Image.from_registry("jrottenberg/ffmpeg:7-scratch").pip_install("numpy")


@app.cls(image=image, gpu="L4", timeout=1800, scaledown_window=int(os.environ.get("MODAL_SCALEDOWN_S", "60")))
class Renderer:
    @modal.method()
    def render_one(self, item: dict) -> dict:
        t0 = time.time()
        seg_url = item.get("segment_url")
        upload_url = item.get("out_upload_url")
        fg = item.get("filtergraph") or ""
        enc = item.get("encoder") or "libx264"
        if not seg_url or not upload_url:
            return {"ok": False, "duration_ms": 0, "size_bytes": 0, "gpu_seconds": 0}
        with tempfile.TemporaryDirectory() as td:
            src = f"{td}/in.mp4"
            out = f"{td}/out.mp4"
            urllib.request.urlretrieve(seg_url, src)
            vf = fg if fg else "scale=1080:1920"
            vcodec = "h264_nvenc" if enc == "h264_nvenc" else "libx264"
            extra = ["-preset", "p5", "-cq", "21"] if vcodec == "h264_nvenc" else ["-crf", "20"]
            subprocess.check_call(
                ["ffmpeg", "-y", "-v", "error", "-i", src, "-vf", vf, "-c:v", vcodec, *extra, "-c:a", "aac", out],
            )
            with open(out, "rb") as f:
                data = f.read()
            req = urllib.request.Request(upload_url, data=data, method="PUT")
            urllib.request.urlopen(req, timeout=600)
        return {
            "ok": True,
            "duration_ms": 0,
            "size_bytes": len(data),
            "gpu_seconds": time.time() - t0,
        }

    @modal.method()
    def render_batch(self, items: list[dict]) -> list[dict]:
        return list(self.render_one.map(items))
