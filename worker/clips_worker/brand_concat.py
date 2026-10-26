"""Concat intro + main + outro with normalized A/V."""
from __future__ import annotations

import subprocess
from pathlib import Path


def _normalize_piece(src: Path, dest: Path, w: int, h: int) -> None:
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(src),
            "-vf",
            f"scale={w}:{h}:force_original_aspect_ratio=decrease,"
            f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p",
            "-af",
            "aresample=48000,aformat=channel_layouts=stereo",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "23",
            "-c:a",
            "aac",
            "-shortest",
            str(dest),
        ],
    )


def _silent_video_from_audio_ref(ref: Path, dest: Path, w: int, h: int, dur_s: float) -> None:
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            f"color=c=black:s={w}x{h}:d={dur_s:.3f}",
            "-f",
            "lavfi",
            "-i",
            "anullsrc=channel_layout=stereo:sample_rate=48000",
            "-shortest",
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


def concat_brand_bookends(
    main: Path,
    out: Path,
    intro: Path | None,
    outro: Path | None,
    w: int,
    h: int,
    work_dir: Path,
) -> None:
    from clips_worker.probe import probe_duration

    pieces: list[Path] = []
    idx = 0
    for label, src in (("intro", intro), ("main", main), ("outro", outro)):
        if src is None:
            continue
        norm = work_dir / f"{label}_{idx}.mp4"
        _normalize_piece(src, norm, w, h)
        pieces.append(norm)
        idx += 1
    if len(pieces) == 1:
        subprocess.check_call(["cp", str(pieces[0]), str(out)])
        return
    inputs = []
    filters = []
    for i, p in enumerate(pieces):
        inputs.extend(["-i", str(p)])
        filters.append(f"[{i}:v][{i}:a]")
    n = len(pieces)
    fc = "".join(filters) + f"concat=n={n}:v=1:a=1[v][a]"
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            *inputs,
            "-filter_complex",
            fc,
            "-map",
            "[v]",
            "-map",
            "[a]",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "23",
            "-c:a",
            "aac",
            str(out),
        ],
    )
