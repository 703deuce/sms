"""Cut, speakercrop, captions, poster for one clip."""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

from clips_worker.ffmpeg_util import stderr_tail
from clips_worker.render_concurrency import ffmpeg_threads_per_job

V3 = Path(os.environ.get("SPEAKERCROP_DIR", "/app/v3"))


def aspect_size(aspect: str, resolution: str = "720p") -> tuple[int, int]:
    if resolution == "1080p":
        if aspect == "1:1":
            return 1080, 1080
        if aspect == "16:9":
            return 1920, 1080
        return 1080, 1920
    if aspect == "1:1":
        return 720, 720
    if aspect == "16:9":
        return 1280, 720
    return 720, 1280


def slice_words(words: list[dict], start_ms: int, end_ms: int) -> list[dict]:
    s = start_ms / 1000.0
    e = end_ms / 1000.0
    out = []
    for pos, w in enumerate(words):
        if w["e"] < s or w["s"] > e:
            continue
        row = {
            "w": w["w"],
            "s": round(max(0.0, w["s"] - s), 3),
            "e": round(min(e - s, w["e"] - s), 3),
            "p": w.get("p", 1),
        }
        if w.get("spk") is not None:
            row["spk"] = w["spk"]
        if w.get("i") is not None:
            row["i"] = int(w["i"])
        elif w.get("idx") is not None:
            row["i"] = int(w["idx"])
        else:
            row["i"] = pos
        out.append(row)
    return out


def probe_duration_ms(video: Path) -> int:
    out = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(video),
        ],
        text=True,
    ).strip()
    return int(float(out) * 1000)


def ffmpeg_cut(src: Path, dest: Path, start_ms: int, end_ms: int) -> None:
    threads = str(ffmpeg_threads_per_job())
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-threads",
            threads,
            "-v",
            "error",
            "-ss",
            f"{start_ms / 1000:.3f}",
            "-to",
            f"{end_ms / 1000:.3f}",
            "-i",
            str(src),
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "23",
            "-c:a",
            "aac",
            str(dest),
        ],
    )


def ffmpeg_cut_or_copy(src: Path, dest: Path, start_ms: int, end_ms: int) -> None:
    """Skip re-encode when extracting (almost) the full source."""
    try:
        dur_ms = probe_duration_ms(src)
    except Exception:
        ffmpeg_cut(src, dest, start_ms, end_ms)
        return
    span = max(0, end_ms - start_ms)
    if start_ms <= 500 and span >= dur_ms - 1000:
        subprocess.check_call(
            [
                "ffmpeg",
                "-y",
                "-v",
                "error",
                "-i",
                str(src),
                "-c",
                "copy",
                str(dest),
            ],
        )
        return
    ffmpeg_cut(src, dest, start_ms, end_ms)


AUTO_LAYOUT_STYLES = ("dynamic", "speaker_follow", "split_debate", "grid", "locked_off")


def layout_env(layout: str) -> dict[str, str]:
    layout = (layout or "speaker_follow").strip()
    env = {
        "LEAD": "0.4",
        "MIN_SEG": "0.8",
        "VOICE": "1",
        "CAPTIONS": "1",
        "SAMPLE_FPS": "10",
    }
    if layout == "split":
        env["SPLIT"] = "1"
        env["FORCE_SPLIT"] = "1"
        env["LAYOUT_MODE"] = "split"
        env["LAYOUT_STYLE"] = "split"
        env["MULTIPERSON"] = "1"
    elif layout == "fill":
        env["SPLIT"] = "0"
        env["LAYOUT_MODE"] = "fill"
        env["LAYOUT_STYLE"] = "fill"
    elif layout == "fit":
        env["SPLIT"] = "0"
        env["LAYOUT_MODE"] = "fit"
        env["LAYOUT_STYLE"] = "fit"
    elif layout in ("dynamic", "split_debate", "grid", "locked_off"):
        env["SPLIT"] = "1"
        env["LAYOUT_MODE"] = layout
        env["LAYOUT_STYLE"] = layout
        env["MULTIPERSON"] = "1"
    elif layout == "speaker_follow":
        env["SPLIT"] = "1"
        env["LAYOUT_MODE"] = "speaker_follow"
        env["LAYOUT_STYLE"] = "speaker_follow"
        env["MULTIPERSON"] = "1"
    else:
        env["SPLIT"] = "1"
        env["LAYOUT_MODE"] = "speaker_follow"
        env["LAYOUT_STYLE"] = "speaker_follow"
    return env


def resolve_clip_layout(settings: dict, clip_index: int) -> str:
    layout = (settings.get("layout") or "speaker_follow").strip()
    if layout != "auto":
        return layout
    return AUTO_LAYOUT_STYLES[clip_index % len(AUTO_LAYOUT_STYLES)]


def ffmpeg_fit_export(clip_src: Path, out_mp4: Path, width: int, height: int) -> None:
    """Fallback when speakercrop fails (short clips, missing faces, etc.)."""
    from clips_worker.filtergraph import fit_blur_overlay_filter

    vf = fit_blur_overlay_filter("0:v", "vout", width, height)
    threads = str(ffmpeg_threads_per_job())
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-threads",
            threads,
            "-v",
            "error",
            "-i",
            str(clip_src),
            "-filter_complex",
            vf,
            "-map",
            "[vout]",
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
            str(out_mp4),
        ],
    )


def speakercrop_env_for_settings(
    settings: dict,
    *,
    words_path: Path | None = None,
    clip_index: int = 0,
) -> dict[str, str]:
    """Env dict passed to speakercrop subprocess (for tests / pipeline parity)."""
    layout = resolve_clip_layout(settings, clip_index)
    env = layout_env(layout)
    if words_path is not None:
        env["WORDS"] = str(words_path)
        env["WORDS_JSON"] = str(words_path)
    return env


def run_speakercrop(
    clip_src: Path,
    out_mp4: Path,
    words_path: Path,
    settings: dict,
    work_dir: Path,
    clip_start_ms: int = 0,
    shot_overrides: list | None = None,
    crop_track_out: Path | None = None,
    no_render: bool = False,
    render_id: str | None = None,
    render_meta: dict[str, Any] | None = None,
    *,
    preserve_existing_crop_track: bool = False,
    clip_index: int = 0,
) -> Path:
    aspect = settings.get("aspectRatio", "9:16")
    resolution = settings.get("exportResolution", "720p")
    w, h = aspect_size(aspect, resolution)
    env = os.environ.copy()
    env["FFMPEG_THREADS"] = str(ffmpeg_threads_per_job())
    layout = resolve_clip_layout(settings, clip_index)
    env.update(layout_env(layout))
    env["WORDS"] = str(words_path)
    env["WORDS_JSON"] = str(words_path)
    env["OUT_W"] = str(w)
    env["OUT_H"] = str(h)
    env["CAPTION_PRESET"] = settings.get("captions", {}).get("presetId", "bold_pop")
    if not settings.get("captions", {}).get("enabled", True):
        env["CAPTIONS"] = "0"
    env["CLIP_START_MS"] = str(int(clip_start_ms))
    if preserve_existing_crop_track:
        env["WRITE_CROP_TRACK"] = "0"
    elif crop_track_out is not None:
        env["CROP_TRACK_OUT"] = str(crop_track_out)
    elif int(os.environ.get("WRITE_CROP_TRACK", "1")):
        env["CROP_TRACK_OUT"] = str(out_mp4.with_suffix(".crop_track.json"))
    if shot_overrides:
        env["SHOT_OVERRIDES"] = json.dumps(shot_overrides)
    if no_render:
        env["NORENDER"] = "1"
        env["CAPTIONS"] = "0"
    preset = env["CAPTION_PRESET"]
    cmd = [sys.executable, str(V3 / "speakercrop.py"), str(clip_src), str(out_mp4)]
    proc = subprocess.run(cmd, cwd=str(V3), env=env, capture_output=True, text=True)
    if proc.returncode != 0:
        tail = stderr_tail(proc.stderr or proc.stdout or "", lines=25)
        rid = render_id or "unknown"
        print(
            f"WARN speakercrop failed renderId={rid}; using ffmpeg_fit_export. stderr_tail={tail[:800]}",
            flush=True,
        )
        if render_meta is not None:
            render_meta["fit_fallback"] = True
            render_meta["speakercrop_tail"] = tail[:2000]
        ffmpeg_fit_export(clip_src, out_mp4, w, h)
    ass = Path(str(out_mp4).replace(".mp4", ".ass"))
    if ass.exists() and preset != "bold_pop":
        from clips_worker.caption_presets import apply_preset_to_ass

        apply_preset_to_ass(ass, preset)
    return out_mp4


def poster_jpg(video: Path, dest: Path) -> None:
    threads = str(ffmpeg_threads_per_job())
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-threads",
            threads,
            "-v",
            "error",
            "-i",
            str(video),
            "-frames:v",
            "1",
            "-q:v",
            "3",
            str(dest),
        ],
    )
