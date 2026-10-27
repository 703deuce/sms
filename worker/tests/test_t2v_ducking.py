"""T2V music ducking — reuses audio_render sidechaincompress graph (lavfi, ≤10s)."""
from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path

from clips_worker.t2v.audio_duck import ducking_stem_for_test, mix_voice_and_music


def _mean_volume(path: Path, start: float, dur: float) -> float:
    p = subprocess.run(
        [
            "ffmpeg", "-v", "info", "-ss", str(start), "-t", str(dur),
            "-i", str(path), "-af", "volumedetect", "-f", "null", "-",
        ],
        capture_output=True,
        text=True,
    )
    line = [ln for ln in p.stderr.splitlines() if "mean_volume" in ln][0]
    return float(line.split("mean_volume:")[1].split("dB")[0])


def test_music_ducked_under_voice_lavfi():
    with tempfile.TemporaryDirectory() as td:
        d = Path(td)
        vo = d / "vo.wav"
        music = d / "music.wav"
        subprocess.run(
            ["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "sine=f=440:d=3", "-ar", "44100", str(vo)],
            check=True,
            capture_output=True,
        )
        subprocess.run(
            ["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "sine=f=110:d=3", "-ar", "44100", str(music)],
            check=True,
            capture_output=True,
        )
        stem = d / "ducked_music.wav"
        ducking_stem_for_test(vo, music, stem, length_s=3.0, duck_depth=1.0)
        music_only = d / "flat.wav"
        subprocess.run(
            ["ffmpeg", "-y", "-v", "error", "-i", str(music), "-af", "volume=0.8", str(music_only)],
            check=True,
            capture_output=True,
        )
        under_vo = _mean_volume(stem, 0.3, 0.8)
        alone = _mean_volume(music_only, 0.3, 0.8)
        assert under_vo < alone - 3.0, (under_vo, alone)

        mix = d / "mix.wav"
        mix_voice_and_music(vo, music, mix, length_s=3.0, duck_depth=0.7)
        assert mix.stat().st_size > 1000
