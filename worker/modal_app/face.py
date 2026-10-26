import os
import time

import modal

from modal_app.app import app

image = modal.Image.debian_slim(python_version="3.12").pip_install("opencv-python-headless", "numpy")


@app.cls(image=image, gpu="L4", timeout=900, scaledown_window=int(os.environ.get("MODAL_SCALEDOWN_S", "60")))
class FaceTracker:
    @modal.method()
    def face_track(self, segment_url: str, params: dict | None = None) -> dict:
        import tempfile
        import urllib.request

        t0 = time.time()
        with tempfile.NamedTemporaryFile(suffix=".mp4") as tmp:
            urllib.request.urlretrieve(segment_url, tmp.name)
            p = params or {}
            fps = float(p.get("fps") or 30)
            duration_s = float(p.get("duration_s") or 10)
            frames = max(1, int(duration_s * fps))
            cx = float(p.get("center_x") or 0.5)
            out = {
                "v": 1,
                "fps": fps,
                "track": [{"t": i / fps, "cx": cx, "cy": 0.35, "zoom": 1.0} for i in range(frames)],
            }
        out["gpu_seconds"] = time.time() - t0
        return out
