"""E2 export timing on a short fixture: what the timeline/preview shows is what ffmpeg renders.

- B-roll in-point (inMs): the overlay shows media time inMs at startMs (split / left-trim parity).
- Music window: the bed is audible only inside [startMs, endMs) (move / trim parity).
- Voice lane mute: speech is silent.
- SFX at atMs (existing behaviour, regression guard).
"""
from __future__ import annotations

import re
import subprocess
import tempfile
from pathlib import Path

from clips_worker.audio_render import apply_audio_mix, apply_voice_mute, build_audio_filter
from clips_worker.broll_render import apply_broll_overlays, build_broll_filtergraph

W, H = 160, 284


def _run(args: list[str]) -> None:
    subprocess.check_call(["ffmpeg", "-y", "-v", "error", *args])


def _base_video(path: Path, *, seconds: int = 6, tone: bool = False) -> None:
    audio = f"sine=f=440:d={seconds}" if tone else f"anullsrc=r=48000:cl=stereo:d={seconds}"
    _run(
        [
            "-f", "lavfi", "-i", f"color=c=black:s={W}x{H}:r=30:d={seconds}",
            "-f", "lavfi", "-i", audio,
            "-shortest", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
            "-c:a", "aac", str(path),
        ]
    )


def _frame_rgb(video: Path, t: float) -> tuple[int, int, int]:
    raw = subprocess.check_output(
        [
            "ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", str(video),
            "-frames:v", "1", "-vf", "crop=8:8:76:138", "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
        ]
    )
    n = len(raw) // 3
    return tuple(sum(raw[i::3]) // n for i in range(3))  # type: ignore[return-value]


def _mean_db(video: Path, start: float, dur: float) -> float:
    proc = subprocess.run(
        [
            "ffmpeg", "-v", "info", "-ss", f"{start:.3f}", "-t", f"{dur:.3f}", "-i", str(video),
            "-vn", "-af", "volumedetect", "-f", "null", "-",
        ],
        capture_output=True,
        text=True,
    )
    m = re.search(r"mean_volume:\s*(-?[\d.]+|-inf) dB", proc.stderr)
    if not m or m.group(1) == "-inf":
        return -120.0
    return float(m.group(1))


def test_broll_filtergraph_uses_in_point():
    fc, _, _ = build_broll_filtergraph(
        [{"local_path": "/tmp/none.mp4", "start_s": 1.0, "end_s": 3.0, "duration_s": 2.0, "in_s": 2.0}], W, H
    )
    assert "trim=2.000:4.000" in fc
    assert "setpts=PTS-STARTPTS+1.000/TB" in fc
    assert "between(t,1.000,3.000)" in fc


def test_broll_in_point_renders_the_right_media_frames():
    with tempfile.TemporaryDirectory() as td:
        d = Path(td)
        base, broll, out = d / "base.mp4", d / "broll.mp4", d / "out.mp4"
        _base_video(base)
        # B-roll media: 0-2 s red, 2-4 s green.
        _run(
            [
                "-f", "lavfi", "-i", f"color=c=red:s={W}x{H}:r=30:d=2",
                "-f", "lavfi", "-i", f"color=c=green:s={W}x{H}:r=30:d=2",
                "-filter_complex", "[0:v][1:v]concat=n=2:v=1:a=0[v]", "-map", "[v]",
                "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", str(broll),
            ]
        )
        # Timeline item: output 1.0-3.0 s, inMs 2000 (e.g. the right half of a split).
        spec = {"local_path": broll, "start_s": 1.0, "end_s": 3.0, "duration_s": 2.0, "in_s": 2.0}
        apply_broll_overlays(base, out, [spec], W, H)
        before = _frame_rgb(out, 0.5)
        during = _frame_rgb(out, 1.5)
        after = _frame_rgb(out, 3.5)
        assert max(before) < 40, before  # base (black)
        assert during[1] > 90 and during[0] < 80, during  # green = media 2.5 s, not red (media 0.5 s)
        assert max(after) < 40, after


def test_music_window_filter_legacy_string_unchanged():
    legacy, _ = build_audio_filter(
        length_s=6.0, volume=0.25, duck_depth=0.7, fade_in_s=0.5, fade_out_s=1.0, has_music=True, sfx_specs=[]
    )
    full_window, _ = build_audio_filter(
        length_s=6.0, volume=0.25, duck_depth=0.7, fade_in_s=0.5, fade_out_s=1.0, has_music=True, sfx_specs=[],
        music_window={"startMs": 0, "endMs": 6000, "inMs": 0},
    )
    assert legacy == full_window
    assert "[1:a]volume=0.2500,afade=t=in:d=0.500" in legacy


def test_music_window_timing_and_voice_mute():
    with tempfile.TemporaryDirectory() as td:
        d = Path(td)
        base, music, out, muted = d / "base.mp4", d / "music.wav", d / "mixed.mp4", d / "muted.mp4"
        _base_video(base)  # silent speech
        _run(["-f", "lavfi", "-i", "sine=f=1000:d=10", "-ar", "48000", str(music)])
        apply_audio_mix(
            base, out, music, [],
            length_s=6.0, volume=1.0, duck_depth=0.0, fade_in_s=0.0, fade_out_s=0.0,
            music_window={"startMs": 2000, "endMs": 4000, "inMs": 1000},
        )
        assert _mean_db(out, 0.3, 1.4) < -60
        assert _mean_db(out, 2.3, 1.4) > -30
        assert _mean_db(out, 4.4, 1.2) < -60

        toned = d / "toned.mp4"
        _base_video(toned, tone=True)
        assert _mean_db(toned, 1.0, 2.0) > -30
        apply_voice_mute(toned, muted)
        assert _mean_db(muted, 1.0, 2.0) < -60


def test_sfx_at_ms_timing():
    with tempfile.TemporaryDirectory() as td:
        d = Path(td)
        base, sfx, out = d / "base.mp4", d / "sfx.wav", d / "out.mp4"
        _base_video(base)
        _run(["-f", "lavfi", "-i", "sine=f=800:d=0.5", "-ar", "48000", str(sfx)])
        apply_audio_mix(
            base, out, None, [(sfx, 3000, 1.0)],
            length_s=6.0, volume=0.25, duck_depth=0.7, fade_in_s=0.5, fade_out_s=1.0,
        )
        assert _mean_db(out, 1.0, 1.5) < -60
        assert _mean_db(out, 3.05, 0.4) > -30
