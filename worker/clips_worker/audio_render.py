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
    music_window: dict | None = None,
    music_volume_expr: str | None = None,
    sfx_volume_exprs: list[str | None] | None = None,
    sfx_trims: list | None = None,
) -> tuple[str, str]:
    """
    Returns (filter_complex, audio_map_label).
    Input 0 must have an audio stream. Music at music_input_index when has_music.
    music_window (E2): {startMs, endMs, inMs} in output ms; None/full = legacy whole-clip bed.
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
        parts.append(music_chain(music_input_index, L, V, FI, FO, music_window, "mv", music_volume_expr))
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
        parts.append(f"[{inp}:a]{sfx_trim(sfx_trims, i)}adelay={at_ms}|{at_ms},volume={vol:.4f}{sfx_env(sfx_volume_exprs, i)}[{label}]")
        mix_inputs.append(f"[{label}]")

    n = len(mix_inputs)
    parts.append(f"{''.join(mix_inputs)}amix=inputs={n}:duration=first:normalize=0,alimiter=limit=0.95[aout]")
    return ";".join(parts), "[aout]"


def sfx_trim(trims, i: int) -> str:
    """G1b3: `atrim` for an SFX with an in-point / length (detached clip audio), before adelay."""
    t = trims[i] if trims and i < len(trims) else None
    if not t or (not t[0] and t[1] is None):
        return ""
    in_ms, dur = t
    d = f":duration={dur / 1000.0:.3f}" if dur else ""
    return f"atrim=start={in_ms / 1000.0:.3f}{d},asetpts=PTS-STARTPTS,"


def sfx_env(exprs: list[str | None] | None, i: int) -> str:
    """G1b3: SFX volume envelope after adelay, so `t` is OUTPUT seconds (motion.volume_expr with
    origin = the SFX start). volume eval=frame exists in ffmpeg 5.1."""
    e = exprs[i] if exprs and i < len(exprs) else None
    return f",volume='{e}':eval=frame" if e else ""


def _windowed(window: dict | None, L: float) -> tuple[float, float, float] | None:
    """(start_s, len_s, in_s) when the window differs from the legacy whole-clip bed."""
    if not window:
        return None
    start = max(0.0, int(window.get("startMs") or 0) / 1000.0)
    end_raw = window.get("endMs")
    end = L if end_raw is None else min(L, int(end_raw) / 1000.0)
    in_s = max(0.0, int(window.get("inMs") or 0) / 1000.0)
    if start <= 0.0005 and in_s <= 0.0005 and end >= L - 0.0005:
        return None
    return start, max(0.1, end - start), in_s


def music_chain(
    idx: int, L: float, V: float, FI: float, FO: float, window: dict | None, label: str,
    envelope: str | None = None,
) -> str:
    """Music bed filter: legacy (0..L) or E2 windowed (atrim in-point, fades on the window, adelay).
    envelope (E3): `volume` expression in OUTPUT seconds (motion.volume_expr with the window origin)."""
    w = _windowed(window, L)
    env = f",volume='{envelope}':eval=frame" if envelope else ""
    if w is None:
        return (
            f"[{idx}:a]volume={V:.4f},"
            f"afade=t=in:d={FI:.3f},afade=t=out:st={max(0, L - FO):.3f}:d={FO:.3f},"
            f"atrim=0:{L:.3f},asetpts=PTS-STARTPTS{env}[{label}]"
        )
    start, ln, in_s = w
    fi = min(FI, ln / 2)
    fo = min(FO, ln / 2)
    delay_ms = int(round(start * 1000))
    return (
        f"[{idx}:a]atrim=start={in_s:.3f}:end={in_s + ln:.3f},asetpts=PTS-STARTPTS,volume={V:.4f},"
        f"afade=t=in:d={fi:.3f},afade=t=out:st={max(0, ln - fo):.3f}:d={fo:.3f},"
        f"adelay={delay_ms}|{delay_ms},apad=whole_dur={L:.3f}{env}[{label}]"
    )


def apply_voice_mute(video: Path, out_video: Path) -> None:
    """E2 Voice lane muted: silence the speech track (video copied)."""
    subprocess.check_call(
        [
            "ffmpeg", "-y", "-v", "error", "-i", str(video),
            "-map", "0:v:0", "-map", "0:a:0?", "-c:v", "copy",
            "-af", "volume=0", "-c:a", "aac", "-b:a", "128k", str(out_video),
        ]
    )


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
    music_window: dict | None = None,
    music_volume_expr: str | None = None,
    sfx_volume_exprs: list[str | None] | None = None,
    sfx_trims: list | None = None,
) -> None:
    has_music = music_path is not None and music_path.is_file()
    sfx_specs = [{"at_ms": at, "volume": vol} for _, at, vol in sfx_paths]
    fc, alabel = build_audio_filter(
        music_volume_expr=music_volume_expr,
        sfx_volume_exprs=sfx_volume_exprs,
        sfx_trims=sfx_trims,
        length_s=length_s,
        volume=volume,
        duck_depth=duck_depth,
        fade_in_s=fade_in_s,
        fade_out_s=fade_out_s,
        has_music=has_music,
        sfx_specs=sfx_specs,
        music_input_index=1,
        music_window=music_window,
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


def apply_loudnorm(video: Path, out_video: Path, target_lufs: int) -> None:
    """EBU R128 loudness normalize program audio (video stream copied)."""
    i = int(target_lufs)
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(video),
            "-af",
            f"loudnorm=I={i}:TP=-1.5:LRA=11",
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            str(out_video),
        ],
    )


def apply_studio_sound_mix(video: Path, isolated: Path, out_video: Path, mix: float) -> None:
    """Blend isolated speech with original program audio."""
    m = max(0.0, min(1.0, float(mix)))
    orig = max(0.0, 1.0 - m)
    fc = (
        f"[1:a]volume={m:.4f}[iso];[0:a]volume={orig:.4f}[raw];"
        f"[iso][raw]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[aout]"
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
            str(isolated),
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
        ],
    )


def align_isolated_to_segments(
    isolated: Path,
    dest: Path,
    segs_sec: list[tuple[float, float]],
    *,
    track_start_sec: float = 0.0,
) -> bool:
    """Cut/concat isolated audio to match export segment list (clip-relative seconds)."""
    if not isolated.is_file() or not segs_sec:
        return False
    segs_sec = [(a, b) for a, b in segs_sec if b - a >= 0.05]
    if not segs_sec:
        return False

    if len(segs_sec) == 1:
        a, b = segs_sec[0]
        ss = max(0.0, track_start_sec + a)
        dur = b - a
        subprocess.check_call(
            [
                "ffmpeg",
                "-y",
                "-v",
                "error",
                "-ss",
                f"{ss:.3f}",
                "-t",
                f"{dur:.3f}",
                "-i",
                str(isolated),
                "-acodec",
                "libmp3lame",
                "-q:a",
                "2",
                str(dest),
            ],
        )
        return True

    parts: list[str] = []
    labels: list[str] = []
    for i, (a, b) in enumerate(segs_sec):
        ss = max(0.0, track_start_sec + a)
        dur = max(0.05, b - a)
        parts.append(
            f"[0:a]atrim=start={ss:.3f}:end={ss + dur:.3f},asetpts=PTS-STARTPTS[a{i}]"
        )
        labels.append(f"[a{i}]")
    parts.append(f"{''.join(labels)}concat=n={len(labels)}:v=0:a=1[aout]")
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(isolated),
            "-filter_complex",
            ";".join(parts),
            "-map",
            "[aout]",
            "-acodec",
            "libmp3lame",
            "-q:a",
            "2",
            str(dest),
        ],
    )
    return True


def apply_studio_sound_mix_aligned(
    video: Path,
    isolated: Path,
    out_video: Path,
    mix: float,
    segs_sec: list[tuple[float, float]],
    *,
    track_start_sec: float = 0.0,
    work_dir: Path | None = None,
) -> None:
    """Align isolated track to edited segments when possible, then blend with program audio."""
    aligned = isolated
    tmp: Path | None = None
    if segs_sec and work_dir is not None:
        tmp = work_dir / "_studio_aligned.mp3"
        try:
            if align_isolated_to_segments(isolated, tmp, segs_sec, track_start_sec=track_start_sec):
                aligned = tmp
                print(
                    f"[clipper:studio_sound] aligned segments={len(segs_sec)} track_start_s={round(track_start_sec, 3)}",
                    flush=True,
                )
            else:
                print("[clipper:studio_sound] align_fallback reason=align_failed", flush=True)
        except Exception as exc:
            print(
                f"[clipper:studio_sound] align_fallback reason={type(exc).__name__}:{str(exc)[:80]}",
                flush=True,
            )
    apply_studio_sound_mix(video, aligned, out_video, mix)


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
    music_window: dict | None = None,
    music_volume_expr: str | None = None,
    speech_volume_expr: str | None = None,
    sfx_volume_exprs: list[str | None] | None = None,
    sfx_trims: list | None = None,
) -> None:
    """Replace speech with dub audio; duck music against dub track.
    E3: speech_volume_expr = Voice-lane volume envelope (the dub is the voice)."""
    has_music = music_path is not None and music_path.is_file()
    sfx_specs = [{"at_ms": at, "volume": vol} for _, at, vol in sfx_paths]
    L = max(0.1, float(length_s))
    V = max(0.0, min(1.0, float(volume)))
    D = max(0.0, min(1.0, float(duck_depth)))
    FI = max(0.0, float(fade_in_s))
    FO = max(0.0, float(fade_out_s))
    ratio = 1.0 + 7.0 * D
    voice_env = f"volume='{speech_volume_expr}':eval=frame," if speech_volume_expr else ""
    parts = [f"[1:a]{voice_env}asplit=2[sp][sc]"]
    mix_inputs = ["[sp]"]
    if has_music:
        parts.append(music_chain(2, L, V, FI, FO, music_window, "mv", music_volume_expr))
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
        parts.append(f"[{inp}:a]{sfx_trim(sfx_trims, i)}adelay={at_ms}|{at_ms},volume={vol:.4f}{sfx_env(sfx_volume_exprs, i)}[{label}]")
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
