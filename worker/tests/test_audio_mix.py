"""Audio ducking mix: music RMS lower during speech."""
from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path

from clips_worker.audio_render import apply_audio_mix, export_ducked_music_stem


def _render_synth_mix(work: Path) -> Path:
    speech = work / "speech.mp4"
    music = work / "music.mp3"
    out = work / "out.mp4"

    # 6s container: speech sine 1-3s
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            "color=c=black:s=320x240:d=6",
            "-f",
            "lavfi",
            "-i",
            "anullsrc=r=44100:cl=stereo",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440:duration=2",
            "-filter_complex",
            "[2:a]adelay=1000|1000,volume=2.5[s];[1:a][s]amix=inputs=2:duration=first:normalize=0[a]",
            "-map",
            "0:v:0",
            "-map",
            "[a]",
            "-t",
            "6",
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            str(speech),
        ],
    )
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            "anoisesrc=d=6:c=pink:r=44100:a=0.4",
            "-c:a",
            "libmp3lame",
            str(music),
        ],
    )
    apply_audio_mix(
        speech,
        out,
        music,
        [],
        length_s=6.0,
        volume=0.85,
        duck_depth=1.0,
        fade_in_s=0.0,
        fade_out_s=0.0,
    )

    stem = work / "music_stem.wav"
    export_ducked_music_stem(
        speech,
        music,
        stem,
        length_s=6.0,
        volume=0.85,
        duck_depth=1.0,
        fade_in_s=0.0,
        fade_out_s=0.0,
    )
    return out, stem, music


def _rms_db(path: Path, start: float, end: float) -> float:
    dur = end - start
    proc = subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "info",
            "-ss",
            f"{start:.3f}",
            "-t",
            f"{dur:.3f}",
            "-i",
            str(path),
            "-af",
            "astats=metadata=1:reset=1",
            "-f",
            "null",
            "-",
        ],
        capture_output=True,
        text=True,
    )
    text = proc.stderr + proc.stdout
    for line in text.splitlines():
        if "RMS level dB" in line:
            return float(line.split("RMS level dB:")[-1].strip())
    raise RuntimeError(f"astats failed: {text[-500:]}")


def test_music_ducked_during_speech():
    with tempfile.TemporaryDirectory() as td:
        out, stem, music_path = _render_synth_mix(Path(td))
        dur_proc = subprocess.check_output(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(out),
            ],
            text=True,
        ).strip()
        duration = float(dur_proc)
        assert abs(duration - 6.0) <= 0.05, f"duration {duration}"

        rms_unducked = _rms_db(music_path, 1.2, 2.8)
        rms_ducked = _rms_db(stem, 1.2, 2.8)
        rms_quiet = _rms_db(stem, 4.0, 5.5)
        duck_delta = rms_unducked - rms_ducked
        print(
            f"unducked={rms_unducked:.2f} ducked={rms_ducked:.2f} quiet={rms_quiet:.2f} duck_delta={duck_delta:.2f}"
        )
        assert duck_delta >= 8.0, f"expected >=8dB ducking vs unducked music, got {duck_delta:.2f}"
