import os
import subprocess
import tempfile
import time
import urllib.request

import modal

from modal_app.app import app

image = modal.Image.debian_slim(python_version="3.12").apt_install("ffmpeg")


_MIN_CONTAINERS = max(0, int(os.environ.get("MODAL_RENDER_MIN_CONTAINERS", "1")))


@app.cls(
    image=image,
    gpu="L4",
    timeout=1800,
    scaledown_window=int(os.environ.get("MODAL_SCALEDOWN_S", "120")),
    min_containers=_MIN_CONTAINERS,
)
class Renderer:
    @modal.enter()
    def _on_start(self):
        self._boot_at = time.time()

    @modal.method()
    def ping(self) -> dict:
        boot = getattr(self, "_boot_at", time.time())
        return {"ok": True, "cold_start": (time.time() - boot) < 3.0}

    @modal.method()
    def render_one(self, item: dict) -> dict:
        t0 = time.time()
        cold = (t0 - getattr(self, "_boot_at", t0)) < 3.0
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
            use_fc = bool(item.get("filter_complex"))
            vf = fg if fg else "scale=1080:1920"
            vcodec = "h264_nvenc" if enc == "h264_nvenc" else "libx264"
            # Match worker local fallback (libx264 crf 20 veryfast); avoid softer NVENC CQ.
            extra = (
                ["-preset", "p4", "-rc", "vbr", "-cq", "18", "-b:v", "0"]
                if vcodec == "h264_nvenc"
                else ["-crf", "20", "-preset", "veryfast"]
            )
            if use_fc:
                subprocess.check_call(
                    [
                        "ffmpeg",
                        "-y",
                        "-v",
                        "error",
                        "-i",
                        src,
                        "-filter_complex",
                        vf,
                        "-map",
                        "[vfinal]",
                        "-map",
                        "0:a?",
                        "-c:v",
                        vcodec,
                        *extra,
                        "-c:a",
                        "aac",
                        "-movflags",
                        "+faststart",
                        out,
                    ],
                )
            else:
                subprocess.check_call(
                    ["ffmpeg", "-y", "-v", "error", "-i", src, "-vf", vf, "-c:v", vcodec, *extra, "-c:a", "aac", out],
                )
            with open(out, "rb") as f:
                data = f.read()
            req = urllib.request.Request(upload_url, data=data, method="PUT")
            urllib.request.urlopen(req, timeout=600)
        elapsed = time.time() - t0
        return {
            "ok": True,
            "duration_ms": 0,
            "size_bytes": len(data),
            "gpu_seconds": elapsed,
            "render_ms": round(elapsed * 1000.0, 1),
            "cold_start": cold,
        }

    @modal.method()
    def render_batch(self, items: list[dict]) -> list[dict]:
        return list(self.render_one.map(items))
