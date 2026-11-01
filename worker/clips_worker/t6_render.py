"""T6 template ffmpeg render (P2)."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

from clips_worker.filtergraph import canvas_bg, canvas_bg_flat, canvas_bg_from_input, fit_blur_bg_chain, fit_blur_overlay_filter


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
    blur_strength: str | None = None,
    panel_bg: dict | None = None,
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
        inner = fit_blur_overlay_filter(f"{tag}raw", tag, dest_w, dest_h, blur_strength, bg=panel_bg)
        # E6: per-panel label scope (hygiene) so the lanczos/unsharp edit below targets this panel's
        # foreground scale; the old first-"scale=WxH" replace hit the bg chain, which the strong chain changes.
        for lab in ("a", "b", "bg", "fg"):
            inner = inner.replace(f"[{lab}]", f"[{tag}_{lab}]")
        fg_scale = f"[{tag}_b]scale={dest_w}:{dest_h}:force_original_aspect_ratio=decrease"
        inner = inner.replace(fg_scale, f"{fg_scale}:flags=lanczos{sharp}", 1)
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
    bg_spec = spec.get("canvasBg")
    parts: list[str] = []
    if canvas_bg_flat(bg_spec) and bg_spec and bg_spec.get("type") == "color":
        parts.append(f"color=c=0x{bg_spec.get('color', '000000')}:s={play_w}x{play_h}:d={duration_s}[base]")
    else:
        parts = [f"color=c=black:s={play_w}x{play_h}:d={duration_s}[base]"]
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
                canvas_bg_from_input("0:v", tag, bw, bh, bg_spec, spec.get("blurStrength"), f"b{idx}")
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
        chain, ptag = _panel_src_filter(
            "0:v",
            f"p{pi}",
            src,
            dw,
            dh,
            fit,
            src_w=src_w,
            src_h=src_h,
            blur_strength=spec.get("blurStrength"),
            panel_bg=bg_spec,
        )
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


def probe_fps(path: Path) -> float:
    try:
        out = subprocess.check_output(
            ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=avg_frame_rate",
             "-of", "default=nw=1:nk=1", str(path)],
            stderr=subprocess.DEVNULL,
        ).decode().strip()
        num, _, den = out.partition("/")
        fps = float(num) / float(den or 1)
        return fps if 1.0 <= fps <= 240.0 else 30.0
    except Exception:
        return 30.0


def render_template_segments(
    src: Path,
    dest: Path,
    parts: list[tuple[float, float, dict]],
    work: Path,
    duration_s: float | None = None,
) -> None:
    """T6.7: one template spec per scene ``(start_s, end_s, spec)``.

    Each scene is rendered video-only from the same source (frame-accurate seek, boundaries
    snapped to the source frame grid), the parts are concatenated without re-encoding, and the
    ORIGINAL audio is muxed back in one piece -- so the audio (and caption timing) is exactly
    the single-template render's; only the picture changes at scene boundaries."""
    work.mkdir(parents=True, exist_ok=True)
    src_w, src_h = probe_video_size(src)
    dur = duration_s if duration_s is not None else probe_duration_s(src)
    fps = probe_fps(src)
    snapped: list[tuple[float, float, dict]] = []
    for a, b, spec in parts:
        a = round(round(max(0.0, a) * fps) / fps, 6)
        b = dur if b >= dur - 1e-3 else round(round(min(dur, b) * fps) / fps, 6)
        if b - a >= 1.0 / fps:
            snapped.append((a, b, spec))
    if not snapped:
        raise ValueError("no scene parts")
    seg_paths: list[Path] = []
    for i, (a, b, spec) in enumerate(snapped):
        seg_dur = b - a
        fg = build_template_filtergraph(spec, src_w=src_w, src_h=src_h, duration_s=seg_dur)
        out = work / f"t6_scene_{i}.mp4"
        subprocess.check_call(
            ["ffmpeg", "-y", "-v", "error", "-ss", f"{a:.6f}", "-t", f"{seg_dur:.6f}", "-i", str(src),
             "-filter_complex", fg, "-map", "[vout]", "-an", "-t", f"{seg_dur:.6f}", "-r", f"{fps:.6f}",
             "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", str(out)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        seg_paths.append(out)
    lst = work / "t6_scenes.txt"
    lst.write_text("".join(f"file '{p.resolve()}'\n" for p in seg_paths))
    video_only = work / "t6_scenes_video.mp4"
    subprocess.check_call(
        ["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(video_only)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    subprocess.check_call(
        ["ffmpeg", "-y", "-v", "error", "-i", str(video_only), "-i", str(src), "-map", "0:v:0", "-map", "1:a?",
         "-t", f"{dur:.6f}", "-c:v", "copy", "-c:a", "aac", "-movflags", "+faststart", str(dest)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


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
