"""G2 manual audio: clip fades, per-clip ducking, looping music bed, solo.

The render tests run real ffmpeg (worker image: 5.1.x) on tiny synthetic files (~1 s total).
Voice = 300 Hz, clip / music = 2 kHz; levels are read through a 1.5 kHz highpass so the
voice never counts toward the clip level.
"""
from __future__ import annotations

import subprocess
from pathlib import Path

from clips_worker.audio_render import (
    apply_audio_mix,
    build_audio_filter,
    clip_fade,
    duck_indices,
    music_input_args,
    voice_split,
)
from clips_worker.timeline_lanes import apply_audio_solo, apply_timeline_lane_state, voice_muted


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


# ---------------------------------------------------------------- filter strings


def test_clip_fade_strings_clamp_to_half_the_play_length():
    assert clip_fade(None, 0) == ""
    assert clip_fade([None], 0) == ""
    f = clip_fade([{"fade_in_ms": 500, "fade_out_ms": 1000, "play_ms": 4000}], 0)
    assert f == "asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.500,afade=t=out:st=3.000:d=1.000,"
    # 1.5 s clip: each fade at most 0.75 s (same as TS fadeGain clampHalf).
    f = clip_fade([{"fade_in_ms": 2000, "fade_out_ms": 2000, "play_ms": 1500}], 0)
    assert "afade=t=in:st=0:d=0.750" in f and "afade=t=out:st=0.750:d=0.750" in f
    # Unknown play length: fade-in only.
    assert clip_fade([{"fade_in_ms": 300, "fade_out_ms": 300, "play_ms": None}], 0) == "asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.300,"


def test_ducked_clips_get_their_own_sidechain_copy():
    fx = [None, {"duck_depth": 0.5}, {"duck_depth": 0}, {"duck_depth": 1.0, "fade_in_ms": 100, "play_ms": 1000}]
    assert duck_indices(fx, 4) == [1, 3]
    assert voice_split("[0:a]", [1, 3]) == "[0:a]asplit=4[sp][sc][dk1][dk3]"
    fc, label = build_audio_filter(
        length_s=6, volume=0.25, duck_depth=0.7, fade_in_s=0.5, fade_out_s=1, has_music=False,
        sfx_specs=[{"at_ms": 0, "volume": 0.8}] * 4, sfx_fx=fx,
    )
    assert label == "[aout]"
    assert fc.startswith("[0:a]asplit=4[sp][sc][dk1][dk3]")
    assert "[s1][dk1]sidechaincompress=threshold=0.0316:ratio=4.500" in fc
    assert "[s3][dk3]sidechaincompress=threshold=0.0316:ratio=8.000" in fc
    assert "[sp][sc][s0][s1d][s2][s3d]amix=inputs=6" in fc
    # No G2 settings: the graph is byte-identical to before.
    old, _ = build_audio_filter(
        length_s=6, volume=0.25, duck_depth=0.7, fade_in_s=0.5, fade_out_s=1, has_music=False,
        sfx_specs=[{"at_ms": 0, "volume": 0.8}],
    )
    assert old == "[0:a]asplit=2[sp][sc];[1:a]adelay=0|0,volume=0.8000[s0];[sp][sc][s0]amix=inputs=3:duration=first:normalize=0,alimiter=limit=0.95[aout]"


def test_music_loop_input_args():
    assert music_input_args(Path("/m.mp3"), False) == ["-i", "/m.mp3"]
    assert music_input_args(Path("/m.mp3"), True) == ["-stream_loop", "-1", "-i", "/m.mp3"]


# ---------------------------------------------------------------- real renders (ffmpeg)


def test_clip_fades_render(tmp_path: Path):
    video = tmp_path / "v.mp4"
    clip = tmp_path / "c.mp3"
    out = tmp_path / "o.mp4"
    _voice_video(video, 5, 0.1)
    _tone(clip, 6)
    # Clip at 0.5 s, plays 4 s, fade in 1 s, fade out 1 s.
    apply_audio_mix(
        video, out, None, [(clip, 500, 0.8)], length_s=5, volume=0.25, duck_depth=0.7, fade_in_s=0.5, fade_out_s=1,
        sfx_trims=[(0, 4000)], sfx_fx=[{"fade_in_ms": 1000, "fade_out_ms": 1000, "play_ms": 4000}],
    )
    early = _hi_rms_db(out, 0.55, 0.75)  # ~10 % into the fade-in
    mid = _hi_rms_db(out, 2.0, 3.0)
    late = _hi_rms_db(out, 4.3, 4.45)  # last ~0.2 s of the fade-out
    assert mid - early > 10, (early, mid)
    assert mid - late > 8, (late, mid)


def test_clip_ducks_under_voice(tmp_path: Path):
    video = tmp_path / "v.mp4"
    clip = tmp_path / "c.mp3"
    plain = tmp_path / "plain.mp4"
    ducked = tmp_path / "ducked.mp4"
    _voice_video(video, 6, 3)  # voice 0-3 s, silence 3-6 s
    _tone(clip, 6)
    common = dict(length_s=6, volume=0.25, duck_depth=0.7, fade_in_s=0.5, fade_out_s=1)
    apply_audio_mix(video, plain, None, [(clip, 0, 0.5)], **common)
    apply_audio_mix(video, ducked, None, [(clip, 0, 0.5)], sfx_fx=[{"duck_depth": 1.0}], **common)
    during = _hi_rms_db(ducked, 1.0, 2.5) - _hi_rms_db(plain, 1.0, 2.5)
    after = _hi_rms_db(ducked, 4.5, 5.5) - _hi_rms_db(plain, 4.5, 5.5)
    assert during < -4, during  # dipped while the voice talks
    assert abs(after) < 1.5, after  # back to full once it stops


def test_music_loop_fills_the_window(tmp_path: Path):
    video = tmp_path / "v.mp4"
    music = tmp_path / "m.mp3"
    once = tmp_path / "once.mp4"
    looped = tmp_path / "loop.mp4"
    _voice_video(video, 6, 0.1)
    _tone(music, 2)
    common = dict(length_s=6, volume=0.5, duck_depth=0.0, fade_in_s=0.0, fade_out_s=0.5, music_window={"startMs": 0, "endMs": 6000, "inMs": 0})
    apply_audio_mix(video, once, music, [], **common)
    apply_audio_mix(video, looped, music, [], music_loop=True, **common)
    assert _hi_rms_db(once, 3.5, 4.5) < -60  # a 2 s song is over
    assert _hi_rms_db(looped, 3.5, 4.5) > -45  # looped: still playing (silence reads < -60)
    assert _hi_rms_db(looped, 5.85, 6.0) < _hi_rms_db(looped, 4.0, 5.0) - 6  # end fade
    # The output is still exactly the video length (the infinite input never runs on).
    dur = float(subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(looped)], text=True,
    ))
    assert abs(dur - 6.0) < 0.15, dur


# ---------------------------------------------------------------- solo


def test_solo_mutes_every_other_audio_unit():
    edits = {
        "timelineLanes": {"music": {"soloed": True}},
        "tracks": [
            {"id": "ov1", "kind": "overlay"}, {"id": "tx1", "kind": "text"}, {"id": "au1", "kind": "audio"},
            {"id": "au2", "kind": "audio", "items": ["s2"]},
        ],
        "audio": {"music": {"generationId": "m"}, "sfx": [{"generationId": "s1", "atMs": 0}, {"generationId": "s2", "atMs": 0}]},
    }
    solo = apply_audio_solo(edits)
    assert solo["timelineLanes"]["voice"]["muted"] is True
    assert solo["timelineLanes"]["sfx"]["muted"] is True
    assert "muted" not in solo["timelineLanes"]["music"]
    assert next(t for t in solo["tracks"] if t["id"] == "au2")["muted"] is True
    assert voice_muted(edits) is True
    rendered = apply_timeline_lane_state(edits)
    assert rendered["audio"]["music"] == {"generationId": "m"}
    assert rendered["audio"]["sfx"] == []
    # Soloing the extra track instead keeps only it.
    edits2 = {**edits, "timelineLanes": None, "tracks": [*edits["tracks"][:3], {"id": "au2", "kind": "audio", "items": ["s2"], "soloed": True}]}
    r2 = apply_timeline_lane_state(edits2)
    assert r2["audio"]["music"] is None
    assert [s["generationId"] for s in r2["audio"]["sfx"]] == ["s2"]
    assert voice_muted(edits2) is True
    # Nothing soloed: unchanged.
    plain = {"timelineLanes": {"music": {"muted": True}}}
    assert apply_audio_solo(plain) is plain
    assert voice_muted(plain) is False
