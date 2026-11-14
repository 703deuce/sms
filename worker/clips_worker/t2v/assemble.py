"""T2V scene video assembly (normalize, xfade transitions, VO concat, mux).

Music is not baked here (composition musicTracks + audio_render at export).
Titles/brand hooks are applied in later pipeline stages (titles_ass, brand_concat).
"""
from __future__ import annotations

import json
import logging
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

log = logging.getLogger(__name__)

XFADE_TRANSITIONS = {
    "cut": None,
    "fade": "fade",
    "dissolve": "dissolve",
    "fade_black": "fadeblack",
    "fade_white": "fadewhite",
    "slide_left": "slideleft",
    "slide_right": "slideright",
    "slide_up": "slideup",
    "wipe_left": "wipeleft",
    "circle_open": "circleopen",
    "zoom_in": "zoomin",
    "smooth_left": "smoothleft",
}


@dataclass
class SceneMedia:
    kind: str
    path: Path | None = None
    src_in_s: float = 0.0
    focal_x: float = 0.5
    focal_y: float = 0.5
    ken_burns: str = "zoom_in"
    color: str = "0x111111"
    # Prompt-to-Video: the verified playback window (s) the footage check judged; logged against the rendered one.
    window_in_s: float | None = None
    window_out_s: float | None = None
    label: str = ""


@dataclass
class Scene:
    id: str
    dur_s: float
    media: SceneMedia
    transition: str = "fade"
    transition_s: float = 0.5
    vo_path: Path | None = None
    extra: dict = field(default_factory=dict)
    # Optional hard cuts inside the scene (Prompt-to-Video pacing): (offset_s from scene start, media).
    # The scene's own media plays until the first cut. Empty for storyboard-editor scenes (unchanged).
    cuts: list[tuple[float, SceneMedia]] = field(default_factory=list)


def run(cmd: list[str]) -> None:
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg failed ({proc.returncode}): {' '.join(cmd)}\n{proc.stderr[-2000:]}")


def probe_duration(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(path)],
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    return float(json.loads(out)["format"]["duration"])


def _cover_fit(w: int, h: int, fx: float, fy: float) -> str:
    fx = min(1.0, max(0.0, fx))
    fy = min(1.0, max(0.0, fy))
    return (
        f"scale={w}:{h}:force_original_aspect_ratio=increase,"
        f"crop={w}:{h}:(iw-{w})*{fx:.3f}:(ih-{h})*{fy:.3f}"
    )


def _ken_burns(mode: str, w: int, h: int, fps: int, frames: int) -> str:
    step = 0.15 / max(1, frames)
    if mode == "zoom_out":
        z = f"if(eq(on,0),1.15,max(1.0,zoom-{step:.6f}))"
        x, y = "iw/2-(iw/zoom/2)", "ih/2-(ih/zoom/2)"
    elif mode == "pan_left":
        z = "1.15"
        x, y = f"(iw-iw/zoom)*(1-on/{frames})", "ih/2-(ih/zoom/2)"
    elif mode == "pan_right":
        z = "1.15"
        x, y = f"(iw-iw/zoom)*(on/{frames})", "ih/2-(ih/zoom/2)"
    elif mode == "none":
        z, x, y = "1", "0", "0"
    else:
        z = f"min(zoom+{step:.6f},1.15)"
        x, y = "iw/2-(iw/zoom/2)", "ih/2-(ih/zoom/2)"
    return f"zoompan=z='{z}':x='{x}':y='{y}':d={frames}:s={w}x{h}:fps={fps}"


def cut_lengths(length_s: float, offsets: list[float], fps: int) -> list[int]:
    """Frame counts per sub-shot for cuts at `offsets` (seconds) inside a scene of length_s; sums exactly."""
    total = max(1, round(length_s * fps))
    marks = [0] + [min(total - 1, max(1, round(o * fps))) for o in sorted(offsets)] + [total]
    return [b - a for a, b in zip(marks, marks[1:]) if b - a > 0]


def normalize_scene(scene: Scene, out: Path, *, w: int, h: int, fps: int, length_s: float) -> Path:
    if scene.cuts:
        return _normalize_with_cuts(scene, out, w=w, h=h, fps=fps, length_s=length_s)
    return _normalize_one(scene.media, out, w=w, h=h, fps=fps, length_s=length_s)


def _normalize_with_cuts(scene: Scene, out: Path, *, w: int, h: int, fps: int, length_s: float) -> Path:
    medias = [scene.media] + [m for _, m in sorted(scene.cuts, key=lambda c: c[0])]
    frames = cut_lengths(length_s, [o for o, _ in scene.cuts], fps)
    parts: list[Path] = []
    for k, (m, n) in enumerate(zip(medias, frames)):
        parts.append(_normalize_one(m, out.with_name(f"{out.stem}_p{k}.mp4"), w=w, h=h, fps=fps, length_s=n / fps))
    lst = out.with_name(f"{out.stem}_parts.txt")
    lst.write_text("".join(f"file '{p.resolve()}'\n" for p in parts))
    run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(lst), "-an", "-r", str(fps),
         "-pix_fmt", "yuv420p", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
         "-frames:v", str(sum(frames)), str(out)])
    return out


def render_start(src_in_s: float, src_len: float, length_s: float) -> tuple[float, bool]:
    """(start, loop) for playing length_s from src_in_s. The verified window starts at src_in_s and plays
    unchanged when the clip has room. When the line runs past the clip end the start moves back just enough
    (extending around the window) instead of looping, which jumped back to second 0 mid-shot. Loops only when
    the whole clip is shorter than the shot."""
    start = max(0.0, float(src_in_s or 0))
    if src_len <= 0:
        return start, False
    if src_len >= length_s:
        return round(min(start, src_len - length_s), 3), False
    return 0.0, True


def window_report(m: SceneMedia, start: float, length_s: float, loop: bool) -> dict:
    rendered = [round(start, 2), round(start + length_s, 2)]
    out = {"media": m.label, "rendered": rendered, "looped": loop}
    if m.window_in_s is not None and m.window_out_s is not None:
        a, b = round(m.window_in_s, 2), round(m.window_out_s, 2)
        out["verified"] = [a, b]
        # Seconds that play outside the verified window (the line ran longer than the verified slice).
        out["outsideS"] = round(max(0.0, a - rendered[0]) + max(0.0, rendered[1] - b), 2)
        out["startMatches"] = abs(rendered[0] - a) < 0.05
    return out


def log_render_window(m: SceneMedia, start: float, length_s: float, loop: bool) -> None:
    log.info("[t2v:assemble:window] %s", json.dumps(window_report(m, start, length_s, loop)))


ALPHA_PIX_FMTS = ("rgba", "bgra", "argb", "abgr", "ya8", "ya16", "yuva", "pal8", "gbrap", "rgba64")


def flatten_alpha(path: Path) -> Path:
    """A photo with transparency (cut-out PNG) is flattened onto white first; dropping the alpha showed the
    hidden edge colours as smeared, stretched edges (snow #1194 L5). Other images are returned as is."""
    try:
        fmt = subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=pix_fmt", "-of", "csv=p=0", str(path)],
            capture_output=True, text=True,
        ).stdout.strip()
    except Exception:  # noqa: BLE001
        return path
    if not fmt.startswith(ALPHA_PIX_FMTS):
        return path
    out = path.with_name(f"{path.stem}_flat.png")
    proc = subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-i", str(path), "-filter_complex",
         "[0:v]format=rgba,split[fg][s];[s]drawbox=t=fill:c=white,format=rgb24[bg];[bg][fg]overlay=format=auto,format=rgb24",
         "-frames:v", "1", str(out)],
        capture_output=True, text=True,
    )
    return out if proc.returncode == 0 and out.exists() else path


def _normalize_one(m: SceneMedia, out: Path, *, w: int, h: int, fps: int, length_s: float) -> Path:
    frames = max(1, round(length_s * fps))
    common_out = [
        "-an", "-r", str(fps), "-pix_fmt", "yuv420p", "-c:v", "libx264", "-preset", "veryfast",
        "-crf", "20", "-frames:v", str(frames), str(out),
    ]
    if m.kind == "video" and m.path:
        src_len = probe_duration(m.path)
        start, loop = render_start(m.src_in_s, src_len, length_s)
        log_render_window(m, start, length_s, loop)
        vf = f"{_cover_fit(w, h, m.focal_x, m.focal_y)},fps={fps},setsar=1"
        run(["ffmpeg", "-y", "-v", "error", *(["-stream_loop", "-1"] if loop else []), "-ss", f"{start:.3f}",
             "-i", str(m.path), "-t", f"{length_s:.3f}", "-vf", vf, *common_out])
    elif m.kind == "image" and m.path:
        vf = (
            f"{_cover_fit(w * 2, h * 2, m.focal_x, m.focal_y)},"
            f"{_ken_burns(m.ken_burns, w, h, fps, frames)},setsar=1"
        )
        src = flatten_alpha(m.path)
        run(["ffmpeg", "-y", "-v", "error", "-loop", "1", "-i", str(src), "-vf", vf, *common_out])
    else:
        run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i",
             f"color=c={m.color}:s={w}x{h}:r={fps}:d={length_s:.3f}", *common_out])
    return out


def xfade_filter(durations: list[float], transitions: list[tuple[str | None, float]]) -> tuple[str, str]:
    n = len(durations)
    if n == 1:
        return "[0:v]null[vout]", "[vout]"
    parts: list[str] = []
    prev = "[0:v]"
    acc = 0.0
    for k in range(n - 1):
        name, t = transitions[k]
        name = name or "fade"
        acc += durations[k] - t
        label = f"[x{k}]" if k < n - 2 else "[vout]"
        parts.append(f"{prev}[{k + 1}:v]xfade=transition={name}:duration={t:.3f}:offset={acc:.3f}{label}")
        prev = label
    return ";".join(parts), "[vout]"


def xfade_chain(
    scene_files: list[Path],
    durations: list[float],
    transitions: list[tuple[str | None, float]],
    out: Path,
    fps: int,
) -> Path:
    fc, label = xfade_filter(durations, transitions)
    cmd = ["ffmpeg", "-y", "-v", "error"]
    for f in scene_files:
        cmd += ["-i", str(f)]
    cmd += [
        "-filter_complex", fc, "-map", label, "-r", str(fps), "-pix_fmt", "yuv420p",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", str(out),
    ]
    run(cmd)
    return out


def concat_voiceover(scenes: list[Scene], out: Path, sample_rate: int = 48000) -> Path:
    cmd = ["ffmpeg", "-y", "-v", "error"]
    parts: list[str] = []
    for i, s in enumerate(scenes):
        if s.vo_path:
            cmd += ["-i", str(s.vo_path)]
        else:
            cmd += ["-f", "lavfi", "-i", f"anullsrc=r={sample_rate}:cl=mono"]
        parts.append(
            f"[{i}:a]aresample={sample_rate},aformat=channel_layouts=mono,"
            f"apad,atrim=0:{s.dur_s:.3f},asetpts=PTS-STARTPTS[a{i}]"
        )
    parts.append("".join(f"[a{i}]" for i in range(len(scenes))) + f"concat=n={len(scenes)}:v=0:a=1[aout]")
    cmd += ["-filter_complex", ";".join(parts), "-map", "[aout]", "-c:a", "pcm_s16le", str(out)]
    run(cmd)
    return out


def mux(video: Path, audio: Path, out: Path) -> Path:
    run([
        "ffmpeg", "-y", "-v", "error", "-i", str(video), "-i", str(audio),
        "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
        "-shortest", "-movflags", "+faststart", str(out),
    ])
    return out


def assemble(scenes: list[Scene], work: Path, *, w: int, h: int, fps: int = 30) -> dict:
    work.mkdir(parents=True, exist_ok=True)
    files, durs, trans = [], [], []
    for k, s in enumerate(scenes):
        is_last = k == len(scenes) - 1
        name = XFADE_TRANSITIONS.get(s.transition, "fade")
        t = 0.0 if is_last else (1.0 / fps if name is None else max(1.0 / fps, min(s.transition_s, s.dur_s / 2)))
        length = s.dur_s + t
        files.append(normalize_scene(s, work / f"scene_{k:03d}.mp4", w=w, h=h, fps=fps, length_s=length))
        durs.append(length)
        if not is_last:
            trans.append((name, t))
    video = xfade_chain(files, durs, trans, work / "video.mp4", fps)
    vo = concat_voiceover(scenes, work / "vo.wav")
    source = mux(video, vo, work / "source.mp4")
    starts, acc = [], 0.0
    for s in scenes:
        starts.append(round(acc * 1000))
        acc += s.dur_s
    return {"source": source, "durationMs": round(acc * 1000), "sceneStartsMs": starts}
