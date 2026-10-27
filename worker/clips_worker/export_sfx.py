"""Royalty-free export SFX (Kenney CC0) mixed under speech on final render."""
from __future__ import annotations

import os
import subprocess
from pathlib import Path

WHOOSH_VOL_SUBTLE = 0.11
WHOOSH_VOL_MEME = 0.14
POP_VOL_MEME = 0.16
LAUGH_VOL_MEME = 0.12


def sfx_assets_dir() -> Path:
    root = Path(os.environ.get("CLIPS_WORKER_ROOT", "/app"))
    return root / "assets" / "sfx"


def bundled_sfx_available() -> bool:
    d = sfx_assets_dir()
    return (d / "whoosh.wav").is_file() and (d / "pop.wav").is_file()


def _peak_times_from_keyframes(kf: list[tuple[float, float]]) -> list[float]:
    peaks: list[float] = []
    for i in range(1, len(kf)):
        t0, z0 = kf[i - 1]
        t1, z1 = kf[i]
        if z1 > 1.02 and z0 <= 1.01:
            peaks.append(max(0.0, t0))
    return peaks


def _emphasis_word_times(words: list[dict], emphasis: list[int]) -> list[float]:
    times: list[float] = []
    for idx in emphasis or []:
        for w in words:
            wi = int(w.get("i", w.get("idx", -1)))
            if wi == idx:
                s = w.get("s")
                if s is None and "s_ms" in w:
                    s = float(w["s_ms"]) / 1000.0
                if s is not None:
                    times.append(float(s))
                break
    return times


def build_export_sfx_events(
    mode: str,
    *,
    duration_s: float,
    zoom_keyframes: list[tuple[float, float]] | None,
    caption_words: list[dict],
    emphasis: list[int],
) -> list[tuple[Path, int, float]]:
    """Returns (path, at_ms, volume) on output timeline."""
    if mode not in ("subtle", "meme") or not bundled_sfx_available():
        return []
    d = sfx_assets_dir()
    events: list[tuple[Path, int, float]] = []
    kf = zoom_keyframes or [(0.0, 1.0), (max(0.01, duration_s), 1.0)]
    peaks = _peak_times_from_keyframes(kf)
    whoosh_vol = WHOOSH_VOL_SUBTLE if mode == "subtle" else WHOOSH_VOL_MEME
    for t in peaks:
        if 0 <= t < duration_s:
            events.append((d / "whoosh.wav", int(t * 1000), whoosh_vol))
    if mode == "meme":
        for t in _emphasis_word_times(caption_words, emphasis):
            if 0 <= t < duration_s:
                events.append((d / "pop.wav", int(t * 1000), POP_VOL_MEME))
        if emphasis and duration_s > 4:
            last_t = _emphasis_word_times(caption_words, emphasis[-1:])[:1]
            if last_t and last_t[0] > duration_s * 0.7:
                events.append((d / "laugh-sting.wav", int(last_t[0] * 1000), LAUGH_VOL_MEME))
    return events


def _video_duration_s(video: Path) -> float:
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
    try:
        return max(0.5, float(out))
    except ValueError:
        return 60.0


def apply_export_sfx_mix(
    video: Path,
    out_video: Path,
    events: list[tuple[Path, int, float]],
) -> None:
    if not events:
        subprocess.check_call(["ffmpeg", "-y", "-v", "error", "-i", str(video), "-c", "copy", str(out_video)])
        return
    length_s = _video_duration_s(video)
    specs = [{"at_ms": at, "volume": vol} for _, at, vol in events]
    from clips_worker.audio_render import build_audio_filter

    fc, alabel = build_audio_filter(
        length_s=length_s,
        volume=0.25,
        duck_depth=0.7,
        fade_in_s=0,
        fade_out_s=0,
        has_music=False,
        sfx_specs=specs,
        music_input_index=1,
    )
    cmd = ["ffmpeg", "-y", "-v", "error", "-i", str(video)]
    for path, _, _ in events:
        cmd.extend(["-i", str(path)])
    cmd.extend(
        [
            "-filter_complex",
            fc,
            "-map",
            "0:v:0",
            "-map",
            alabel,
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-movflags",
            "+faststart",
            str(out_video),
        ]
    )
    subprocess.check_call(cmd)
