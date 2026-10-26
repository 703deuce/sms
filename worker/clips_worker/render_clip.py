"""Cut, speakercrop, captions, poster for one clip."""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

V3 = Path(os.environ.get("SPEAKERCROP_DIR", "/app/v3"))


def aspect_size(aspect: str) -> tuple[int, int]:
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


def ffmpeg_cut(src: Path, dest: Path, start_ms: int, end_ms: int) -> None:
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
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


def layout_env(layout: str) -> dict[str, str]:
    layout = (layout or "speaker_follow").strip()
    env = {
        "LEAD": "0.4",
        "MIN_SEG": "0.8",
        "VOICE": "1",
        "CAPTIONS": "1",
    }
    if layout == "split":
        env["SPLIT"] = "1"
        env["FORCE_SPLIT"] = "1"
    elif layout == "fill":
        env["SPLIT"] = "0"
        env["LAYOUT_MODE"] = "fill"
    elif layout == "fit":
        env["SPLIT"] = "0"
        env["LAYOUT_MODE"] = "fit"
    else:
        env["SPLIT"] = "1"
        env["LAYOUT_MODE"] = "speaker_follow"
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
) -> Path:
    aspect = settings.get("aspectRatio", "9:16")
    w, h = aspect_size(aspect)
    env = os.environ.copy()
    env.update(layout_env(settings.get("layout", "speaker_follow")))
    env["WORDS"] = str(words_path)
    env["OUT_W"] = str(w)
    env["OUT_H"] = str(h)
    env["CAPTION_PRESET"] = settings.get("captions", {}).get("presetId", "bold_pop")
    if not settings.get("captions", {}).get("enabled", True):
        env["CAPTIONS"] = "0"
    env["CLIP_START_MS"] = str(int(clip_start_ms))
    if crop_track_out is not None:
        env["CROP_TRACK_OUT"] = str(crop_track_out)
    elif int(os.environ.get("WRITE_CROP_TRACK", "1")):
        env["CROP_TRACK_OUT"] = str(out_mp4.with_suffix(".crop_track.json"))
    if shot_overrides:
        env["SHOT_OVERRIDES"] = json.dumps(shot_overrides)
    if no_render:
        env["NORENDER"] = "1"
        env["CAPTIONS"] = "0"
    preset = env["CAPTION_PRESET"]
    subprocess.check_call(
        [sys.executable, str(V3 / "speakercrop.py"), str(clip_src), str(out_mp4)],
        cwd=str(V3),
        env=env,
    )
    ass = Path(str(out_mp4).replace(".mp4", ".ass"))
    if ass.exists() and preset != "bold_pop":
        from clips_worker.caption_presets import apply_preset_to_ass

        apply_preset_to_ass(ass, preset)
    return out_mp4


def poster_jpg(video: Path, dest: Path) -> None:
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
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
