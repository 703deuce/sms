"""9:16 facecam + gameplay stack ffmpeg filters (S7)."""
from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Any

from clips_worker.filtergraph import fit_blur_overlay_filter, screen_pip_overlay_filter


def build_stack_filter(
    src_w: int,
    src_h: int,
    facecam: dict[str, float],
    gameplay: dict[str, float] | None,
    *,
    split: float = 0.4,
    position: str = "top",
    out_w: int = 1080,
    out_h: int = 1920,
) -> str:
    """Return ffmpeg -filter_complex for vstack stack."""
    split = max(0.25, min(0.5, float(split)))
    hf = int(round(out_h * split / 2)) * 2
    hg = out_h - hf

    def crop_box(box: dict[str, float]) -> tuple[int, int, int, int]:
        x = int(box["x"] * src_w)
        y = int(box["y"] * src_h)
        w = max(8, int(box["w"] * src_w))
        h = max(8, int(box["h"] * src_h))
        x = max(0, min(x, src_w - w))
        y = max(0, min(y, src_h - h))
        return w, h, x, y

    fw, fh, fx, fy = crop_box(facecam)
    if gameplay:
        gw, gh, gx, gy = crop_box(gameplay)
    else:
        gw = int(src_h * out_w / hg)
        gh = src_h
        gx = max(0, (src_w - gw) // 2)
        gy = 0

    face = f"[0:v]crop={fw}:{fh}:{fx}:{fy},scale={out_w}:{hf}:force_original_aspect_ratio=increase,crop={out_w}:{hf}[f]"
    game = f"[0:v]crop={gw}:{gh}:{gx}:{gy},scale={out_w}:{hg}:force_original_aspect_ratio=increase,crop={out_w}:{hg}[g]"
    if position == "bottom":
        stack = "[g][f]vstack=inputs=2[v]"
    else:
        stack = "[f][g]vstack=inputs=2[v]"
    return f"{face};{game};{stack}"


def build_pip_filter(
    src_w: int,
    src_h: int,
    layout: dict[str, Any],
    *,
    out_w: int = 1080,
    out_h: int = 1920,
) -> str:
    """Blur-fit gameplay + facecam inset (screen_pip geometry)."""
    facecam = layout.get("facecam") if isinstance(layout.get("facecam"), dict) else None
    if not facecam:
        facecam = {"x": 0.78, "y": 0.62, "w": 0.18, "h": 0.22}
    fw = max(8, int(facecam.get("w", 0.18) * src_w))
    fh = max(8, int(facecam.get("h", 0.22) * src_h))
    fx = max(0, min(int(facecam.get("x", 0.78) * src_w), src_w - fw))
    fy = max(0, min(int(facecam.get("y", 0.62) * src_h), src_h - fh))
    bg = fit_blur_overlay_filter("0:v", "bgfull", out_w, out_h)
    cam = f"[0:v]crop={fw}:{fh}:{fx}:{fy},scale=-2:-2[camraw]"
    pip = screen_pip_overlay_filter("bgfull", "camraw", "v", out_w, out_h)
    return f"{bg};{cam};{pip}"


def render_stack_mp4(
    src: Path,
    dest: Path,
    layout: dict[str, Any],
    *,
    audio_copy: bool = True,
    out_w: int = 1080,
    out_h: int = 1920,
) -> None:
    import json

    meta = json.loads(
        subprocess.check_output(
            [
                "ffprobe",
                "-v",
                "error",
                "-select_streams",
                "v:0",
                "-show_entries",
                "stream=width,height",
                "-of",
                "json",
                str(src),
            ],
            text=True,
        )
    )["streams"][0]
    sw, sh = int(meta["width"]), int(meta["height"])
    facecam = layout.get("facecam") or {"x": 0.02, "y": 0.02, "w": 0.35, "h": 0.35}
    gameplay = layout.get("gameplay")
    filt = build_stack_filter(
        sw,
        sh,
        facecam,
        gameplay if isinstance(gameplay, dict) else None,
        split=float(layout.get("split") or 0.4),
        position=str(layout.get("facecamPosition") or "top"),
        out_w=out_w,
        out_h=out_h,
    )
    cmd = [
        "ffmpeg",
        "-y",
        "-v",
        "error",
        "-i",
        str(src),
        "-filter_complex",
        filt,
        "-map",
        "[v]",
        "-map",
        "0:a?",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        str(dest),
    ]
    subprocess.check_call(cmd)


def render_pip_mp4(
    src: Path,
    dest: Path,
    layout: dict[str, Any],
    *,
    out_w: int = 1080,
    out_h: int = 1920,
) -> None:
    import json

    meta = json.loads(
        subprocess.check_output(
            [
                "ffprobe",
                "-v",
                "error",
                "-select_streams",
                "v:0",
                "-show_entries",
                "stream=width,height",
                "-of",
                "json",
                str(src),
            ],
            text=True,
        )
    )["streams"][0]
    sw, sh = int(meta["width"]), int(meta["height"])
    filt = build_pip_filter(sw, sh, layout, out_w=out_w, out_h=out_h)
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(src),
            "-filter_complex",
            filt,
            "-map",
            "[v]",
            "-map",
            "0:a?",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "23",
            "-c:a",
            "aac",
            "-movflags",
            "+faststart",
            str(dest),
        ],
    )
