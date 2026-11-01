"""E3 export passes: Video-lane cut transitions (xfade), main-video keyframes, voice volume envelope.

Timing contract (keeps captions / audio / B-roll / SFX in sync): a cut transition never changes the
output length. It is centred on the cut, video only, and uses handle frames from full_render.mp4
(A continues past its out-point, B starts before its in-point); audio stays a hard cut.
"""
from __future__ import annotations

import re
import subprocess
import time
from pathlib import Path

from clips_worker.filtergraph import _escape_movie_path, canvas_bg, canvas_bg_flat
from clips_worker.ffmpeg_util import probe_video_nb_frames, stderr_tail
from clips_worker.motion import (
    MOTION_FPS,
    COVER_TRANSITIONS,
    REVEAL_TRANSITIONS,
    SHADER_TRANSITIONS,
    XFADE_NAME,
    ZOOM_AMOUNT,
    cut_transition_windows,
    has_layer_fx,
    layer_motion_chain,
    layer_sendcmd,
    volume_expr,
)

X264 = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p"]

_SHADER_WIN_RE = re.compile(r"win_shader_(\d+)\.mkv", re.I)


def shader_rendered_window_filter(input_idx: int, n: int, w: int, h: int, w0: float, label: str) -> str:
    fps = MOTION_FPS
    return (
        f"[{input_idx}:v]fps={fps},scale={w}:{h},setsar=1,format=gbrp,"
        f"trim=end_frame={n},format=yuv420p,setpts=PTS-STARTPTS+{w0:.6f}/TB[{label}]"
    )


def _run_cut_transition_ffmpeg(cmd: list[str]) -> None:
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode == 0:
        return
    tail = stderr_tail(proc.stderr or proc.stdout or "", lines=25)
    print(f"[clipper:transitions] ffmpeg_failed stderr_tail=\n{tail}", flush=True)
    raise subprocess.CalledProcessError(
        proc.returncode, cmd, output=proc.stdout, stderr=tail or f"ffmpeg exited {proc.returncode}",
    )


def probe_size_duration(video: Path) -> tuple[int, int, float]:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration",
         "-of", "default=noprint_wrappers=1", str(video)],
        capture_output=True, text=True, check=True,
    ).stdout
    vals = dict(line.split("=", 1) for line in out.splitlines() if "=" in line)
    return int(vals["width"]), int(vals["height"]), float(vals.get("duration") or 0)


def _window_src_chain(
    i: int,
    pad: float,
    lab: str,
    zoom: str | None,
    w: int,
    h: int,
    n: int,
    fps: int = MOTION_FPS,
    *,
    yuv: bool = False,
) -> str:
    """Source chain for one window side (gbrp, trimmed to n+1 frames)."""
    norm = f"fps={fps},scale={w}:{h},setsar=1,format=gbrp"
    yuv_out = ",scale=out_color_matrix=bt709:out_range=full,format=yuv444p"
    pre = f"tpad=start_mode=clone:start_duration={pad:.4f}," if pad > 0 else ""
    chain = f"[{i}:v]{norm},{pre}tpad=stop_mode=clone:stop_duration=5,trim=end_frame={n + 1},setpts=PTS-STARTPTS"
    if zoom:
        chain += (
            f",split=2[{lab}z0][{lab}z1];"
            f"[{lab}z1]scale=w='trunc({w}*({zoom})/2)*2':h='trunc({h}*({zoom})/2)*2':eval=frame[{lab}z2];"
            f"[{lab}z0][{lab}z2]overlay=x='(W-w)/2':y='(H-h)/2':eval=frame,format=gbrp,setsar=1"
        )
    if yuv:
        chain += yuv_out
    return chain + f",fps={fps}[{lab}]"


def xfade_window_filters(win: dict, ia: int, ib: int, w: int, h: int, label: str, *,
                         a_pad_start: float = 0.0, b_pad_start: float = 0.0) -> str:
    """[ia]/[ib] are window inputs already seeked to the window start; output [label] = N frames at pts w0."""
    n = int(win["frames"])
    fps = MOTION_FPS
    ttype = win["type"]
    gbrp_back = ",scale=in_color_matrix=bt709:in_range=full,format=gbrp"

    za = f"1+{ZOOM_AMOUNT}*round(t*{fps})/{n}" if ttype == "zoom_in" else None
    zb = f"1+{ZOOM_AMOUNT}*(1-round(t*{fps})/{n})" if ttype == "zoom_out" else None
    dur = n / fps
    w0 = win["startFrame"] / fps
    k_expr = f"round(t*{fps})"
    p_expr = f"1-{k_expr}/{n}"

    if ttype in COVER_TRANSITIONS or ttype in REVEAL_TRANSITIONS:
        base_lab = f"{label}a" if ttype in COVER_TRANSITIONS else f"{label}b"
        top_lab = f"{label}b" if ttype in COVER_TRANSITIONS else f"{label}a"
        if ttype == "cover_left":
            ox = f"floor({w}*({p_expr})+0.5)"
            oy = "0"
        elif ttype == "cover_right":
            ox = f"-floor({w}*({p_expr})+0.5)"
            oy = "0"
        elif ttype == "cover_up":
            ox = "0"
            oy = f"floor({h}*({p_expr})+0.5)"
        elif ttype == "cover_down":
            ox = "0"
            oy = f"-floor({h}*({p_expr})+0.5)"
        elif ttype == "reveal_left":
            ox = f"-floor({w}*(1-({p_expr}))+0.5)"
            oy = "0"
        elif ttype == "reveal_right":
            ox = f"floor({w}*(1-({p_expr}))+0.5)"
            oy = "0"
        elif ttype == "reveal_up":
            ox = "0"
            oy = f"-floor({h}*(1-({p_expr}))+0.5)"
        else:  # reveal_down
            ox = "0"
            oy = f"floor({h}*(1-({p_expr}))+0.5)"
        return ";".join([
            _window_src_chain(ia, a_pad_start, f"{label}a", za, w, h, n, fps),
            _window_src_chain(ib, b_pad_start, f"{label}b", zb, w, h, n, fps),
            f"[{base_lab}][{top_lab}]overlay=x='{ox}':y='{oy}':eval=frame,"
            f"trim=end_frame={n},format=yuv420p,setpts=PTS-STARTPTS+{w0:.6f}/TB[{label}]",
        ])

    yuv_xfade = ttype == "fade_grays"
    parts = [
        _window_src_chain(ia, a_pad_start, f"{label}a", za, w, h, n, fps, yuv=yuv_xfade),
        _window_src_chain(ib, b_pad_start, f"{label}b", zb, w, h, n, fps, yuv=yuv_xfade),
    ]
    xfade_line = (
        f"[{label}a][{label}b]xfade=transition={XFADE_NAME[ttype]}:duration={dur:.6f}:offset=0,"
    )
    if yuv_xfade:
        xfade_line += gbrp_back + ","
    xfade_line += f"trim=end_frame={n},format=yuv420p,setpts=PTS-STARTPTS+{w0:.6f}/TB[{label}]"
    parts.append(xfade_line)
    return ";".join(parts)


def _window_inputs(win: dict, clip_start_ms: int, full_dur_s: float) -> tuple[float, float, float, float, float]:
    n = int(win["frames"])
    w0_ms = win.get("w0Ms")
    if w0_ms is None:
        w0_ms = win["startFrame"] * 1000.0 / MOTION_FPS
    # Same handle mapping as preview mainFrame (motion-frame.ts): source ms at window start.
    a_src_ms = win["aEnd"] + (w0_ms - win["cutMs"])
    b_src_ms = win["bStart"] + (w0_ms - win["cutMs"])
    a_s = (a_src_ms - clip_start_ms) / 1000.0
    b_s = (b_src_ms - clip_start_ms) / 1000.0
    a_pad = max(0.0, -a_s)
    b_pad = max(0.0, -b_s)
    a_s = max(0.0, a_s)
    b_s = max(0.0, b_s)
    span = n / MOTION_FPS + 0.5
    runway = max(span, (n + 2) / MOTION_FPS + max(a_pad, b_pad) + 1.0) + 0.05
    if full_dur_s > 0:
        a_s = min(a_s, max(0.0, full_dur_s - runway))
        b_s = min(b_s, max(0.0, full_dur_s - runway))
    return a_s, b_s, a_pad, b_pad, span


def window_decode_cmd(full_render: Path, seek_s: float, span_s: float, pad: float, n: int, w: int, h: int) -> list[str]:
    chain = _window_src_chain(0, pad, "windec", None, w, h, n)
    decode_t = max(span_s, (n + 2) / MOTION_FPS + max(0.0, pad) + 2.0)
    return [
        "ffmpeg", "-v", "error", "-ss", f"{seek_s:.4f}", "-t", f"{decode_t:.4f}", "-i", str(full_render),
        "-filter_complex", f"{chain};[windec]scale=out_color_matrix=bt709:out_range=full,format=rgb24[vout]",
        "-map", "[vout]", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:",
    ]


def build_cut_transition_cmd(
    cut_mp4: Path,
    full_render: Path,
    out: Path,
    windows: list[dict],
    clip_start_ms: int,
    w: int,
    h: int,
    full_dur_s: float,
    *,
    rendered: dict[int, Path] | None = None,
) -> list[str]:
    cmd = ["ffmpeg", "-y", "-v", "error", "-i", str(cut_mp4)]
    parts = ["[0:v]format=yuv420p,setsar=1[base]"]
    cur = "base"
    idx = 1
    rendered = rendered or {}
    for i, win in enumerate(windows):
        n = int(win["frames"])
        w0 = win["startFrame"] / MOTION_FPS
        lab = f"x{i}"
        if i in rendered:
            cmd += ["-i", str(rendered[i])]
            parts.append(shader_rendered_window_filter(idx, n, w, h, w0, lab))
            idx += 1
        else:
            a_s, b_s, a_pad, b_pad, span = _window_inputs(win, clip_start_ms, full_dur_s)
            for s in (max(0.0, a_s), max(0.0, b_s)):
                cmd += ["-ss", f"{s:.4f}", "-t", f"{span:.4f}", "-i", str(full_render)]
            parts.append(xfade_window_filters(win, idx, idx + 1, w, h, lab, a_pad_start=a_pad, b_pad_start=b_pad))
            idx += 2
        w1 = (win["startFrame"] + n) / MOTION_FPS
        parts.append(
            f"[{cur}][{lab}]overlay=0:0:eof_action=pass:enable='between(t,{w0 - 0.5 / MOTION_FPS:.6f},{w1 - 0.5 / MOTION_FPS:.6f})'[c{i}]"
        )
        cur = f"c{i}"
    cmd += ["-filter_complex", ";".join(parts), "-map", f"[{cur}]", "-map", "0:a?", *X264, "-c:a", "copy", str(out)]
    return cmd


def apply_cut_transitions(
    cut_mp4: Path,
    full_render: Path,
    out: Path,
    segs_ms: list[tuple[int, int]],
    transitions,
    clip_start_ms: int,
    *,
    work_dir: Path | None = None,
    render_meta: dict | None = None,
) -> bool:
    windows = cut_transition_windows(segs_ms, transitions)
    if not windows:
        return False
    w, h, _ = probe_size_duration(cut_mp4)
    _, _, full_dur = probe_size_duration(full_render)
    rendered: dict[int, Path] = {}
    shader_n = 0
    fallback_n = 0
    renderer = ""
    if work_dir and any(win["type"] in SHADER_TRANSITIONS for win in windows):
        from clips_worker.shader_transitions import ShaderUnavailable, render_shader_windows

        t0 = time.perf_counter()
        try:
            rendered, shader_n, fallback_n, renderer, fb_meta = render_shader_windows(
                windows, full_render, clip_start_ms, full_dur, w, h, Path(work_dir), render_meta,
            )
            if render_meta is not None and fb_meta:
                render_meta.setdefault("shader_fallback", []).extend(fb_meta)
        except Exception as exc:  # noqa: BLE001
            print(f"[clipper:transitions] shader_init_fail reason={type(exc).__name__}:{str(exc)[:120]}", flush=True)
        shader_ms = int((time.perf_counter() - t0) * 1000)
        print(
            f"[clipper:transitions] cut windows={len(windows)} shader={shader_n} fallback={fallback_n} "
            f"renderer={renderer or 'none'} shader_ms={shader_ms}",
            flush=True,
        )
    fb_meta: list[dict] = []
    if render_meta is not None and render_meta.get("shader_fallback"):
        fb_meta = list(render_meta["shader_fallback"])
    for i in list(rendered.keys()):
        need = int(windows[i]["frames"])
        got = probe_video_nb_frames(rendered[i])
        if got >= need:
            continue
        win = windows[i]
        rendered.pop(i, None)
        fallback_n += 1
        entry = {"type": win["type"], "win": i, "reason": f"short_mkv:frames={got}<{need}"}
        fb_meta.append(entry)
        print(
            f"[clipper:transitions] shader_fallback type={win['type']} win={i} reason={entry['reason']}",
            flush=True,
        )
    if render_meta is not None and fb_meta:
        render_meta["shader_fallback"] = fb_meta

    while True:
        cmd = build_cut_transition_cmd(
            cut_mp4, full_render, out, windows, clip_start_ms, w, h, full_dur, rendered=rendered,
        )
        try:
            _run_cut_transition_ffmpeg(cmd)
            break
        except subprocess.CalledProcessError as exc:
            if not rendered:
                raise
            err = str(exc.stderr or "")
            m = _SHADER_WIN_RE.search(err)
            idx = int(m.group(1)) if m else min(rendered.keys())
            if idx not in rendered:
                idx = min(rendered.keys())
            win = windows[idx]
            rendered.pop(idx, None)
            fallback_n += 1
            entry = {"type": win["type"], "win": idx, "reason": "overlay_failed:crossfade_fallback"}
            fb_meta.append(entry)
            if render_meta is not None:
                render_meta.setdefault("shader_fallback", []).extend([entry])
            print(
                f"[clipper:transitions] shader_fallback type={win['type']} win={idx} "
                "reason=overlay_failed:crossfade_fallback",
                flush=True,
            )
    if not shader_n and not fallback_n:
        print(f"[clipper:transitions] cut windows={len(windows)}", flush=True)
    return True


def main_kf_bg_filter(edits: dict, w: int, h: int) -> str:
    bg = canvas_bg(edits)
    if canvas_bg_flat(bg) and bg["type"] == "color":
        return f"[bgs]drawbox=x=0:y=0:w=iw:h=ih:color=0x{bg['color']}:t=fill[bg]"
    if canvas_bg_flat(bg) and bg["type"] == "image":
        p = _escape_movie_path(bg["path"])
        return (
            f"[bgs]drawbox=x=0:y=0:w=iw:h=ih:color=black:t=fill[bgk];"
            f"movie='{p}',scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},setsar=1,format=rgba[bgi];"
            f"[bgk][bgi]overlay=0:0:eof_action=repeat[bg]"
        )
    return "[bgs]drawbox=x=0:y=0:w=iw:h=ih:color=black:t=fill[bg]"


def apply_main_keyframes(video: Path, out: Path, edits: dict, work_dir: Path) -> bool:
    """Video-lane keyframes / crop / flip: transform the main video layer over the canvas background."""
    if not has_layer_fx(edits, "video"):
        return False
    w, h, dur = probe_size_duration(video)
    cmd_file = Path(work_dir) / "main_kf.cmd"
    graph, tags = layer_motion_chain(
        edits, "video", w=w, h=h, origin_s=0.0, label_in="src", label_out="kf",
        bg_label="bg", cmd_file=str(cmd_file),
    )
    if tags:
        cmd_file.write_text(layer_sendcmd(edits, "video", tags, w=w, h=h, start_s=0, end_s=dur + 1, origin_s=0.0))
    fc = (
        "[0:v]setsar=1,format=rgba,split=2[src][bgs];"
        f"{main_kf_bg_filter(edits, w, h)};"
        f"{graph};[kf]format=yuv420p[vout]"
    )
    subprocess.check_call(
        ["ffmpeg", "-y", "-v", "error", "-i", str(video), "-filter_complex", fc,
         "-map", "[vout]", "-map", "0:a?", *X264, "-c:a", "copy", str(out)]
    )
    print("[clipper:keyframes] main video", flush=True)
    return True


def apply_voice_volume(video: Path, out: Path, edits: dict) -> bool:
    expr = volume_expr(edits, "voice")
    if not expr:
        return False
    subprocess.check_call(
        ["ffmpeg", "-y", "-v", "error", "-i", str(video), "-map", "0:v:0", "-map", "0:a:0", "-c:v", "copy",
         "-af", f"volume='{expr}':eval=frame", "-c:a", "aac", "-b:a", "192k", str(out)]
    )
    print("[clipper:keyframes] voice volume", flush=True)
    return True


def apply_motion_after_cut(
    cut_mp4: Path,
    full_render: Path,
    edits: dict,
    segs_ms: list[tuple[int, int]],
    clip_start_ms: int,
    work_dir: Path,
    render_meta: dict | None = None,
) -> Path:
    """cut.mp4 → (+cut transitions) → (+main keyframes). Returns the new video path."""
    cur = cut_mp4
    if edits.get("transitions"):
        out = Path(work_dir) / "cut_transitions.mp4"
        if apply_cut_transitions(
            cur, full_render, out, segs_ms, edits.get("transitions"), clip_start_ms,
            work_dir=work_dir, render_meta=render_meta,
        ):
            cur = out
    out = Path(work_dir) / "main_keyframes.mp4"
    if apply_main_keyframes(cur, out, edits, work_dir):
        cur = out
    return cur
