"""FFmpeg audio mix: speech + ducked music + SFX."""
from __future__ import annotations

import subprocess
from pathlib import Path

from clips_worker.track_fx import pan_gains


def probe_audio_channels(path: Path) -> int:
    try:
        out = subprocess.check_output(
            [
                "ffprobe",
                "-v",
                "error",
                "-select_streams",
                "a:0",
                "-show_entries",
                "stream=channels",
                "-of",
                "default=nw=1:nk=1",
                str(path),
            ],
            text=True,
            timeout=30,
        )
        return max(1, int(out.strip()))
    except Exception:
        return 2


def pan_filter(pan, ch: int) -> str:
    if pan is None:
        return ""
    try:
        p = int(round(float(pan)))
    except (TypeError, ValueError):
        return ""
    if p == 0:
        return ""
    gL, gR = pan_gains(p)
    gl, gr = f"{gL:.4f}".rstrip("0").rstrip("."), f"{gR:.4f}".rstrip("0").rstrip(".")

    def _fmt(prefix: str) -> str:
        if ch <= 1:
            return f"{prefix}|c0={gl}*c0|c1={gr}*c0"
        if ch == 2:
            return f"{prefix}|c0={gl}*c0|c1={gr}*c1"
        return f"aformat=channel_layouts=stereo,{prefix}|c0={gl}*c0|c1={gr}*c1"

    return f",{_fmt('pan=stereo')}"


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
    track_fx: dict | None = None,
    sfx_fx: list | None = None,
    music_pan: int | None = None,
    music_pan_ch: int = 2,
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

    ducks = duck_indices(sfx_fx, len(sfx_specs))
    parts: list[str] = [voice_split("[0:a]", ducks)]
    mix_inputs: list[str] = ["[sp]"]

    if has_music:
        parts.append(music_chain(music_input_index, L, V, FI, FO, music_window, "mv", music_volume_expr, music_pan, music_pan_ch))
        music_fx(parts, track_fx)
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
        fx_i = sfx_fx[i] if sfx_fx and i < len(sfx_fx) else None
        pan_s = pan_filter(fx_i.get("pan") if fx_i else None, int(fx_i.get("pan_ch") or 2) if fx_i else 2)
        parts.append(
            f"[{inp}:a]{sfx_chan(track_fx, i)}{sfx_trim(sfx_trims, i)}{clip_fade(sfx_fx, i)}adelay={at_ms}|{at_ms},volume={vol:.4f}{sfx_env(sfx_volume_exprs, i)}{pan_s}[{label}]"
        )
        mix_inputs.append(clip_duck(parts, label, sfx_fx, i, ducks))
    mix_inputs = sfx_buses(parts, mix_inputs, len(sfx_specs), track_fx)

    n = len(mix_inputs)
    parts.append(f"{''.join(mix_inputs)}amix=inputs={n}:duration=first:normalize=0,alimiter=limit=0.95[aout]")
    return ";".join(parts), "[aout]"


def duck_indices(sfx_fx: list | None, n: int) -> list[int]:
    """G2: clips ducked under the voice (duck_depth > 0), in SFX order."""
    out = []
    for i in range(n):
        fx = sfx_fx[i] if sfx_fx and i < len(sfx_fx) else None
        if fx and fx.get("duck_depth") is not None and float(fx["duck_depth"]) > 0:
            out.append(i)
    return out


def voice_split(src: str, ducks: list[int]) -> str:
    """Voice → [sp] (mix) + [sc] (music sidechain) + one [dk<i>] sidechain per ducked clip (G2)."""
    extra = "".join(f"[dk{i}]" for i in ducks)
    return f"{src}asplit={2 + len(ducks)}[sp][sc]{extra}"


def clip_fade(sfx_fx: list | None, i: int) -> str:
    """G2: clip fades on its own play length, after the trim (local t = 0), before adelay.
    Linear `afade` (default curve tri); each fade at most half the play length (TS fadeGain)."""
    fx = sfx_fx[i] if sfx_fx and i < len(sfx_fx) else None
    if not fx:
        return ""
    fi = max(0, int(fx.get("fade_in_ms") or 0)) / 1000.0
    fo = max(0, int(fx.get("fade_out_ms") or 0)) / 1000.0
    play = fx.get("play_ms")
    ln = None if play is None else max(0.0, int(play) / 1000.0)
    if ln is not None:
        fi = min(fi, ln / 2)
        fo = min(fo, ln / 2)
    out = ""
    if fi > 0.0005:
        out += f"afade=t=in:st=0:d={fi:.3f},"
    if fo > 0.0005 and ln is not None:
        out += f"afade=t=out:st={max(0.0, ln - fo):.3f}:d={fo:.3f},"
    # Local time from 0 (an untrimmed file can start at a small non-zero pts).
    return f"asetpts=PTS-STARTPTS,{out}" if out else ""


def clip_duck(parts: list[str], label: str, sfx_fx: list | None, i: int, ducks: list[int]) -> str:
    """G2: duck one clip under the voice, same compressor as the music bed (ratio 1 + 7·depth)."""
    if i not in ducks:
        return f"[{label}]"
    d = max(0.0, min(1.0, float(sfx_fx[i]["duck_depth"])))
    ratio = 1.0 + 7.0 * d
    parts.append(
        f"[{label}][dk{i}]sidechaincompress=threshold=0.0316:ratio={ratio:.3f}:attack=20:release=300:makeup=1[{label}d]"
    )
    return f"[{label}d]"


def sfx_chan(track_fx: dict | None, i: int) -> str:
    """G1c split stereo: one channel of the media as mono (mono media: its only channel)."""
    ch = ((track_fx or {}).get("channels") or [])
    c = ch[i] if i < len(ch) else None
    if c not in ("L", "R"):
        return ""
    return f"aformat=channel_layouts=stereo,pan=mono|c0={'c0' if c == 'L' else 'c1'},"


def music_fx(parts: list[str], track_fx: dict | None) -> None:
    """G1c: the music track chain on [mv] (before ducking), in place."""
    chain = (track_fx or {}).get("music")
    if chain and parts and parts[-1].endswith("[mv]"):
        parts[-1] = parts[-1][: -len("[mv]")] + "[mv0]"
        parts.append(f"[mv0]{chain}[mv]")


def sfx_buses(parts: list[str], mix_inputs: list[str], n_sfx: int, track_fx: dict | None) -> list[str]:
    """G1c: SFX on a track with a chain are summed into one bus, the chain runs on the bus."""
    buses = (track_fx or {}).get("buses") or []
    chains = (track_fx or {}).get("bus_fx") or {}
    if not chains or not n_sfx:
        return mix_inputs
    head = mix_inputs[: len(mix_inputs) - n_sfx]
    sfx_labels = mix_inputs[len(mix_inputs) - n_sfx:]
    groups: dict[str, list[str]] = {}
    out = list(head)
    for i, lab in enumerate(sfx_labels):
        key = buses[i] if i < len(buses) else None
        if key and chains.get(key):
            groups.setdefault(key, []).append(lab)
        else:
            out.append(lab)
    for j, (key, labs) in enumerate(sorted(groups.items())):
        sum_ = f"amix=inputs={len(labs)}:duration=longest:normalize=0," if len(labs) > 1 else ""
        parts.append(f"{''.join(labs)}{sum_}{chains[key]}[bus{j}]")
        out.append(f"[bus{j}]")
    return out


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
    pan: int | None = None,
    pan_ch: int = 2,
) -> str:
    """Music bed filter: legacy (0..L) or E2 windowed (atrim in-point, fades on the window, adelay).
    envelope (E3): `volume` expression in OUTPUT seconds (motion.volume_expr with the window origin)."""
    w = _windowed(window, L)
    env = f",volume='{envelope}':eval=frame" if envelope else ""
    pf = pan_filter(pan, pan_ch)
    if w is None:
        return (
            f"[{idx}:a]volume={V:.4f},"
            f"afade=t=in:d={FI:.3f},afade=t=out:st={max(0, L - FO):.3f}:d={FO:.3f},"
            f"atrim=0:{L:.3f},asetpts=PTS-STARTPTS{env}{pf}[{label}]"
        )
    start, ln, in_s = w
    fi = min(FI, ln / 2)
    fo = min(FO, ln / 2)
    delay_ms = int(round(start * 1000))
    return (
        f"[{idx}:a]atrim=start={in_s:.3f}:end={in_s + ln:.3f},asetpts=PTS-STARTPTS,volume={V:.4f},"
        f"afade=t=in:d={fi:.3f},afade=t=out:st={max(0, ln - fo):.3f}:d={fo:.3f},"
        f"adelay={delay_ms}|{delay_ms},apad=whole_dur={L:.3f}{env}{pf}[{label}]"
    )


def sfx_input_args(path: Path, sfx_fx: list | None, i: int) -> list[str]:
    """G2fix: a looping music clip repeats its media (`-stream_loop -1`); its atrim duration=durMs
    (sfx_trim — loop is only set with a durMs) bounds the infinite input."""
    fx = sfx_fx[i] if sfx_fx and i < len(sfx_fx) else None
    return (["-stream_loop", "-1"] if fx and fx.get("loop") else []) + ["-i", str(path)]


def music_input_args(music_path: Path, loop: bool) -> list[str]:
    """G2 Fit to length: a looping bed repeats its media (`-stream_loop -1`); music_chain's atrim /
    the whole-clip atrim bounds the length, so the infinite input always ends."""
    return (["-stream_loop", "-1"] if loop else []) + ["-i", str(music_path)]


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
    track_fx: dict | None = None,
    sfx_fx: list | None = None,
    music_loop: bool = False,
    music_pan: int | None = None,
    music_pan_ch: int = 2,
) -> None:
    has_music = music_path is not None and music_path.is_file()
    sfx_specs = [{"at_ms": at, "volume": vol} for _, at, vol in sfx_paths]
    fc, alabel = build_audio_filter(
        sfx_fx=sfx_fx,
        track_fx=track_fx,
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
        music_pan=music_pan,
        music_pan_ch=music_pan_ch,
    )

    cmd = ["ffmpeg", "-y", "-v", "error", "-i", str(video)]
    if has_music:
        cmd.extend(music_input_args(music_path, music_loop))
    for i, (path, _, _) in enumerate(sfx_paths):
        cmd.extend(sfx_input_args(path, sfx_fx, i))

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
    track_fx: dict | None = None,
    sfx_fx: list | None = None,
    music_loop: bool = False,
    music_pan: int | None = None,
    music_pan_ch: int = 2,
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
    ducks = duck_indices(sfx_fx, len(sfx_specs))
    parts = [voice_split(f"[1:a]{voice_env}", ducks)]
    mix_inputs = ["[sp]"]
    if has_music:
        parts.append(music_chain(2, L, V, FI, FO, music_window, "mv", music_volume_expr, music_pan, music_pan_ch))
        music_fx(parts, track_fx)
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
        fx_i = sfx_fx[i] if sfx_fx and i < len(sfx_fx) else None
        pan_s = pan_filter(fx_i.get("pan") if fx_i else None, int(fx_i.get("pan_ch") or 2) if fx_i else 2)
        parts.append(
            f"[{inp}:a]{sfx_chan(track_fx, i)}{sfx_trim(sfx_trims, i)}{clip_fade(sfx_fx, i)}adelay={at_ms}|{at_ms},volume={vol:.4f}{sfx_env(sfx_volume_exprs, i)}{pan_s}[{label}]"
        )
        mix_inputs.append(clip_duck(parts, label, sfx_fx, i, ducks))
    mix_inputs = sfx_buses(parts, mix_inputs, len(sfx_specs), track_fx)
    n = len(mix_inputs)
    parts.append(f"{''.join(mix_inputs)}amix=inputs={n}:duration=first:normalize=0,alimiter=limit=0.95[aout]")
    fc = ";".join(parts)
    cmd = ["ffmpeg", "-y", "-v", "error", "-i", str(video), "-i", str(dub_audio)]
    if has_music:
        cmd.extend(music_input_args(music_path, music_loop))
    for i, (path, _, _) in enumerate(sfx_paths):
        cmd.extend(sfx_input_args(path, sfx_fx, i))
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
    music_window: dict | None = None,
    music_volume_expr: str | None = None,
    music_loop: bool = False,
    music_pan: int | None = None,
    music_pan_ch: int = 2,
    track_fx: dict | None = None,
) -> None:
    """Write the sidechain-compressed music bed ([md]) for tests and EX-16 export."""
    L = max(0.1, float(length_s))
    V = max(0.0, min(1.0, float(volume)))
    D = max(0.0, min(1.0, float(duck_depth)))
    FI = max(0.0, float(fade_in_s))
    FO = max(0.0, float(fade_out_s))
    ratio = 1.0 + 7.0 * D
    parts = ["[0:a]asplit=2[sp][sc]", "[sp]anullsink"]
    parts.append(
        music_chain(1, L, V, FI, FO, music_window, "mv", music_volume_expr, music_pan, music_pan_ch)
    )
    music_fx(parts, track_fx)
    parts.append(
        f"[mv][sc]sidechaincompress=threshold=0.0316:ratio={ratio:.3f}:attack=20:release=300:makeup=1[md]"
    )
    fc = ";".join(parts)
    cmd = ["ffmpeg", "-y", "-v", "error", "-i", str(video)]
    cmd.extend(music_input_args(music, music_loop))
    cmd.extend(["-filter_complex", fc, "-map", "[md]", str(stem_out)])
    subprocess.check_call(cmd)


def export_voice_stem(
    video: Path,
    stem_out: Path,
    *,
    length_s: float,
    speech_volume_expr: str | None = None,
    dub_audio: Path | None = None,
) -> None:
    """Program voice lane ([sp]) aligned to export length."""
    L = max(0.1, float(length_s))
    if dub_audio and dub_audio.is_file():
        env = f"volume='{speech_volume_expr}':eval=frame," if speech_volume_expr else ""
        fc = f"[1:a]{env}atrim=0:{L:.3f},asetpts=PTS-STARTPTS[voice]"
        subprocess.check_call(
            [
                "ffmpeg",
                "-y",
                "-v",
                "error",
                "-i",
                str(video),
                "-i",
                str(dub_audio),
                "-filter_complex",
                fc,
                "-map",
                "[voice]",
                str(stem_out),
            ],
        )
        return
    env = f"volume='{speech_volume_expr}':eval=frame," if speech_volume_expr else ""
    fc = f"[0:a]{env}atrim=0:{L:.3f},asetpts=PTS-STARTPTS[voice]"
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(video),
            "-filter_complex",
            fc,
            "-map",
            "[voice]",
            str(stem_out),
        ],
    )


def export_sfx_bed_stem(
    video: Path,
    stem_out: Path,
    sfx_paths: list[tuple[Path, int, float]],
    *,
    length_s: float,
    sfx_volume_exprs: list[str | None] | None = None,
    sfx_trims: list | None = None,
    track_fx: dict | None = None,
    sfx_fx: list | None = None,
) -> None:
    """Sum SFX clips into one bed (no voice / music)."""
    if not sfx_paths:
        return
    L = max(0.1, float(length_s))
    sfx_specs = [{"at_ms": at, "volume": vol} for _, at, vol in sfx_paths]
    ducks = duck_indices(sfx_fx, len(sfx_specs))
    parts: list[str] = [voice_split("[0:a]", ducks), "[sp]anullsink"]
    mix_inputs: list[str] = []
    sfx_base = 1
    for i, spec in enumerate(sfx_specs):
        inp = sfx_base + i
        at_ms = int(spec.get("at_ms", 0))
        vol = float(spec.get("volume", 0.8))
        label = f"s{i}"
        fx_i = sfx_fx[i] if sfx_fx and i < len(sfx_fx) else None
        pan_s = pan_filter(fx_i.get("pan") if fx_i else None, int(fx_i.get("pan_ch") or 2) if fx_i else 2)
        parts.append(
            f"[{inp}:a]{sfx_chan(track_fx, i)}{sfx_trim(sfx_trims, i)}{clip_fade(sfx_fx, i)}adelay={at_ms}|{at_ms},volume={vol:.4f}{sfx_env(sfx_volume_exprs, i)}{pan_s}[{label}]"
        )
        mix_inputs.append(clip_duck(parts, label, sfx_fx, i, ducks))
    mix_inputs = sfx_buses(parts, mix_inputs, len(sfx_specs), track_fx)
    if not mix_inputs:
        return
    n = len(mix_inputs)
    parts.append(f"{''.join(mix_inputs)}amix=inputs={n}:duration=first:normalize=0,alimiter=limit=0.95[aout]")
    fc = ";".join(parts)
    cmd = ["ffmpeg", "-y", "-v", "error", "-i", str(video)]
    for i, (path, _, _) in enumerate(sfx_paths):
        cmd.extend(sfx_input_args(path, sfx_fx, i))
    cmd.extend(["-filter_complex", fc, "-map", "[aout]", str(stem_out)])
    subprocess.check_call(cmd)


def export_mix_stems(
    video: Path,
    out_dir: Path,
    music_path: Path | None,
    sfx_paths: list[tuple[Path, int, float]],
    *,
    dub_audio: Path | None = None,
    length_s: float,
    volume: float,
    duck_depth: float,
    fade_in_s: float,
    fade_out_s: float,
    music_window: dict | None = None,
    music_loop: bool = False,
    music_pan: int | None = None,
    music_pan_ch: int = 2,
    speech_volume_expr: str | None = None,
    music_volume_expr: str | None = None,
    sfx_volume_exprs: list[str | None] | None = None,
    sfx_trims: list | None = None,
    track_fx: dict | None = None,
    sfx_fx: list | None = None,
) -> list[str]:
    """Write voice.wav, optional music.wav and sfx.wav under out_dir."""
    out_dir.mkdir(parents=True, exist_ok=True)
    written: list[str] = []
    voice_out = out_dir / "voice.wav"
    export_voice_stem(
        video,
        voice_out,
        length_s=length_s,
        speech_volume_expr=speech_volume_expr,
        dub_audio=dub_audio,
    )
    written.append(voice_out.name)
    if music_path and music_path.is_file():
        music_out = out_dir / "music.wav"
        export_ducked_music_stem(
            video,
            music_path,
            music_out,
            length_s=length_s,
            volume=volume,
            duck_depth=duck_depth,
            fade_in_s=fade_in_s,
            fade_out_s=fade_out_s,
            music_window=music_window,
            music_volume_expr=music_volume_expr,
            music_loop=music_loop,
            music_pan=music_pan,
            music_pan_ch=music_pan_ch,
            track_fx=track_fx,
        )
        written.append(music_out.name)
    if sfx_paths:
        sfx_out = out_dir / "sfx.wav"
        export_sfx_bed_stem(
            video,
            sfx_out,
            sfx_paths,
            length_s=length_s,
            sfx_volume_exprs=sfx_volume_exprs,
            sfx_trims=sfx_trims,
            track_fx=track_fx,
            sfx_fx=sfx_fx,
        )
        if sfx_out.is_file() and sfx_out.stat().st_size > 0:
            written.append(sfx_out.name)
    return written


def measure_segment_rms_db(video: Path, start_s: float, end_s: float) -> float:
    """Return RMS level in dB for an audio segment (astats)."""
    dur = max(0.05, end_s - start_s)
    out = subprocess.check_output(
        [
            "ffmpeg",
            "-hide_banner",
            "-nostats",
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
