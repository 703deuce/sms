"""EF-24/29: RVM person matting on on-demand Modal L4 (server-side only; GPL-3.0, see third_party/rvm)."""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
import tempfile
import time
import urllib.request

import modal

from modal_app.app import app
from modal_app.images import MODAL_MAX_CONTAINERS, models

MATTE_GPU = os.environ.get("MODAL_MATTE_GPU", os.environ.get("MODAL_GPU", "T4"))

RVM_SHA = "53d74c6826735f01f4406b5ca9075eee27bec094"
RVM_RELEASE = "https://github.com/PeterL1n/RobustVideoMatting/releases/download/v1.0.0/"
RVM_WEIGHTS = {
    "standard": ("mobilenetv3", "rvm_mobilenetv3.pth", "3c7c1d92033f7c38d6577c481d13a195d7d80a159b960f4f3119ac7b534cf4f8"),
    "detail": ("resnet50", "rvm_resnet50.pth", "c191a807251164c073dce5fa408e7a816070d539b882b2a3150330a9fec112ce"),
}
MODELS_MOUNT = "/models"
WEIGHTS_DIR = f"{MODELS_MOUNT}/rvm"
_HERE = os.path.dirname(os.path.abspath(__file__))

matte_image = (
    modal.Image.from_registry("nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04", add_python="3.11")
    .apt_install("ffmpeg", "git")
    .pip_install("numpy<2")
    .run_commands(
        "pip install --no-cache-dir torch==2.4.1 torchvision==0.19.1 "
        "--index-url https://download.pytorch.org/whl/cu124"
    )
    .run_commands(
        "git clone https://github.com/PeterL1n/RobustVideoMatting /opt/rvm",
        f"cd /opt/rvm && git checkout {RVM_SHA}",
    )
    .add_local_dir(os.path.join(_HERE, "third_party", "rvm"), "/opt/rvm_license")
)


def _sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def _ensure_weights(fname: str, sha: str) -> str:
    os.makedirs(WEIGHTS_DIR, exist_ok=True)
    path = f"{WEIGHTS_DIR}/{fname}"
    if os.path.exists(path) and _sha256(path) == sha:
        return path
    tmp = f"{path}.{os.getpid()}.tmp"
    urllib.request.urlretrieve(RVM_RELEASE + fname, tmp)
    got = _sha256(tmp)
    if got != sha:
        os.remove(tmp)
        raise RuntimeError(f"rvm weights sha mismatch for {fname}")
    os.replace(tmp, path)
    models.commit()
    return path


def _probe(url: str) -> tuple[int, int]:
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json", url]
    )
    s = json.loads(out)["streams"][0]
    return int(s["width"]), int(s["height"])


def _out_size(w: int, h: int, short_side: int) -> tuple[int, int]:
    s = min(w, h)
    k = min(1.0, short_side / float(s))
    return max(2, int(round(w * k / 2)) * 2), max(2, int(round(h * k / 2)) * 2)


def downsample_ratio(w: int, h: int, quality: str) -> float:
    r = min(1.0, 512.0 / max(w, h))
    if quality == "detail":
        r = min(1.0, r * 1.5)
    return round(r, 3)


@app.cls(
    image=matte_image,
    gpu=MATTE_GPU,
    timeout=900,
    volumes={MODELS_MOUNT: models},
    min_containers=0,
    max_containers=MODAL_MAX_CONTAINERS,
    scaledown_window=60,
)
class Matter:
    @modal.enter()
    def _on_start(self):
        self._boot_at = time.time()
        self._nets: dict = {}

    def _net(self, quality: str):
        import sys

        import torch

        if quality in self._nets:
            return self._nets[quality]
        if "/opt/rvm" not in sys.path:
            sys.path.insert(0, "/opt/rvm")
        from model import MattingNetwork

        variant, fname, sha = RVM_WEIGHTS[quality]
        net = MattingNetwork(variant).eval().cuda()
        net.load_state_dict(torch.load(_ensure_weights(fname, sha), map_location="cuda"))
        net = net.half()
        self._nets[quality] = net
        return net

    @modal.method()
    def ping(self) -> dict:
        return {"ok": True}

    @modal.method()
    def matte(self, item: dict) -> dict:
        t0 = time.time()
        try:
            return self._matte_impl(item, t0)
        except Exception as exc:
            import urllib.error

            if isinstance(exc, urllib.error.HTTPError):
                return {"ok": False, "error": f"http_{exc.code}", "gpu_seconds": time.time() - t0}
            return {
                "ok": False,
                "error": f"{type(exc).__name__}:{str(exc)[:160]}",
                "gpu_seconds": time.time() - t0,
            }

    def _matte_impl(self, item: dict, t0: float) -> dict:
        import numpy as np
        import torch

        cold = (t0 - getattr(self, "_boot_at", t0)) < 3.0
        quality = "detail" if item.get("quality") == "detail" else "standard"
        fps = float(item.get("fps") or 30)
        pre = max(0.0, min(float(item.get("preroll_s") or 0.0), float(item["start_s"])))
        start = float(item["start_s"]) - pre
        dur = float(item["dur_s"]) + pre
        sw, sh = _probe(item["src_url"])
        w, h = _out_size(sw, sh, int(item.get("short_side") or 1080))
        n_pre = int(round(pre * fps))
        resets = {n_pre + int(round(float(t) * fps)) for t in (item.get("reset_at_s") or [])}
        net = self._net(quality)
        ratio = downsample_ratio(w, h, quality)
        frame_bytes = w * h * 3
        data = b""
        with tempfile.TemporaryDirectory() as td:
            out = f"{td}/alpha.mp4"
            dec = subprocess.Popen(
                [
                    "ffmpeg",
                    "-v",
                    "error",
                    "-ss",
                    f"{start:.3f}",
                    "-t",
                    f"{dur:.3f}",
                    "-i",
                    item["src_url"],
                    "-an",
                    "-vf",
                    f"fps={fps},scale={w}:{h}:flags=bicubic",
                    "-f",
                    "rawvideo",
                    "-pix_fmt",
                    "rgb24",
                    "-",
                ],
                stdout=subprocess.PIPE,
            )
            enc = subprocess.Popen(
                [
                    "ffmpeg",
                    "-y",
                    "-v",
                    "error",
                    "-f",
                    "rawvideo",
                    "-pix_fmt",
                    "gray",
                    "-s",
                    f"{w}x{h}",
                    "-r",
                    f"{fps}",
                    "-i",
                    "-",
                    "-c:v",
                    "libx264",
                    "-crf",
                    "14",
                    "-g",
                    "30",
                    "-pix_fmt",
                    "yuv420p",
                    out,
                ],
                stdin=subprocess.PIPE,
            )
            rec = [None] * 4
            prev: list = []
            i = kept = 0
            alpha_sum = 0.0
            with torch.no_grad():
                while True:
                    buf = dec.stdout.read(frame_bytes)
                    if len(buf) < frame_bytes:
                        break
                    if i in resets:
                        rec = [None] * 4
                        prev = []
                    src = torch.frombuffer(bytearray(buf), dtype=torch.uint8).cuda()
                    src = src.view(h, w, 3).permute(2, 0, 1).unsqueeze(0).half().div_(255)
                    _fgr, pha, *rec = net(src, *rec, downsample_ratio=ratio)
                    a = pha[0, 0].float()
                    if item.get("median", True) and len(prev) == 2:
                        med = torch.median(torch.stack([prev[0], prev[1], a]), dim=0).values
                        a_out = torch.where((a - prev[1]).abs() < 0.08, med, a)
                    else:
                        a_out = a
                    prev = (prev + [a])[-2:]
                    if i >= n_pre:
                        u8 = (a_out.clamp(0, 1) * 255.0 + 0.5).to(torch.uint8).cpu().numpy()
                        enc.stdin.write(np.ascontiguousarray(u8).tobytes())
                        alpha_sum += float(a_out.mean())
                        kept += 1
                    i += 1
            enc.stdin.close()
            if enc.wait() != 0 or dec.wait() != 0:
                return {"ok": False, "error": "ffmpeg_failed", "gpu_seconds": time.time() - t0}
            with open(out, "rb") as f:
                data = f.read()
            try:
                req = urllib.request.Request(
                    item["out_upload_url"],
                    data=data,
                    method="PUT",
                    headers={"Content-Type": "video/mp4"},
                )
                urllib.request.urlopen(req, timeout=600)
            except urllib.error.HTTPError as exc:
                return {
                    "ok": False,
                    "error": f"upload_http_{exc.code}",
                    "gpu_seconds": time.time() - t0,
                }
        el = time.time() - t0
        return {
            "ok": kept > 0,
            "frames": kept,
            "fps": fps,
            "w": w,
            "h": h,
            "gpu_seconds": el,
            "mean_alpha": alpha_sum / max(1, kept),
            "model": f"rvm_{RVM_WEIGHTS[quality][0]}",
            "rvm_sha": RVM_SHA,
            "downsample_ratio": ratio,
            "cold_start": cold,
            "size_bytes": len(data),
        }
