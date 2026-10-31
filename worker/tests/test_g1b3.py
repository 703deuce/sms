"""G1b3: J / L split audio, freeze frame splice, SFX volume envelope (real ffmpeg; image = 5.1)."""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

from clips_worker.audio_render import build_audio_filter, sfx_env
from clips_worker.media_inserts import edits_insert_windows, normalize_inserts, splice_inserts
from clips_worker.motion import volume_expr
from clips_worker.split_edits import apply_split_audio, audio_segments, normalize_split_edits, split_offsets

FIX = Path(__file__).parent / "fixtures" / "g1b3_parity.json"
needs_ff = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg missing")


def _run(*args: str) -> None:
    subprocess.check_call(["ffmpeg", "-y", "-v", "error", *args])


def _dur(p: Path) -> float:
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)], text=True))


def _rgb_at(p: Path, t: float) -> tuple[int, int, int]:
    raw = subprocess.check_output(
        ["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", str(p), "-frames:v", "1", "-vf", "scale=1:1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    )
    return raw[0], raw[1], raw[2]


def _freq_at(p: Path, t: float) -> float:
    """Dominant frequency (zero crossings) of a 0.2 s window."""
    raw = subprocess.check_output(
        ["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-t", "0.2", "-i", str(p), "-vn", "-ac", "1", "-ar", "8000", "-f", "s16le", "-"]
    )
    import array

    a = array.array("h", raw)
    zc = sum(1 for i in range(1, len(a)) if (a[i - 1] < 0) != (a[i] < 0))
    return zc / 2 / (len(a) / 8000)


def test_parity_fixture():
    for c in json.loads(FIX.read_text())["split_cases"]:
        o = split_offsets([tuple(s) for s in c["segs"]], normalize_split_edits(c["splits"]), c["trim"][0], c["trim"][1])
        assert o == c["offsets"]
        assert [list(x) for x in audio_segments([tuple(s) for s in c["segs"]], o)] == c["audio"]


@needs_ff
def test_split_audio_l_cut(tmp_path: Path):
    # full render: 0–3 s 440 Hz, 3–6 s 1000 Hz. Cut keeps [0,2] + [4,6]; L-cut 500 ms at 4000.
    full = tmp_path / "full.mp4"
    _run("-f", "lavfi", "-i", "color=c=red:s=160x284:r=30:d=6",
         "-f", "lavfi", "-i", "sine=f=440:d=3:sample_rate=48000", "-f", "lavfi", "-i", "sine=f=1000:d=3:sample_rate=48000",
         "-filter_complex", "[1:a][2:a]concat=n=2:v=0:a=1[a]", "-map", "0:v", "-map", "[a]",
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", str(full))
    cut = tmp_path / "cut.mp4"
    _run("-i", str(full), "-filter_complex",
         "[0:v]trim=0:2,setpts=PTS-STARTPTS[v0];[0:v]trim=4:6,setpts=PTS-STARTPTS[v1];[v0][v1]concat=n=2:v=1:a=0[v];"
         "[0:a]atrim=0:2,asetpts=PTS-STARTPTS[a0];[0:a]atrim=4:6,asetpts=PTS-STARTPTS[a1];[a0][a1]concat=n=2:v=0:a=1[a]",
         "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-c:a", "aac", str(cut))
    # Sound: [0,2.5] then [4.5,6] — at output 2.1 s still the outgoing (440 Hz) clip. Make the outgoing
    # clip's tail differ: source 2–2.5 s is 440 Hz; incoming at 4.5 s is 1000 Hz.
    out = apply_split_audio(cut, full, tmp_path / "split.mp4", [(0.0, 2.5), (4.5, 6.0)])
    assert abs(_dur(out) - 4.0) < 0.15
    assert _freq_at(out, 2.15) == pytest.approx(440, rel=0.1)  # L: old sound under the new picture
    assert _freq_at(out, 3.0) == pytest.approx(1000, rel=0.1)
    assert _freq_at(cut, 2.15) == pytest.approx(1000, rel=0.1)  # control: hard cut


@needs_ff
def test_freeze_frame_splice(tmp_path: Path):
    main = tmp_path / "main.mp4"
    _run("-f", "lavfi", "-i", "color=c=red:s=180x320:r=30:d=2", "-f", "lavfi", "-i", "color=c=blue:s=180x320:r=30:d=2",
         "-f", "lavfi", "-i", "sine=f=440:d=4:sample_rate=48000",
         "-filter_complex", "[0:v][1:v]concat=n=2:v=1:a=0[v]", "-map", "[v]", "-map", "2:a",
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", str(main))
    edits = {"trim": {"in": 0, "out": 4000}, "inserts": [
        {"id": "f1", "sourceId": "freeze", "atSrcMs": 1000, "durMs": 1500},
        {"id": "f2", "sourceId": "freeze", "atSrcMs": 0, "append": True, "durMs": 1000},
    ]}
    assert [w.get("freeze") for w in edits_insert_windows(edits)] == [True, True]
    out, _srt, added = splice_inserts(main, tmp_path, edits, {"keep_segs_src": [[0, 4000]]}, {}, "")
    assert added == 2500
    assert abs(_dur(out) - 6.5) < 0.2
    r, g, b = _rgb_at(out, 1.8)  # inside the freeze at 1 s → red held
    assert r > 150 and b < 80
    r, g, b = _rgb_at(out, 6.2)  # appended freeze of the last (blue) frame
    assert b > 150 and r < 80


def test_freeze_normalize_needs_no_source():
    got = normalize_inserts([{"id": "f", "sourceId": "freeze", "atSrcMs": 5, "durMs": 100}, {"id": "g", "sourceId": "freeze", "atSrcMs": 5, "durMs": 900}], [])
    assert got == [{"id": "g", "sourceId": "freeze", "atSrcMs": 5, "inMs": 0, "durMs": 900, "audio": "mute"}]


@needs_ff
def test_sfx_volume_envelope(tmp_path: Path):
    edits = {"keyframes": [{"target": "sfx:s1", "prop": "volume", "points": [{"tMs": 0, "v": 100}, {"tMs": 500, "v": 0}]}]}
    e = volume_expr(edits, "sfx:s1", origin_s=1.0)
    assert e and sfx_env([e], 0).startswith(",volume='")
    assert sfx_env(None, 0) == "" and sfx_env([None], 0) == ""
    fc, out = build_audio_filter(length_s=3.0, volume=0.25, duck_depth=0.7, fade_in_s=0, fade_out_s=0, has_music=False,
                                 sfx_specs=[{"at_ms": 1000, "volume": 1.0}], music_input_index=1, sfx_volume_exprs=[e])
    vid = tmp_path / "v.mp4"
    _run("-f", "lavfi", "-i", "color=c=black:s=64x64:r=30:d=3", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
         "-t", "3", "-c:v", "libx264", "-c:a", "aac", str(vid))
    sfx = tmp_path / "s.wav"
    _run("-f", "lavfi", "-i", "sine=f=600:d=1.5:sample_rate=48000", str(sfx))
    mixed = tmp_path / "m.mp4"
    _run("-i", str(vid), "-i", str(sfx), "-filter_complex", fc, "-map", "0:v", "-map", out, "-c:v", "copy", "-c:a", "aac", str(mixed))

    def rms(t):
        s = subprocess.run(["ffmpeg", "-v", "info", "-ss", f"{t}", "-t", "0.15", "-i", str(mixed), "-vn", "-af", "volumedetect", "-f", "null", "-"],
                           capture_output=True, text=True).stderr
        return float(next(l for l in s.splitlines() if "mean_volume" in l).split("mean_volume:")[1].split("dB")[0])

    assert rms(1.05) > rms(1.35) + 6  # fading
    assert rms(1.8) < -60  # envelope at 0 after 500 ms local


@needs_ff
def test_blank_canvas(tmp_path: Path):
    from clips_worker.blank_project import blank_duration_ms, is_blank_job, make_blank_video

    assert blank_duration_ms(5) == 10_000 and blank_duration_ms(None) == 600_000 and blank_duration_ms(10**9) == 3_600_000
    assert is_blank_job({}, {"blank": True}) and is_blank_job({"blank": True}, {}) and not is_blank_job({}, {})
    p = tmp_path / "b.mp4"
    assert make_blank_video(p, "1:1", 10_000) == (720, 720)
    assert abs(_dur(p) - 10.0) < 0.1
    assert _rgb_at(p, 5.0) == (0, 0, 0) or max(_rgb_at(p, 5.0)) < 20
