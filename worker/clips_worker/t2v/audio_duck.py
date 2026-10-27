"""Duck background music under T2V voiceover (same graph as script composition export)."""
from __future__ import annotations

import subprocess
from pathlib import Path

from clips_worker.audio_render import build_audio_filter, export_ducked_music_stem


def mix_voice_and_music(
    voice: Path,
    music: Path | None,
    out: Path,
    *,
    length_s: float,
    volume: float = 0.8,
    duck_depth: float = 0.7,
    fade_in_s: float = 0.0,
    fade_out_s: float = 0.0,
) -> Path:
    """Write stereo AAC/WAV mix: voice (input 0) + optional ducked music (input 1)."""
    has_music = music is not None and music.is_file()
    fc, alabel = build_audio_filter(
        length_s=length_s,
        volume=volume,
        duck_depth=duck_depth,
        fade_in_s=fade_in_s,
        fade_out_s=fade_out_s,
        has_music=has_music,
        sfx_specs=[],
        music_input_index=1,
    )
    cmd = ["ffmpeg", "-y", "-v", "error", "-i", str(voice)]
    if has_music:
        cmd.extend(["-i", str(music)])
    cmd.extend(["-filter_complex", fc, "-map", alabel, str(out)])
    subprocess.run(cmd, check=True, capture_output=True, text=True)
    return out


def ducking_stem_for_test(
    voice: Path,
    music: Path,
    out: Path,
    *,
    length_s: float,
    duck_depth: float = 0.7,
) -> Path:
    """Music-only sidechain output ([md]) for loudness assertions."""
    export_ducked_music_stem(
        voice,
        music,
        out,
        length_s=length_s,
        volume=0.8,
        duck_depth=duck_depth,
        fade_in_s=0.0,
        fade_out_s=0.0,
    )
    return out
