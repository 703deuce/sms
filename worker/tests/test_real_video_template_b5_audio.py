"""Batch 5 standalone template soundtrack proof against the existing shared audio renderer.

No worker code changes: original source audio, music ducking/fades and explicit
loop reuse the same FFmpeg implementation as ordinary ClipEditsV2 export.
"""
from __future__ import annotations

import array
import json
import math
import subprocess
from pathlib import Path

from clips_worker.audio_render import apply_audio_mix


def _cmd(*args: str) -> None:
    subprocess.run(["ffmpeg", "-y", "-v", "error", *args], check=True, timeout=60)


def _probe(path: Path) -> dict:
    raw = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries",
         "format=duration:stream=index,codec_type,nb_frames", "-of", "json", str(path)],
        text=True,
        timeout=20,
    )
    return json.loads(raw)


def _rms(path: Path, at_s: float) -> float:
    chunk = subprocess.check_output([
        "ffmpeg", "-v", "error", "-ss", f"{at_s:.3f}", "-t", "0.15",
        "-i", str(path), "-vn", "-ac", "1", "-ar", "16000",
        "-f", "f32le", "-",
    ], timeout=30)
    samples = array.array("f")
    samples.frombytes(chunk)
    return math.sqrt(sum(float(s) * float(s) for s in samples) / len(samples)) if samples else 0.0


def test_template_music_continuous_across_two_real_source_audio_shots(tmp_path: Path) -> None:
    video = tmp_path / "two-shot.mp4"
    # FFmpeg concat means the carrier has two actual source-audio regions.
    _cmd(
        "-f", "lavfi", "-i", "color=c=red:s=160x90:r=30:d=1.5",
        "-f", "lavfi", "-i", "sine=frequency=330:sample_rate=48000:duration=1.5",
        "-f", "lavfi", "-i", "color=c=blue:s=160x90:r=30:d=1.5",
        "-f", "lavfi", "-i", "sine=frequency=660:sample_rate=48000:duration=1.5",
        "-filter_complex", "[0:v][1:a][2:v][3:a]concat=n=2:v=1:a=1[v][a]",
        "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "160k", str(video),
    )
    music = tmp_path / "owned-bed.wav"
    _cmd("-f", "lavfi", "-i", "sine=frequency=880:sample_rate=48000:duration=3",
         "-filter:a", "volume=0.16", str(music))
    out = tmp_path / "mixed.mp4"
    apply_audio_mix(
        video, out, music, [],
        length_s=3.0, volume=0.35, duck_depth=0.65,
        fade_in_s=0.25, fade_out_s=0.35, music_loop=False,
    )
    data = _probe(out)
    streams = data.get("streams", [])
    assert any(s["codec_type"] == "video" for s in streams)
    assert any(s["codec_type"] == "audio" for s in streams)
    assert abs(float(data["format"]["duration"]) - 3.0) < (1.0 / 30.0 + 0.05)
    # Sources remain audible on both sides of the A/B cut; no whole-clip mute,
    # huge gap or lost audio caused by music-window alignment.
    for stamp in (0.20, 1.32, 1.67, 2.72):
        assert _rms(out, stamp) > 0.005
    loud = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", str(out), "-af", "volumedetect",
         "-f", "null", "-"],
        capture_output=True, text=True, timeout=30,
    )
    assert loud.returncode == 0
    line = next((line for line in loud.stderr.splitlines() if "max_volume:" in line), "")
    assert line, loud.stderr
    assert float(line.split("max_volume:")[1].strip().split()[0]) <= 0.0


def test_template_explicit_music_loop_ends_at_authored_video_duration(tmp_path: Path) -> None:
    video = tmp_path / "carrier.mp4"
    _cmd("-f", "lavfi", "-i", "color=c=black:s=160x90:r=30:d=3",
         "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
         "-t", "3", "-c:v", "libx264", "-c:a", "aac", str(video))
    music = tmp_path / "short-owned-bed.wav"
    _cmd("-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=1.5",
         "-filter:a", "volume=0.12", str(music))
    out = tmp_path / "looped.mp4"
    apply_audio_mix(
        video, out, music, [],
        length_s=3.0, volume=0.35, duck_depth=0.55,
        fade_in_s=0.12, fade_out_s=0.2, music_loop=True,
    )
    assert abs(float(_probe(out)["format"]["duration"]) - 3.0) < (1.0/30.0 + 0.05)
    assert _rms(out, 2.30) > 0.001
