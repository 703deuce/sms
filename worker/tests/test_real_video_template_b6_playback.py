from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

from clips_worker.ffmpeg_util import probe_video_nb_frames
from clips_worker.media_sources import apply_full_render_sources
from clips_worker.template_playback import render_playback_window

FFMPEG = shutil.which("ffmpeg")
FFPROBE = shutil.which("ffprobe")
pytestmark = pytest.mark.skipif(not FFMPEG or not FFPROBE, reason="ffmpeg/ffprobe required")


def _run(args: list[str]) -> None:
    subprocess.run(args, check=True, capture_output=True, text=True)


def _make_video(path: Path, color: str, *, audio: bool) -> None:
    cmd = [
        "ffmpeg", "-y", "-v", "error",
        "-f", "lavfi", "-i", f"color=c={color}:s=160x90:r=30:d=3",
    ]
    if audio:
        cmd += ["-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=3", "-shortest"]
    cmd += ["-c:v", "libx264", "-pix_fmt", "yuv420p"]
    if audio:
        cmd += ["-c:a", "aac"]
    else:
        cmd += ["-an"]
    cmd += [str(path)]
    _run(cmd)


def _make_dynamic(path: Path) -> None:
    _run([
        "ffmpeg", "-y", "-v", "error",
        "-f", "lavfi", "-i", "testsrc2=s=160x90:r=30:d=3",
        "-f", "lavfi", "-i", "sine=frequency=660:sample_rate=48000:duration=3",
        "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", str(path),
    ])


def _make_carrier(path: Path) -> None:
    _run([
        "ffmpeg", "-y", "-v", "error",
        "-f", "lavfi", "-i", "color=c=black:s=160x90:r=30:d=2",
        "-f", "lavfi", "-i", "sine=frequency=220:sample_rate=48000:duration=2",
        "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", str(path),
    ])


def _raw_frames(path: Path) -> list[bytes]:
    proc = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"],
        check=True, capture_output=True,
    )
    size = 160 * 90 * 3
    return [proc.stdout[i:i + size] for i in range(0, len(proc.stdout), size) if len(proc.stdout[i:i + size]) == size]


def _mean_abs(a: bytes, b: bytes) -> float:
    return sum(abs(x - y) for x, y in zip(a, b)) / max(1, len(a))


def _pixel(path: Path, at_s: float) -> tuple[int, int, int]:
    proc = subprocess.run(
        [
            "ffmpeg", "-v", "error", "-ss", f"{at_s:.4f}", "-i", str(path),
            "-frames:v", "1", "-vf", "scale=1:1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1",
        ],
        check=True, capture_output=True,
    )
    return tuple(proc.stdout[:3])  # type: ignore[return-value]


PLAYBACK = {
    "v": 1,
    "fps": 30,
    "outputFrames": 30,
    "pieces": [
        {"kind": "play", "frames": 10, "rate": 0.5},
        {"kind": "hold", "frames": 5},
        {"kind": "play", "frames": 15, "rate": 1.5},
    ],
}


def test_playback_window_freezes_picture_and_does_not_repeat_source_audio(tmp_path: Path) -> None:
    source = tmp_path / "dynamic.mp4"
    out = tmp_path / "playback.mp4"
    _make_dynamic(source)
    render_playback_window(source, PLAYBACK, 500, 3000, 0, 30, 30.0, out, include_audio=True)

    assert probe_video_nb_frames(out) == 30
    frames = _raw_frames(out)
    assert len(frames) == 30
    assert _mean_abs(frames[10], frames[14]) < 1.0
    assert _mean_abs(frames[6], frames[20]) > 2.0

    silence = subprocess.run(
        ["ffmpeg", "-v", "info", "-i", str(out), "-af", "silencedetect=noise=-45dB:d=0.08", "-f", "null", "-"],
        capture_output=True, text=True,
    )
    assert "silence_start" in (silence.stderr or "")


def _composite(tmp_path: Path, transition: str) -> Path:
    carrier = tmp_path / ("carrier_" + transition + ".mp4")
    red = tmp_path / ("red_" + transition + ".mp4")
    blue = tmp_path / ("blue_" + transition + ".mp4")
    _make_carrier(carrier)
    _make_video(red, "red", audio=True)
    _make_video(blue, "blue", audio=False)
    edits = {
        "sources": [
            {"id": "sa", "ref": "upload", "refId": "a", "mediaType": "video", "durationMs": 3000},
            {"id": "sb", "ref": "upload", "refId": "b", "mediaType": "video", "durationMs": 3000},
        ],
        "sourceSegments": [
            {
                "id": "item_a", "sourceId": "sa", "startMs": 0, "endMs": 1000, "inMs": 500,
                "audio": "source", "playback": PLAYBACK, "transform": {"scale": 105}, "fx": {"contrast": 6},
            },
            {
                "id": "item_b", "sourceId": "sb", "startMs": 1000, "endMs": 2000, "inMs": 500,
                "audio": "main", "fit": "contain",
            },
        ],
        "videoSplits": [1000],
        "transitions": [{"srcMs": 1000, "type": transition, "durMs": 200}],
        "templateProvenance": {"familyId": "b6"},
    }
    return apply_full_render_sources(
        carrier, edits, 0, 2000, tmp_path, {"a": red, "b": blue},
    )


def test_playback_composite_keeps_duration_and_blends_real_cross_source_frames(tmp_path: Path) -> None:
    out = _composite(tmp_path, "crossfade")
    assert abs((probe_video_nb_frames(out) or 0) - 60) <= 1
    before = _pixel(out, 0.75)
    during = _pixel(out, 1.00)
    after = _pixel(out, 1.25)
    assert before[0] > before[2]
    assert during[0] > 20 and during[2] > 20
    assert after[2] > after[0]


def test_shader_cross_source_transition_uses_real_shader_when_renderer_available(tmp_path: Path) -> None:
    pytest.importorskip("moderngl")
    from clips_worker.shader_transitions import ShaderUnavailable, gl_context

    try:
        ctx, _ = gl_context()
    except Exception as exc:
        pytest.skip("shader renderer unavailable: " + str(exc))
    else:
        ctx.release()
    out = _composite(tmp_path, "glitch")
    assert abs((probe_video_nb_frames(out) or 0) - 60) <= 1
    before = _pixel(out, 0.75)
    during = _pixel(out, 1.00)
    after = _pixel(out, 1.25)
    assert during != before
    assert during != after


def test_photo_video_no_audio_source_and_half_second_shots(tmp_path: Path) -> None:
    """No-audio uploaded footage still renders ramped picture; silence is not fabricated as dialogue."""
    mute_video = tmp_path / "mute_upload.mp4"
    _make_video(mute_video, "green", audio=False)
    short_plan = {
        "v": 1, "fps": 30, "outputFrames": 15,
        "pieces": [
            {"kind": "play", "frames": 5, "rate": 0.5},
            {"kind": "hold", "frames": 5},
            {"kind": "play", "frames": 5, "rate": 2},
        ],
    }
    out = tmp_path / "short_silent.mp4"
    render_playback_window(mute_video, short_plan, 200, 3000, 0, 15, 30.0, out, include_audio=False)
    assert probe_video_nb_frames(out) == 15
    decoded = _raw_frames(out)
    assert len(decoded) == 15
    assert decoded[5] == decoded[9]  # frozen decoded picture, not a black carrier

    with pytest.raises(ValueError, match="head handles"):
        render_playback_window(mute_video, short_plan, 0, 3000, -3, 15, 30.0, out, include_audio=False)


def test_malformed_playback_does_not_fall_back_to_normal_speed() -> None:
    from clips_worker.media_sources import normalize_source_segments

    sources = [{"id": "sa", "ref": "upload", "refId": "a", "mediaType": "video", "durationMs": 3000}]
    bad = {"id": "item", "sourceId": "sa", "startMs": 0, "endMs": 1000,
           "playback": {**PLAYBACK, "outputFrames": 29}}
    with pytest.raises(ValueError, match="source playback"):
        normalize_source_segments([bad], sources)


def test_template_missing_assigned_media_fails_closed(tmp_path: Path) -> None:
    carrier = tmp_path / "carrier_empty.mp4"
    _make_carrier(carrier)
    edits = {
        "sources": [{"id": "sa", "ref": "upload", "refId": "a", "mediaType": "video", "durationMs": 3000}],
        "sourceSegments": [{"id": "item", "sourceId": "sa", "startMs": 0, "endMs": 1000, "playback": PLAYBACK}],
        "templateProvenance": {"familyId": "b6"},
    }
    with pytest.raises(RuntimeError, match="black carrier fallback"):
        apply_full_render_sources(carrier, edits, 0, 1000, tmp_path, {})
