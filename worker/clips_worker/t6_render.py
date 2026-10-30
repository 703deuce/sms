"""T6 template ffmpeg render (P2)."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

from clips_worker.filtergraph import fit_blur_overlay_filter


def probe_video_size(path: Path) -> tuple[int, int]:
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
                str(path),
            ],
            stderr=subprocess.DEVNULL,
        )
    )
    st = (meta.get("streams") or [{}])[0]
    return int(st.get("width") or 1920), int(st.get("height") or 1080)


def probe_duration_s(path: Path) -> float:
    meta = json.loads(
        subprocess.check_output(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "json",
                str(path),
            ],
            stderr=subprocess.DEVNULL,
        )
    )
    return max(0.1, float((meta.get("format") or {}).get("duration") or 6.0))


def _norm_box(box: dict) -> tuple[float, float, float, float]:
    return (
        float(box.get("x") or 0),
        float(box.get("y") or 0),
        max(0.01, float(box.get("w") or 1)),
        max(0.01, float(box.get("h") or 1)),
    )


def _panel_src_filter(
    in_label: str,
    tag: str,
    src: dict,
    dest_w: int,
    dest_h: int,
    fit: str,
    *,
    src_w: int,
    src_h: int,
) -> tuple[str, str]:
    x, y, w, h = _norm_box(src)
    crop = f"[{in_label}]crop=iw*{w}:ih*{h}:iw*{x}:ih*{y}[{tag}raw]"
    src_crop_w = max(1.0, src_w * w)
    upscale = dest_w / src_crop_w if src_crop_w > 0 else 1.0
    sharp = ""
    if upscale > 2.0:
        sharp = ",unsharp=5:5:0.6:5:5:0.0"
    if fit == "contain_black":
        scale = (
            f"[{tag}raw]scale={dest_w}:{dest_h}:force_original_aspect_ratio=decrease:flags=lanczos{sharp},"
            f"pad={dest_w}:{dest_h}:(ow-iw)/2:(oh-ih)/2:black[{tag}]"
        )
        return f"{crop};{scale}", tag
    if fit == "contain_blur":
        inner = fit_blur_overlay_filter(f"{tag}raw", tag, dest_w, dest_h)
        inner = inner.replace(f"scale={dest_w}:{dest_h}", f"scale={dest_w}:{dest_h}:flags=lanczos{sharp}", 1)
        return f"{crop};{inner}", tag
    scale = (
        f"[{tag}raw]scale={dest_w}:{dest_h}:force_original_aspect_ratio=increase:flags=lanczos{sharp},"
        f"crop={dest_w}:{dest_h}[{tag}]"
    )
    return f"{crop};{scale}", tag


def build_template_filtergraph(
    spec: dict,
    *,
    src_w: int,
    src_h: int,
    duration_s: float,
) -> str:
    play_w = int(spec.get("playW") or 1080)
    play_h = int(spec.get("playH") or 1920)
    panels = list(spec.get("panels") or [])
    bands = list(spec.get("bands") or [])
    parts: list[str] = [f"color=c=black:s={play_w}x{play_h}:d={duration_s}[base]"]
    over = "base"
    idx = 0
    for band in bands:
        dest = band.get("dest") or {}
        bx = int(dest.get("x") or 0)
        by = int(dest.get("y") or 0)
        bw = max(2, int(dest.get("w") or play_w))
        bh = max(2, int(dest.get("h") or 0))
        fill = str(band.get("fill") or "blur")
        tag = f"band{idx}"
        if fill == "black" or fill == "dark_gradient":
            parts.append(f"color=c=black:s={bw}x{bh}:d={duration_s}[{tag}]")
        else:
            parts.append(
                f"[0:v]scale={bw}:{bh}:force_original_aspect_ratio=increase,crop={bw}:{bh},"
                f"boxblur=20:2,eq=brightness=-0.08[{tag}]"
            )
        parts.append(f"[{over}][{tag}]overlay={bx}:{by}[o{idx}]")
        over = f"o{idx}"
        idx += 1
    for pi, panel in enumerate(panels):
        dest = panel.get("dest") or {}
        dx = int(dest.get("x") or 0)
        dy = int(dest.get("y") or 0)
        dw = max(2, int(dest.get("w") or play_w))
        dh = max(2, int(dest.get("h") or play_h))
        src = panel.get("src") or {"x": 0, "y": 0, "w": 1, "h": 1}
        fit = str(panel.get("fit") or "cover")
        chain, ptag = _panel_src_filter("0:v", f"p{pi}", src, dw, dh, fit, src_w=src_w, src_h=src_h)
        parts.append(chain)
        parts.append(f"[{over}][{ptag}]overlay={dx}:{dy}[o{idx}]")
        over = f"o{idx}"
        idx += 1
    pip = spec.get("pip")
    if isinstance(pip, dict) and isinstance(pip.get("dest"), dict):
        pdest = pip["dest"]
        px = int(pdest.get("x") or 0)
        py = int(pdest.get("y") or 0)
        pw = max(2, int(pdest.get("w") or 0))
        ph = max(2, int(pdest.get("h") or pw))
        psrc = pip.get("src") or {"x": 0, "y": 0, "w": 0.32, "h": 0.28}
        pchain, ptag = _panel_src_filter("0:v", "pip", psrc, pw, ph, "cover", src_w=src_w, src_h=src_h)
        parts.append(pchain)
        if str(pip.get("shape") or "circle") == "circle":
            parts.append(
                f"[{ptag}]format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':"
                f"a='if(lte(hypot(X-{pw // 2},Y-{ph // 2}),{pw // 2}),255,0)'[pipmask]"
            )
            parts.append(f"[{over}][pipmask]overlay={px}:{py}[o{idx}]")
        else:
            parts.append(f"[{over}][{ptag}]overlay={px}:{py}[o{idx}]")
        over = f"o{idx}"
        idx += 1
    if over != "vout":
        parts.append(f"[{over}]null[vout]")
    return ";".join(parts)


def render_template(
    src: Path,
    dest: Path,
    spec: dict,
    work: Path,
    duration_s: float | None = None,
) -> None:
    work.mkdir(parents=True, exist_ok=True)
    src_w, src_h = probe_video_size(src)
    dur = duration_s if duration_s is not None else probe_duration_s(src)
    fg = build_template_filtergraph(spec, src_w=src_w, src_h=src_h, duration_s=dur)
    cmd = [
        "ffmpeg",
        "-y",
        "-v",
        "error",
        "-i",
        str(src),
        "-filter_complex",
        fg,
        "-map",
        "[vout]",
        "-map",
        "0:a?",
        "-t",
        str(dur),
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "20",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        str(dest),
    ]
    subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def extract_frame_png(src: Path, dest: Path, *, t_s: float = 2.0) -> None:
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-ss",
            str(t_s),
            "-i",
            str(src),
            "-frames:v",
            "1",
            str(dest),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
