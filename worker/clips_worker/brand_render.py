"""FFmpeg brand logo overlay on export."""
from __future__ import annotations

import subprocess
from pathlib import Path


def apply_brand_logo(video: Path, out: Path, logo_key: str, brand: dict, work_dir: Path) -> None:
    from clips_worker.storage import download_object

    logo = work_dir / "logo.png"
    download_object(logo_key, logo)
    pos = str(brand.get("logoPosition") or "TR")
    margin = 24
    size_pct = float(brand.get("logoSizePct") or 12) / 100.0
    opacity = float(brand.get("logoOpacity") or 0.9)
    if pos == "TL":
        x, y = str(margin), str(margin)
    elif pos == "BL":
        x, y = str(margin), f"main_h-overlay_h-{margin}"
    elif pos == "BR":
        x, y = f"main_w-overlay_w-{margin}", f"main_h-overlay_h-{margin}"
    else:
        x, y = f"main_w-overlay_w-{margin}", str(margin)
    scale = f"iw*{size_pct}:-1"
    vf = (
        f"[1:v]format=rgba,colorchannelmixer=aa={opacity:.3f},scale={scale}[lg];"
        f"[0:v][lg]overlay={x}:{y}"
    )
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(video),
            "-i",
            str(logo),
            "-filter_complex",
            vf,
            "-c:a",
            "copy",
            str(out),
        ],
    )
