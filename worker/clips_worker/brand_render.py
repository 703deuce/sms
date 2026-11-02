"""FFmpeg brand logo + watermark overlay on export."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

MARGIN = 24


def _probe_wh(video: Path) -> tuple[int, int]:
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json", str(video)]
    )
    s = json.loads(out)["streams"][0]
    return int(s["width"]), int(s["height"])


def aspect_key(w: int, h: int) -> str:
    r = w / h if h else 1.0
    if r < 0.8:
        return "9:16"
    if r > 1.25:
        return "16:9"
    return "1:1"


def _xy(pos: str, margin: int = MARGIN) -> tuple[str, str]:
    p = str(pos or "TR").upper()
    if p == "TL":
        return str(margin), str(margin)
    if p == "TC":
        return "(main_w-overlay_w)/2", str(margin)
    if p == "TR":
        return f"main_w-overlay_w-{margin}", str(margin)
    if p == "ML":
        return str(margin), "(main_h-overlay_h)/2"
    if p == "C":
        return "(main_w-overlay_w)/2", "(main_h-overlay_h)/2"
    if p == "MR":
        return f"main_w-overlay_w-{margin}", "(main_h-overlay_h)/2"
    if p == "BL":
        return str(margin), f"main_h-overlay_h-{margin}"
    if p == "BC":
        return "(main_w-overlay_w)/2", f"main_h-overlay_h-{margin}"
    if p == "BR":
        return f"main_w-overlay_w-{margin}", f"main_h-overlay_h-{margin}"
    return f"main_w-overlay_w-{margin}", str(margin)


def _probe_duration(video: Path) -> float:
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(video)]
    )
    return max(0.04, float(out.decode().strip() or "1"))


def overlay_image(video: Path, out: Path, image: Path, pos: str, size_pct: float, opacity: float) -> None:
    """Pure ffmpeg overlay. Width = size_pct of the MAIN video width (matches web brandOverlayExpr)."""
    w, _h = _probe_wh(video)
    dur = _probe_duration(video)
    px = max(2, int(round(w * float(size_pct) / 100.0)))
    px -= px % 2
    x, y = _xy(pos)
    op = min(1.0, max(0.0, float(opacity)))
    vf = f"[1:v]format=rgba,scale={px}:-1,colorchannelmixer=aa={op:.3f}[lg];[0:v][lg]overlay={x}:{y}"
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(video),
            "-loop",
            "1",
            "-framerate",
            "10",
            "-t",
            f"{dur:.3f}",
            "-i",
            str(image),
            "-filter_complex",
            vf,
            "-shortest",
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-x264-params",
            "keyint=1:min-keyint=1",
            "-pix_fmt",
            "yuv444p",
            "-an",
            str(out),
        ]
    )


def resolve_logo_position(brand: dict, video: Path) -> str:
    pos = str(brand.get("logoPosition") or "TR")
    ov = brand.get("aspectOverrides") or {}
    if isinstance(ov, dict) and ov:
        w, h = _probe_wh(video)
        a = ov.get(aspect_key(w, h)) or {}
        if isinstance(a, dict) and a.get("logoPosition") in ("TL", "TR", "BL", "BR"):
            pos = a["logoPosition"]
    return pos


def apply_brand_logo(video: Path, out: Path, logo_key: str, brand: dict, work_dir: Path) -> None:
    from clips_worker.storage import download_object

    logo = work_dir / "logo.png"
    download_object(logo_key, logo)
    overlay_image(
        video, out, logo,
        resolve_logo_position(brand, video),
        float(brand.get("logoSizePct") or 12),
        float(brand.get("logoOpacity") or 0.9),
    )


def apply_brand_watermark(video: Path, out: Path, brand: dict, work_dir: Path) -> bool:
    """Separate from the logo. Returns False (no output written) when no watermark is configured."""
    key = brand.get("watermarkKey")
    if not key:
        return False
    from clips_worker.storage import download_object

    wm = work_dir / "watermark.png"
    download_object(str(key), wm)
    overlay_image(
        video, out, wm,
        str(brand.get("watermarkPosition") or "BR"),
        float(brand.get("watermarkSizePct") or 10),
        float(brand.get("watermarkOpacity") or 0.5),
    )
    return True
