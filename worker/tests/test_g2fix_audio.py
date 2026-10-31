"""G2fix: a song on a "Music N" track (an audio clip with kind='music') exports like the music
bed — fades, ducking and Loop / Fit to length (`-stream_loop -1` + atrim duration=durMs).

Real ffmpeg renders on tiny synthetic files (worker image: 5.1.x), ~1 s total.
"""
from __future__ import annotations

import subprocess
from pathlib import Path

from clips_worker.audio_assets import _sfx_fx, _sfx_trim, _with_play_len
from clips_worker.audio_render import apply_audio_mix, sfx_input_args


def _ff(*args: str) -> None:
    subprocess.check_call(["ffmpeg", "-y", "-v", "error", *args])


def _voice_video(path: Path, secs: float, voice_until: float) -> None:
    """Black video; 300 Hz 'voice' from 0 to voice_until, then silence."""
    _ff(
        "-f", "lavfi", "-i", f"color=c=black:s=160x120:d={secs}",
        "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
        "-f", "lavfi", "-i", f"sine=frequency=300:duration={voice_until}",
        "-filter_complex", "[2:a]volume=3[s];[1:a][s]amix=inputs=2:duration=first:normalize=0[a]",
        "-map", "0:v:0", "-map", "[a]", "-t", str(secs),
        "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", "-b:a", "128k", str(path),
    )


def _tone(path: Path, secs: float, freq: int = 2000) -> None:
    _ff("-f", "lavfi", "-i", f"sine=frequency={freq}:duration={secs}", "-c:a", "libmp3lame", "-q:a", "4", str(path))


def _hi_rms_db(path: Path, start: float, end: float) -> float:
    out = subprocess.run(
        ["ffmpeg", "-v", "info", "-ss", f"{start:.3f}", "-t", f"{end - start:.3f}", "-i", str(path),
         "-af", "highpass=f=1500,highpass=f=1500,astats=metadata=0:reset=0", "-f", "null", "-"],
        capture_output=True, text=True, check=True,
    ).stderr
    vals = [line.split("RMS level dB:")[-1].strip() for line in out.splitlines() if "RMS level dB:" in line]
    v = vals[-1] if vals else "-inf"
    return -120.0 if v in ("-inf", "inf", "nan") else float(v)


def test_clip_loop_needs_a_length_and_plays_its_whole_dur():
    assert _sfx_fx({"loop": True}) is None  # no durMs → no loop (an infinite input must be bounded)
    fx = _sfx_fx({"loop": True, "durMs": 30_000})
    assert fx == {"fade_in_ms": 0, "fade_out_ms": 0, "duck_depth": None, "loop": True}
    full = _sfx_fx({"loop": True, "durMs": 30_000, "fadeOutMs": 2000, "duckDepth": 0.7, "kind": "music"})
    # A looping clip's fades sit on durMs, not on the (shorter) media — no ffprobe needed.
    timed = _with_play_len(full, Path("/nonexistent.mp3"), _sfx_trim({"durMs": 30_000}))
    assert timed["play_ms"] == 30_000 and timed["loop"] is True and timed["duck_depth"] == 0.7
    # Old saves / plain SFX: unchanged.
    assert _sfx_fx({"atMs": 0, "volume": 0.8}) is None


def test_sfx_input_args_loop_only_when_set():
    p = Path("/s.mp3")
    assert sfx_input_args(p, None, 0) == ["-i", "/s.mp3"]
    assert sfx_input_args(p, [None], 0) == ["-i", "/s.mp3"]
    assert sfx_input_args(p, [{"fade_in_ms": 500}], 0) == ["-i", "/s.mp3"]
    assert sfx_input_args(p, [{"loop": True}], 0) == ["-stream_loop", "-1", "-i", "/s.mp3"]


def test_music_clip_fit_to_length_loops_like_the_bed(tmp_path: Path):
    """Fit to length on a 2 s song on Music 2 (atMs 0, durMs 6 s, loop, 0.5 s end fade) — same
    result as the looping music bed, and the output stays exactly the video length."""
    video = tmp_path / "v.mp4"
    song = tmp_path / "m.mp3"
    once = tmp_path / "once.mp4"
    clip = tmp_path / "clip.mp4"
    bed = tmp_path / "bed.mp4"
    _voice_video(video, 6, 0.1)
    _tone(song, 2)
    common = dict(length_s=6, volume=0.5, duck_depth=0.0, fade_in_s=0.0, fade_out_s=0.5)
    item = {"atMs": 0, "durMs": 6000, "loop": True, "fadeOutMs": 500, "kind": "music"}
    trim = _sfx_trim(item)
    fx = _with_play_len(_sfx_fx(item), song, trim)
    apply_audio_mix(video, clip, None, [(song, 0, 0.5)], sfx_trims=[trim], sfx_fx=[fx], **common)
    no_loop = {k: v for k, v in item.items() if k != "loop"}
    t2 = _sfx_trim(no_loop)
    apply_audio_mix(video, once, None, [(song, 0, 0.5)], sfx_trims=[t2], sfx_fx=[_with_play_len(_sfx_fx(no_loop), song, t2)], **common)
    apply_audio_mix(
        video, bed, song, [], music_window={"startMs": 0, "endMs": 6000, "inMs": 0}, music_loop=True, **common,
    )
    assert _hi_rms_db(once, 3.5, 4.5) < -60  # the 2 s song is over without Loop
    looped = _hi_rms_db(clip, 3.5, 4.5)
    assert looped > -45, looped  # looping: still playing at 4 s
    assert abs(looped - _hi_rms_db(bed, 3.5, 4.5)) < 3  # same level as the looping bed
    assert _hi_rms_db(clip, 5.85, 6.0) < _hi_rms_db(clip, 4.0, 5.0) - 6  # end fade
    dur = float(subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(clip)], text=True,
    ))
    assert abs(dur - 6.0) < 0.15, dur
