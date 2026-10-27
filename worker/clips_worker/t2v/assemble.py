"""T2V_ASSEMBLE: build one ClipProject source mp4 from a T2V draft.

Pipeline per draft (all ffmpeg, CPU, ffmpeg >= 5.1 — prod has 5.1.9):
  1. normalize_scene(): each scene's media -> exact-length W x H @ fps, yuv420p, no audio.
     * video: -ss/-t trim from the ranked stock clip, cover-fit (scale+crop), loop if short.
     * image: Ken Burns with zoompan (zoom in / zoom out / pan), cover-fit first.
     * color: solid background (title cards / missing media fallback).
  2. xfade_chain(): join scene clips with xfade so transitions START exactly at the scene
     boundary: every scene except the last is extended by T (transition seconds), so the
     k-th xfade offset == sum of the first k+1 scene durations. Scene start times therefore
     match VO start times exactly (no drift), which keeps transcript word timings valid.
  3. concat_voiceover(): per-scene TTS wavs padded to scene length (apad/atrim) and
     concatenated -> one 48 kHz mono VO track.
  4. mux(): video + VO -> source.mp4 (H.264 / AAC, +faststart). Music is NOT baked in;
     it is written to the FULL ScriptComposition as musicTracks[] (duckUnderSpeech) so the
     existing RENDER_SCRIPT_COMPOSITION / audio_render.build_audio_filter ducks it at export.
"""
from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

XFADE_TRANSITIONS = {
    # Transovo name -> ffmpeg xfade transition (see https://ffmpeg.org/ffmpeg-filters.html#xfade)
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
    kind: str  # "video" | "image" | "color"
    path: Path | None = None
    src_in_s: float = 0.0  # trim start inside the stock clip
    focal_x: float = 0.5  # 0..1 crop centre (InVideo "center point")
    focal_y: float = 0.5
    ken_burns: str = "zoom_in"  # zoom_in | zoom_out | pan_left | pan_right | none
    color: str = "0x111111"


@dataclass
class Scene:
    id: str
    dur_s: float
    media: SceneMedia
    transition: str = "fade"  # transition INTO the next scene
    transition_s: float = 0.5
    vo_path: Path | None = None
    extra: dict = field(default_factory=dict)


def run(cmd: list[str]) -> None:
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg failed ({proc.returncode}): {' '.join(cmd)}\n{proc.stderr[-2000:]}")


def probe_duration(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(path)],
        capture_output=True, text=True, check=True,
    ).stdout
    return float(json.loads(out)["format"]["duration"])


def _cover_fit(w: int, h: int, fx: float, fy: float) -> str:
    """Scale to cover W x H, then crop around the focal point (0..1)."""
    fx = min(1.0, max(0.0, fx))
    fy = min(1.0, max(0.0, fy))
    return (
        f"scale={w}:{h}:force_original_aspect_ratio=increase,"
        f"crop={w}:{h}:(iw-{w})*{fx:.3f}:(ih-{h})*{fy:.3f}"
    )


def _ken_burns(mode: str, w: int, h: int, fps: int, frames: int) -> str:
    """zoompan on a pre-scaled (2x) still. d=frames gives one output frame per step."""
    step = 0.15 / max(1, frames)  # 1.00 -> 1.15 over the scene
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
    else:  # zoom_in
        z = f"min(zoom+{step:.6f},1.15)"
        x, y = "iw/2-(iw/zoom/2)", "ih/2-(ih/zoom/2)"
    return f"zoompan=z='{z}':x='{x}':y='{y}':d={frames}:s={w}x{h}:fps={fps}"


def normalize_scene(scene: Scene, out: Path, *, w: int, h: int, fps: int, length_s: float) -> Path:
    """Render one scene to exactly length_s seconds of silent video."""
    m = scene.media
    frames = max(1, round(length_s * fps))
    common_out = ["-an", "-r", str(fps), "-pix_fmt", "yuv420p", "-c:v", "libx264", "-preset", "veryfast",
                  "-crf", "20", "-frames:v", str(frames), str(out)]
    if m.kind == "video" and m.path:
        src_len = probe_duration(m.path)
        loop = ["-stream_loop", "-1"] if src_len - m.src_in_s < length_s else []
        vf = f"{_cover_fit(w, h, m.focal_x, m.focal_y)},fps={fps},setsar=1"
        run(["ffmpeg", "-y", "-v", "error", *loop, "-ss", f"{m.src_in_s:.3f}", "-i", str(m.path),
             "-t", f"{length_s:.3f}", "-vf", vf, *common_out])
    elif m.kind == "image" and m.path:
        # Pre-scale to 2x cover size so zoompan has pixels to crop (avoids jitter).
        vf = (f"{_cover_fit(w * 2, h * 2, m.focal_x, m.focal_y)},"
              f"{_ken_burns(m.ken_burns, w, h, fps, frames)},setsar=1")
        run(["ffmpeg", "-y", "-v", "error", "-loop", "1", "-i", str(m.path), "-vf", vf, *common_out])
    else:
        run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i",
             f"color=c={m.color}:s={w}x{h}:r={fps}:d={length_s:.3f}", *common_out])
    return out


def xfade_filter(durations: list[float], transitions: list[tuple[str | None, float]]) -> tuple[str, str]:
    """Build the filter_complex for N inputs [0:v]..[N-1:v].

    durations[k]   = clip length actually rendered for input k (scene dur + T_k if k < N-1)
    transitions[k] = (xfade name, T_k) between input k and k+1. A hard "cut" is passed as
                     ("fade", 1/fps): a one-frame fade is visually a cut and keeps the graph uniform.
    """
    n = len(durations)
    if n == 1:
        return "[0:v]null[vout]", "[vout]"
    parts: list[str] = []
    prev = "[0:v]"
    acc = 0.0
    for k in range(n - 1):
        name, t = transitions[k]
        name = name or "fade"
        acc += durations[k] - t  # offset where the transition starts in the output timeline
        label = f"[x{k}]" if k < n - 2 else "[vout]"
        parts.append(f"{prev}[{k + 1}:v]xfade=transition={name}:duration={t:.3f}:offset={acc:.3f}{label}")
        prev = label
    return ";".join(parts), "[vout]"


def xfade_chain(scene_files: list[Path], durations: list[float], transitions: list[tuple[str | None, float]],
                out: Path, fps: int) -> Path:
    fc, label = xfade_filter(durations, transitions)
    cmd = ["ffmpeg", "-y", "-v", "error"]
    for f in scene_files:
        cmd += ["-i", str(f)]
    cmd += ["-filter_complex", fc, "-map", label, "-r", str(fps), "-pix_fmt", "yuv420p",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", str(out)]
    run(cmd)
    return out


def concat_voiceover(scenes: list[Scene], out: Path, sample_rate: int = 48000) -> Path:
    """Pad/trim each scene VO to the scene duration and concatenate (silence where no VO)."""
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
    run(["ffmpeg", "-y", "-v", "error", "-i", str(video), "-i", str(audio), "-map", "0:v", "-map", "1:a",
         "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", str(out)])
    return out


def assemble(scenes: list[Scene], work: Path, *, w: int, h: int, fps: int = 30) -> dict:
    """Returns {'source': Path, 'durationMs': int, 'sceneStartsMs': [..]}."""
    work.mkdir(parents=True, exist_ok=True)
    files, durs, trans = [], [], []
    for k, s in enumerate(scenes):
        is_last = k == len(scenes) - 1
        name = XFADE_TRANSITIONS.get(s.transition, "fade")
        t = 0.0 if is_last else (1.0 / fps if name is None else max(1.0 / fps, min(s.transition_s, s.dur_s / 2)))
        length = s.dur_s + t  # extend by T so the transition begins at the boundary
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
