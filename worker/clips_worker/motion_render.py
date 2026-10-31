"""E3 export passes: Video-lane cut transitions (xfade), main-video keyframes, voice volume envelope.

Timing contract (keeps captions / audio / B-roll / SFX in sync): a cut transition never changes the
output length. It is centred on the cut, video only, and uses handle frames from full_render.mp4
(A continues past its out-point, B starts before its in-point); audio stays a hard cut.
"""
from __future__ import annotations

import subprocess
from pathlib import Path

from clips_worker.motion import (
    MOTION_FPS,
    XFADE_NAME,
    ZOOM_AMOUNT,
    cut_transition_windows,
    has_layer_fx,
    layer_motion_chain,
    layer_sendcmd,
    volume_expr,
)

X264 = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p"]


def probe_size_duration(video: Path) -> tuple[int, int, float]:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration",
         "-of", "default=noprint_wrappers=1", str(video)],
        capture_output=True, text=True, check=True,
    ).stdout
    vals = dict(line.split("=", 1) for line in out.splitlines() if "=" in line)
    return int(vals["width"]), int(vals["height"]), float(vals.get("duration") or 0)


def xfade_window_filters(win: dict, ia: int, ib: int, w: int, h: int, label: str, *,
                         a_pad_start: float = 0.0, b_pad_start: float = 0.0) -> str:
    """[ia]/[ib] are window inputs already seeked to the window start; output [label] = N frames at pts w0."""
    n = int(win["frames"])
    fps = MOTION_FPS
    # xfade runs in RGB (gbrp) so dip-to-black / white are true #000 / #fff, exactly the preview's CSS
    # colour layer (in limited-range YUV xfade's black / white are super-black / super-white).
    norm = f"fps={fps},scale={w}:{h},setsar=1,format=gbrp"

    def src(i: int, pad: float, lab: str, zoom: str | None) -> str:
        pre = f"tpad=start_mode=clone:start_duration={pad:.4f}," if pad > 0 else ""
        chain = f"[{i}:v]{norm},{pre}tpad=stop_mode=clone:stop_duration=5,trim=end_frame={n + 1},setpts=PTS-STARTPTS"
        if zoom:
            # Centred zoom ≥ 1: scale per frame, then overlay centred on the unscaled frame (fully
            # covered). crop's x/y do not follow per-frame size changes reliably across versions.
            chain += (
                f",split=2[{lab}z0][{lab}z1];"
                f"[{lab}z1]scale=w='trunc({w}*({zoom})/2)*2':h='trunc({h}*({zoom})/2)*2':eval=frame[{lab}z2];"
                f"[{lab}z0][{lab}z2]overlay=x='(W-w)/2':y='(H-h)/2':eval=frame,format=gbrp,setsar=1"
            )
        # tpad / trim drop the stream frame rate; xfade requires a constant one.
        return chain + f",fps={fps}[{lab}]"

    # Frame index from t (scale's `n` differs between ffmpeg 5.1 and 7.x after a size change).
    za = f"1+{ZOOM_AMOUNT}*round(t*{fps})/{n}" if win["type"] == "zoom_in" else None
    zb = f"1+{ZOOM_AMOUNT}*(1-round(t*{fps})/{n})" if win["type"] == "zoom_out" else None
    dur = n / fps
    w0 = win["startFrame"] / fps
    return ";".join([
        src(ia, a_pad_start, f"{label}a", za),
        src(ib, b_pad_start, f"{label}b", zb),
        # One spare input frame each: ffmpeg 5.1 ends the transition when input A hits EOF, which
        # would turn the last window frame into plain B. The output is trimmed back to N frames.
        f"[{label}a][{label}b]xfade=transition={XFADE_NAME[win['type']]}:duration={dur:.6f}:offset=0,"
        f"trim=end_frame={n},format=yuv420p,setpts=PTS-STARTPTS+{w0:.6f}/TB[{label}]",
    ])


def build_cut_transition_cmd(cut_mp4: Path, full_render: Path, out: Path, windows: list[dict],
                             clip_start_ms: int, w: int, h: int, full_dur_s: float) -> list[str]:
    cmd = ["ffmpeg", "-y", "-v", "error", "-i", str(cut_mp4)]
    parts = ["[0:v]format=yuv420p,setsar=1[base]"]
    cur = "base"
    idx = 1
    for i, win in enumerate(windows):
        n = int(win["frames"])
        off_s = (win["startFrame"] / MOTION_FPS) - win["cutMs"] / 1000.0  # w0 − cut (≤ 0)
        a_s = (win["aEnd"] - clip_start_ms) / 1000.0 + off_s
        b_s = (win["bStart"] - clip_start_ms) / 1000.0 + off_s
        a_pad = max(0.0, -a_s)
        b_pad = max(0.0, -b_s)
        span = n / MOTION_FPS + 0.5
        for s in (max(0.0, a_s), max(0.0, b_s)):
            s = min(s, max(0.0, full_dur_s - 1.0 / MOTION_FPS))
            cmd += ["-ss", f"{s:.4f}", "-t", f"{span:.4f}", "-i", str(full_render)]
        lab = f"x{i}"
        parts.append(xfade_window_filters(win, idx, idx + 1, w, h, lab, a_pad_start=a_pad, b_pad_start=b_pad))
        w0 = win["startFrame"] / MOTION_FPS
        w1 = (win["startFrame"] + n) / MOTION_FPS
        parts.append(
            f"[{cur}][{lab}]overlay=0:0:eof_action=pass:enable='between(t,{w0 - 0.5 / MOTION_FPS:.6f},{w1 - 0.5 / MOTION_FPS:.6f})'[c{i}]"
        )
        cur = f"c{i}"
        idx += 2
    cmd += ["-filter_complex", ";".join(parts), "-map", f"[{cur}]", "-map", "0:a?", *X264, "-c:a", "copy", str(out)]
    return cmd


def apply_cut_transitions(cut_mp4: Path, full_render: Path, out: Path, segs_ms: list[tuple[int, int]],
                          transitions, clip_start_ms: int) -> bool:
    windows = cut_transition_windows(segs_ms, transitions)
    if not windows:
        return False
    w, h, _ = probe_size_duration(cut_mp4)
    _, _, full_dur = probe_size_duration(full_render)
    subprocess.check_call(build_cut_transition_cmd(cut_mp4, full_render, out, windows, clip_start_ms, w, h, full_dur))
    print(f"[clipper:transitions] cut windows={len(windows)}", flush=True)
    return True


def apply_main_keyframes(video: Path, out: Path, edits: dict, work_dir: Path) -> bool:
    """Video-lane keyframes / crop / flip: transform the main video layer over black (CapCut canvas)."""
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
        "[bgs]drawbox=x=0:y=0:w=iw:h=ih:color=black:t=fill[bg];"
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


def apply_motion_after_cut(cut_mp4: Path, full_render: Path, edits: dict, segs_ms: list[tuple[int, int]],
                           clip_start_ms: int, work_dir: Path) -> Path:
    """cut.mp4 → (+cut transitions) → (+main keyframes). Returns the new video path."""
    cur = cut_mp4
    if edits.get("transitions"):
        out = Path(work_dir) / "cut_transitions.mp4"
        if apply_cut_transitions(cur, full_render, out, segs_ms, edits.get("transitions"), clip_start_ms):
            cur = out
    out = Path(work_dir) / "main_keyframes.mp4"
    if apply_main_keyframes(cur, out, edits, work_dir):
        cur = out
    return cur
