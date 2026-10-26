"""9:16 facecam + gameplay stack ffmpeg filters (S7)."""
from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Any


def build_stack_filter(
    src_w: int,
    src_h: int,
    facecam: dict[str, float],
    gameplay: dict[str, float] | None,
    *,
    split: float = 0.4,
    position: str = "top",
) -> str:
    """Return ffmpeg -filter_complex for vstack stack (1080x1920 out)."""
    split = max(0.25, min(0.5, float(split)))
    hf = int(round(1920 * split / 2)) * 2
    hg = 1920 - hf

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
        gw = int(src_h * 1080 / hg)
        gh = src_h
        gx = max(0, (src_w - gw) // 2)
        gy = 0

    face = f"[0:v]crop={fw}:{fh}:{fx}:{fy},scale=1080:{hf}:force_original_aspect_ratio=increase,crop=1080:{hf}[f]"
    game = f"[0:v]crop={gw}:{gh}:{gx}:{gy},scale=1080:{hg}:force_original_aspect_ratio=increase,crop=1080:{hg}[g]"
    if position == "bottom":
        stack = "[g][f]vstack=inputs=2[v]"
    else:
        stack = "[f][g]vstack=inputs=2[v]"
    return f"{face};{game};{stack}"


def render_stack_mp4(
    src: Path,
    dest: Path,
    layout: dict[str, Any],
    *,
    audio_copy: bool = True,
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
