"""AU-33: music bed fades / stems parity on export (ffmpeg RMS envelope)."""
from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path

import pytest

from clips_worker.audio_render import (
    apply_audio_mix,
    export_ducked_music_stem,
    export_mix_stems,
    export_voice_stem,
    measure_segment_rms_db,
)
from clips_worker.timeline_lanes import music_window


def _ff(*args: str) -> None:
    subprocess.check_call(["ffmpeg", "-y", "-v", "error", *args])


def _silent_video(path: Path, secs: float) -> None:
    _ff(
        "-f",
        "lavfi",
        "-i",
        f"color=c=black:s=160x120:d={secs}",
        "-f",
        "lavfi",
        "-i",
        "anullsrc=r=48000:cl=stereo",
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-t",
        str(secs),
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-c:a",
        "aac",
        str(path),
    )


def _tone(path: Path, secs: float, freq: int = 1000) -> None:
    _ff("-f", "lavfi", "-i", f"sine=frequency={freq}:duration={secs}", "-ar", "48000", str(path))


def _rms(path: Path, t0: float, t1: float) -> float:
    return measure_segment_rms_db(path, t0, t1)


def test_music_window_extends_end_within_fade_out():
    win = music_window(
        {"generationId": "m", "startMs": 0, "endMs": 38700, "inMs": 0, "fadeOutMs": 3000},
        41000,
    )
    assert win == {"startMs": 0, "endMs": 41000, "inMs": 0}


@pytest.mark.skipif(not __import__("shutil").which("ffmpeg"), reason="no ffmpeg")
def test_music_fade_envelope_trimmed_from_long_source():
    """10 s output clip, 60 s source, fade in 2 s / fade out 3 s, in-point at 5 s media."""
    with tempfile.TemporaryDirectory() as td:
        d = Path(td)
        video = d / "v.mp4"
        music = d / "music.wav"
        stem = d / "music_stem.wav"
        _silent_video(video, 10.0)
        _tone(music, 60.0)
        win = music_window(
            {"generationId": "m", "startMs": 0, "endMs": 10000, "inMs": 5000, "fadeOutMs": 3000, "fadeInMs": 2000},
            10000,
        )
        export_ducked_music_stem(
            video,
            music,
            stem,
            length_s=10.0,
            volume=1.0,
            duck_depth=0.0,
            fade_in_s=2.0,
            fade_out_s=3.0,
            music_window=win,
        )
        early = _rms(stem, 0.15, 0.25)
        full = _rms(stem, 3.0, 4.0)
        mid_out = _rms(stem, 9.0, 9.2)
        tail = _rms(stem, 9.85, 9.98)
        assert early < full - 6.0, (early, full)
        assert mid_out < full - 3.0, (mid_out, full)
        assert tail < -55.0, tail


@pytest.mark.skipif(not __import__("shutil").which("ffmpeg"), reason="no ffmpeg")
def test_full_mix_matches_voice_plus_music_stems():
    with tempfile.TemporaryDirectory() as td:
        d = Path(td)
        video = d / "v.mp4"
        music = d / "bed.wav"
        _silent_video(video, 6.0)
        _tone(music, 20.0, 800)
        # Voice tone on the video track for a simple sum check.
        voiced = d / "voiced.mp4"
        _ff(
            "-f",
            "lavfi",
            "-i",
            "color=c=black:s=160x120:d=6",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=300:duration=6",
            "-map",
            "0:v:0",
            "-map",
            "1:a:0",
            "-t",
            "6",
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-c:a",
            "aac",
            str(voiced),
        )
        mixed = d / "mixed.mp4"
        apply_audio_mix(
            voiced,
            mixed,
            music,
            [],
            length_s=6.0,
            volume=0.4,
            duck_depth=0.0,
            fade_in_s=0.5,
            fade_out_s=1.0,
            music_window={"startMs": 0, "endMs": 6000, "inMs": 0},
        )
        stems_dir = d / "stems"
        export_mix_stems(
            voiced,
            stems_dir,
            music,
            [],
            length_s=6.0,
            volume=0.4,
            duck_depth=0.0,
            fade_in_s=0.5,
            fade_out_s=1.0,
            music_window={"startMs": 0, "endMs": 6000, "inMs": 0},
        )
        v_stem = stems_dir / "voice.wav"
        m_stem = stems_dir / "music.wav"
        assert v_stem.is_file() and m_stem.is_file()
        sum_wav = d / "sum.wav"
        _ff(
            "-i",
            str(v_stem),
            "-i",
            str(m_stem),
            "-filter_complex",
            "[0:a][1:a]amix=inputs=2:duration=first:normalize=0[a]",
            "-map",
            "[a]",
            str(sum_wav),
        )
        mix_rms = _rms(mixed, 2.0, 4.0)
        sum_rms = _rms(sum_wav, 2.0, 4.0)
        assert abs(mix_rms - sum_rms) < 1.5, (mix_rms, sum_rms)
