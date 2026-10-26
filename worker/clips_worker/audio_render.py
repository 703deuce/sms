"""FFmpeg audio mix: speech + ducked music + SFX."""
from __future__ import annotations

import subprocess
from pathlib import Path


def build_audio_filter(
    *,
    length_s: float,
    volume: float,
    duck_depth: float,
    fade_in_s: float,
    fade_out_s: float,
    has_music: bool,
    sfx_specs: list[dict],
    music_input_index: int = 1,
) -> tuple[str, str]:
    """
    Returns (filter_complex, audio_map_label).
    Input 0 must have an audio stream. Music at music_input_index when has_music.
    """
    L = max(0.1, float(length_s))
    V = max(0.0, min(1.0, float(volume)))
    D = max(0.0, min(1.0, float(duck_depth)))
    FI = max(0.0, float(fade_in_s))
    FO = max(0.0, float(fade_out_s))
    ratio = 1.0 + 7.0 * D

    parts: list[str] = ["[0:a]asplit=2[sp][sc]"]
    mix_inputs: list[str] = ["[sp]"]

    if has_music:
        parts.append(
            f"[{music_input_index}:a]volume={V:.4f},"
            f"afade=t=in:d={FI:.3f},afade=t=out:st={max(0, L - FO):.3f}:d={FO:.3f},"
            f"atrim=0:{L:.3f},asetpts=PTS-STARTPTS[mv]"
        )
        parts.append(
            f"[mv][sc]sidechaincompress=threshold=0.0316:ratio={ratio:.3f}:attack=20:release=300:makeup=1[md]"
        )
        mix_inputs.append("[md]")
    else:
        mix_inputs.append("[sc]")

    sfx_base = music_input_index + 1 if has_music else 1
    for i, spec in enumerate(sfx_specs):
        inp = sfx_base + i
        at_ms = int(spec.get("at_ms", 0))
        vol = float(spec.get("volume", 0.8))
        label = f"s{i}"
        parts.append(f"[{inp}:a]adelay={at_ms}|{at_ms},volume={vol:.4f}[{label}]")
        mix_inputs.append(f"[{label}]")

    n = len(mix_inputs)
    parts.append(f"{''.join(mix_inputs)}amix=inputs={n}:duration=first:normalize=0,alimiter=limit=0.95[aout]")
    return ";".join(parts), "[aout]"


def apply_audio_mix(
    video: Path,
    out_video: Path,
    music_path: Path | None,
    sfx_paths: list[tuple[Path, int, float]],
    *,
    length_s: float,
    volume: float,
    duck_depth: float,
    fade_in_s: float,
    fade_out_s: float,
) -> None:
    has_music = music_path is not None and music_path.is_file()
    sfx_specs = [{"at_ms": at, "volume": vol} for _, at, vol in sfx_paths]
    fc, alabel = build_audio_filter(
        length_s=length_s,
        volume=volume,
        duck_depth=duck_depth,
        fade_in_s=fade_in_s,
        fade_out_s=fade_out_s,
        has_music=has_music,
        sfx_specs=sfx_specs,
        music_input_index=1,
    )

    cmd = ["ffmpeg", "-y", "-v", "error", "-i", str(video)]
    if has_music:
        cmd.extend(["-i", str(music_path)])
    for path, _, _ in sfx_paths:
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
            "-shortest",
            str(out_video),
        ]
    )
    subprocess.check_call(cmd)


def apply_dub_speech_mix(
    video: Path,
    dub_audio: Path,
    out_video: Path,
    music_path: Path | None,
    sfx_paths: list[tuple[Path, int, float]],
    *,
    length_s: float,
    volume: float,
    duck_depth: float,
    fade_in_s: float,
    fade_out_s: float,
) -> None:
    """Replace speech with dub audio; duck music against dub track."""
    has_music = music_path is not None and music_path.is_file()
    sfx_specs = [{"at_ms": at, "volume": vol} for _, at, vol in sfx_paths]
    L = max(0.1, float(length_s))
    V = max(0.0, min(1.0, float(volume)))
    D = max(0.0, min(1.0, float(duck_depth)))
    FI = max(0.0, float(fade_in_s))
    FO = max(0.0, float(fade_out_s))
    ratio = 1.0 + 7.0 * D
    parts = ["[1:a]asplit=2[sp][sc]"]
    mix_inputs = ["[sp]"]
    if has_music:
        parts.append(
            f"[2:a]volume={V:.4f},afade=t=in:d={FI:.3f},afade=t=out:st={max(0, L - FO):.3f}:d={FO:.3f},"
            f"atrim=0:{L:.3f},asetpts=PTS-STARTPTS[mv]"
        )
        parts.append(
            f"[mv][sc]sidechaincompress=threshold=0.0316:ratio={ratio:.3f}:attack=20:release=300:makeup=1[md]"
        )
        mix_inputs.append("[md]")
    else:
        mix_inputs.append("[sc]")
    sfx_base = 3 if has_music else 2
    for i, spec in enumerate(sfx_specs):
        inp = sfx_base + i
        at_ms = int(spec.get("at_ms", 0))
        vol = float(spec.get("volume", 0.8))
        label = f"s{i}"
        parts.append(f"[{inp}:a]adelay={at_ms}|{at_ms},volume={vol:.4f}[{label}]")
        mix_inputs.append(f"[{label}]")
    n = len(mix_inputs)
    parts.append(f"{''.join(mix_inputs)}amix=inputs={n}:duration=first:normalize=0,alimiter=limit=0.95[aout]")
    fc = ";".join(parts)
    cmd = ["ffmpeg", "-y", "-v", "error", "-i", str(video), "-i", str(dub_audio)]
    if has_music:
        cmd.extend(["-i", str(music_path)])
    for path, _, _ in sfx_paths:
        cmd.extend(["-i", str(path)])
    cmd.extend(
        [
            "-filter_complex",
            fc,
            "-map",
            "0:v:0",
            "-map",
            "[aout]",
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-shortest",
            str(out_video),
        ]
    )
    subprocess.check_call(cmd)


def export_ducked_music_stem(
    video: Path,
    music: Path,
    stem_out: Path,
    *,
    length_s: float,
    volume: float,
    duck_depth: float,
    fade_in_s: float,
    fade_out_s: float,
) -> None:
    """Write the sidechain-compressed music bed ([md]) for tests."""
    L = max(0.1, float(length_s))
    V = max(0.0, min(1.0, float(volume)))
    D = max(0.0, min(1.0, float(duck_depth)))
    FI = max(0.0, float(fade_in_s))
    FO = max(0.0, float(fade_out_s))
    ratio = 1.0 + 7.0 * D
    fc = (
        f"[0:a]asplit=2[sp][sc];[sp]anullsink;"
        f"[1:a]volume={V:.4f},afade=t=in:d={FI:.3f},afade=t=out:st={max(0, L - FO):.3f}:d={FO:.3f},"
        f"atrim=0:{L:.3f},asetpts=PTS-STARTPTS[mv];"
        f"[mv][sc]sidechaincompress=threshold=0.0316:ratio={ratio:.3f}:attack=20:release=300:makeup=1[md]"
    )
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(video),
            "-i",
            str(music),
            "-filter_complex",
            fc,
            "-map",
            "[md]",
            str(stem_out),
        ],
    )


def measure_segment_rms_db(video: Path, start_s: float, end_s: float) -> float:
    """Return RMS level in dB for an audio segment (astats)."""
    dur = max(0.05, end_s - start_s)
    out = subprocess.check_output(
        [
            "ffmpeg",
            "-v",
            "error",
            "-ss",
            f"{start_s:.3f}",
            "-t",
            f"{dur:.3f}",
            "-i",
            str(video),
            "-af",
            "astats=metadata=1:reset=1",
            "-f",
            "null",
            "-",
        ],
        text=True,
        stderr=subprocess.STDOUT,
    )
    for line in out.splitlines():
        if "RMS level dB" in line:
            try:
                return float(line.split("RMS level dB:")[-1].strip())
            except ValueError:
                continue
    raise RuntimeError("astats RMS not found")
