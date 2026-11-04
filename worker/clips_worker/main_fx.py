"""CV-17a: main video mask + chroma key on full_render / cut.mp4 (mirror: new-app/lib/clips/editor/main-fx.ts)."""
from __future__ import annotations

import subprocess
from pathlib import Path

from clips_worker.filtergraph import canvas_bg, canvas_bg_flat, canvas_bg_from_input, fit_blur_strength
from clips_worker.layer_fx import despill_chain, key_chain, layer_fx_for, write_chroma_key_alpha_frames, write_mask_frames
from clips_worker.motion_render import probe_size_duration

MULTI_VIDEO_LAYOUTS = frozenset(
    {"facecam_stack", "facecam_pip", "screen_pip", "stack", "split", "grid3", "grid4", "two_up"}
)


def main_key_allowed(edits: dict) -> bool:
    if edits.get("sourceSegments"):
        return False
    mode = str((edits.get("layout") or {}).get("mode") or "speaker_follow")
    # Full-frame and fit layouts keep a single composited foreground.
    if mode in MULTI_VIDEO_LAYOUTS:
        return False
    return True


def _reveal_bg_filter(edits: dict, w: int, h: int, fps: int, dur_s: float, blur_in: str | None) -> tuple[str, list[str], str]:
    """Return (filter ending at [mfxbg], extra ffmpeg inputs, output label)."""
    bg = canvas_bg(edits)
    extra: list[str] = []
    if canvas_bg_flat(bg) and bg and bg.get("type") == "color":
        hexv = bg.get("color") or "000000"
        return f"color=c=0x{hexv}:s={w}x{h}:r={fps}:d={dur_s:.3f}[mfxbg]", extra, "mfxbg"
    if canvas_bg_flat(bg) and bg and bg.get("type") == "image" and bg.get("path"):
        extra = ["-loop", "1", "-i", str(bg["path"])]
        return (
            f"color=c=black:s={w}x{h}:r={fps}:d={dur_s:.3f}[mfxbgk];"
            f"[1:v]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},setsar=1,format=yuv420p[mfxbgi];"
            f"[mfxbgk][mfxbgi]overlay=0:0:eof_action=repeat:shortest=1[mfxbg]",
            extra,
            "mfxbg",
        )
    if blur_in and bg and bg.get("type") == "blur":
        chain = canvas_bg_from_input(blur_in, "mfxbg", w, h, bg, fit_blur_strength(edits), "mfxcb")
        return f"{chain};[mfxbg]fps={fps},tpad=stop_mode=clone:stop_duration={dur_s:.3f}[mfxbg]", extra, "mfxbg"
    return f"color=c=black:s={w}x{h}:r={fps}:d={dur_s:.3f}[mfxbg]", extra, "mfxbg"


def apply_full_render_key(pre_color: Path, graded: Path, out: Path, edits: dict, work_dir: Path | None = None) -> Path:
    lfx = layer_fx_for(edits, "video")
    k = lfx.get("key")
    if not k or not main_key_allowed(edits):
        return graded
    w, h, dur = probe_size_duration(graded)
    fps = 30
    wd = Path(work_dir) if work_dir else out.parent
    keyed_alpha = bool(k.get("keys"))
    bg = canvas_bg(edits)
    use_blur_bg = bool(bg and bg.get("type") == "blur")
    dual = pre_color != graded

    def keyed_alpha_block(alpha_src: Path, n_inputs: int) -> tuple[list[str], str, int]:
        kpath = wd / "main_keyalpha.gray"
        _, kmw, kmh, knfr = write_chroma_key_alpha_frames(alpha_src, 0.0, dur, w, h, k, kpath)
        pad = max(0.0, dur - knfr / 10.0) + 1.0
        extra = ["-f", "rawvideo", "-pix_fmt", "gray", "-video_size", f"{kmw}x{kmh}", "-framerate", "10", "-i", str(kpath)]
        block = (
            f"[{n_inputs}:v]setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration={pad:.3f},fps={fps},"
            f"scale={w}:{h}:flags=bilinear,format=gray[ka];"
        )
        return extra, block, n_inputs + 1

    if dual:
        bg_f, bg_extra, bg_l = _reveal_bg_filter(edits, w, h, fps, dur, None)
        n_in = 2 + sum(1 for i, x in enumerate(bg_extra) if x == "-i" and i > 0)
        alpha_extra: list[str] = []
        if keyed_alpha:
            alpha_extra, alpha, _ = keyed_alpha_block(pre_color, n_in)
        else:
            alpha = f"[0:v]{key_chain(k)[1:]},alphaextract[ka];"
        color = f"[1:v]null{despill_chain(k)},format=yuv420p[kc];"
        fc = f"{alpha}{color}[kc][ka]alphamerge[kk];{bg_f};[{bg_l}][kk]overlay=0:0:shortest=1:format=auto,format=yuv420p[vout]"
        cmd = ["ffmpeg", "-y", "-v", "error", "-i", str(pre_color), "-i", str(graded), *bg_extra, *alpha_extra,
               "-filter_complex", fc, "-map", "[vout]", "-map", "1:a?", "-c:v", "libx264", "-preset", "veryfast",
               "-crf", "18", "-c:a", "copy", str(out)]
    else:
        blur_in = "0:c" if use_blur_bg else None
        bg_f, bg_extra, bg_l = _reveal_bg_filter(edits, w, h, fps, dur, blur_in)
        split_n = 3 if use_blur_bg else 2
        labels = ["0a", "0b"] + (["0c"] if use_blur_bg else [])
        split = f"[0:v]split={split_n}" + "".join(f"[{x}]" for x in labels) + ";"
        n_in = 1 + sum(1 for i, x in enumerate(bg_extra) if x == "-i" and i > 0)
        alpha_extra = []
        if keyed_alpha:
            alpha_extra, alpha, _ = keyed_alpha_block(graded, n_in)
            color = f"[0b]null{despill_chain(k)},format=yuv420p[kc];"
        else:
            alpha = f"[0a]{key_chain(k)[1:]},alphaextract[ka];"
            color = f"[0b]null{despill_chain(k)},format=yuv420p[kc];"
        merge = "[kc][ka]alphamerge[kk];"
        if use_blur_bg:
            bg_f = canvas_bg_from_input("0:c", "mfxbg", w, h, bg, fit_blur_strength(edits), "mfxcb")
            bg_f += f";[mfxbg]fps={fps},tpad=stop_mode=clone:stop_duration={dur:.3f}[mfxbg]"
        fc = f"{split}{alpha}{color}{merge}{bg_f};[{bg_l}][kk]overlay=0:0:shortest=1:format=auto,format=yuv420p[vout]"
        cmd = ["ffmpeg", "-y", "-v", "error", "-i", str(graded), *bg_extra, *alpha_extra, "-filter_complex", fc,
               "-map", "[vout]", "-map", "0:a?", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-c:a", "copy", str(out)]
    subprocess.check_call(cmd)
    return out


def apply_full_render_matte(
    graded: Path, matte: Path, out: Path, edits: dict, bgr: dict, bg_image: Path | None = None
) -> Path:
    """EF-24/29: composite the subject (graded × refined matte) over blur / color / image."""
    from clips_worker.bg_removal import BLUR_UNIT, refine_params

    w, h, dur = probe_size_duration(graded)
    fps = 30
    short = min(w, h)
    sigma, lo, hi = refine_params(float(bgr["refine"]["feather"]), float(bgr["refine"]["choke"]), short)
    rng = max(1e-3, hi - lo)
    soft = f",gblur=sigma={sigma:.3f}" if sigma > 0.05 else ""
    alpha = (
        f"[1:v]setpts=PTS-STARTPTS,fps={fps},scale={w}:{h}:flags=bilinear,format=gray{soft},"
        f"lut=y='clip((val-{lo * 255:.3f})*{1.0 / rng:.6f},0,255)'[ma]"
    )
    bg = bgr["background"]
    extra: list[str] = []
    if bg["type"] == "blur":
        s = max(1.0, float(bg.get("amount", 50)) / 100.0 * BLUR_UNIT * short)
        bgf = f"[bgsrc]gblur=sigma={s:.3f}:steps=2,format=yuv420p[bg]"
        head = f"[0:v]format=yuv420p,split=2[fg][bgsrc];{alpha};{bgf};"
    elif bg["type"] == "image" and bg_image is not None:
        extra = ["-loop", "1", "-i", str(bg_image)]
        bgf = (
            f"[2:v]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},setsar=1,fps={fps},"
            f"format=yuv420p[bg];[bgsrc]nullsink"
        )
        head = f"[0:v]format=yuv420p,split=2[fg][bgsrc];{alpha};{bgf};"
    else:
        hexv = bg.get("color") or "000000"
        bgf = f"color=c=0x{hexv}:s={w}x{h}:r={fps}:d={dur:.3f}[bg]"
        head = f"[0:v]format=yuv420p[fg];{alpha};{bgf};"
    fc = (
        f"{head}"
        f"[fg][ma]alphamerge[fga];[bg][fga]overlay=0:0:shortest=1:format=auto,format=yuv420p[vout]"
    )
    cmd = [
        "ffmpeg",
        "-y",
        "-v",
        "error",
        "-i",
        str(graded),
        "-i",
        str(matte),
        *extra,
        "-filter_complex",
        fc,
        "-map",
        "[vout]",
        "-map",
        "0:a?",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "18",
        "-c:a",
        "copy",
        str(out),
    ]
    subprocess.check_call(cmd)
    return out


def apply_main_mask(src: Path, out: Path, edits: dict, w: int, h: int, work_dir: Path) -> bool:
    lfx = layer_fx_for(edits, "video")
    mask = lfx.get("mask")
    if not mask:
        return False
    _, _, dur = probe_size_duration(src)
    fps = 30
    mpath = Path(work_dir) / "main_mask.gray"
    _, mw, mh, nfr = write_mask_frames(mask, dur, w, h, mpath)
    pad = max(0.0, dur - nfr / 10.0) + 1.0
    bg = canvas_bg(edits)
    use_blur_bg = bool(bg and bg.get("type") == "blur")
    bg_extra: list[str] = []
    if canvas_bg_flat(bg) and bg and bg.get("type") == "image" and bg.get("path"):
        bg_extra = ["-loop", "1", "-i", str(bg["path"])]
    if use_blur_bg:
        parts = [
            "[0:v]split=2[mc0][mblur]",
            canvas_bg_from_input("mblur", "mfxbg", w, h, bg, fit_blur_strength(edits), "mfxcb"),
            f"[mfxbg]fps={fps},tpad=stop_mode=clone:stop_duration={pad:.3f}[mfxbg]",
            "[mc0]format=yuv420p[mc]",
            f"[1:v]setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration={pad:.3f},fps={fps},"
            f"scale={w}:{h}:flags=bilinear,format=gray[ma]",
            "[mc][ma]alphamerge[mk]",
            "[mfxbg][mk]overlay=0:0:shortest=1:format=auto,format=yuv420p[mv]",
        ]
    else:
        bg_f, bg_extra2, bg_l = _reveal_bg_filter(edits, w, h, fps, dur, None)
        bg_extra.extend(bg_extra2)
        parts = [
            bg_f,
            "[0:v]format=yuv420p[mc]",
            f"[1:v]setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration={pad:.3f},fps={fps},"
            f"scale={w}:{h}:flags=bilinear,format=gray[ma]",
            "[mc][ma]alphamerge[mk]",
            f"[{bg_l}][mk]overlay=0:0:shortest=1:format=auto,format=yuv420p[mv]",
        ]
    fc = ";".join(parts)
    cmd = (
        ["ffmpeg", "-y", "-v", "error", "-i", str(src), "-f", "rawvideo", "-pix_fmt", "gray",
         "-video_size", f"{mw}x{mh}", "-framerate", "10", "-i", str(mpath)]
        + bg_extra
        + ["-filter_complex", fc, "-map", "[mv]", "-map", "0:a?", "-c:v", "libx264", "-preset", "veryfast",
           "-crf", "18", "-c:a", "copy", str(out)]
    )
    subprocess.check_call(cmd)
    return True
