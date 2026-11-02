"""G1c1: track FX (NR / EQ / comp / limiter / LUFS), overlay-track color, split stereo (ffmpeg 5.1)."""
from __future__ import annotations

import array
import json
import shutil
import subprocess
from pathlib import Path

import pytest

from clips_worker.audio_render import apply_audio_mix, build_audio_filter
from clips_worker.timeline_lanes import apply_timeline_lane_state
from clips_worker.track_fx import (
    apply_track_color,
    apply_voice_fx,
    chain_str,
    lufs_gain_db,
    measure_lufs,
    mix_track_fx,
    normalize_track_fx,
    parse_loudnorm_json,
    post_chain,
    pre_chain,
)

FIX = Path(__file__).parent / "fixtures" / "g1c_parity.json"
needs_ff = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg missing")


def _run(*args: str) -> None:
    subprocess.check_call(["ffmpeg", "-y", "-v", "error", *args])


def _lufs(p: Path) -> float:
    v = measure_lufs(["-i", str(p)], "", "[0:a]")
    assert v is not None
    return v


def _freq_at(p: Path, t: float, ch: int = 0) -> float:
    raw = subprocess.check_output(
        ["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-t", "0.2", "-i", str(p), "-vn", "-af", f"pan=mono|c0=c{ch}", "-ar", "8000", "-f", "s16le", "-"]
    )
    a = array.array("h", raw)
    zc = sum(1 for i in range(1, len(a)) if (a[i - 1] < 0) != (a[i] < 0))
    return zc / 2 / (len(a) / 8000)


def _peak(p: Path) -> float:
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", str(p), "-vn", "-ac", "1", "-f", "s16le", "-"])
    a = array.array("h", raw)
    return max(abs(x) for x in a) / 32768.0


FULL = {
    "track": "voice",
    "nr": 12,
    "eq": {"hp": 80, "low": 2, "mid": -3, "midHz": 2500, "high": 4},
    "comp": {"threshold": -20, "ratio": 4, "attack": 10, "release": 150, "makeup": 2},
    "limit": -1,
    "lufs": -16,
}


def test_parity_fixture():
    d = json.loads(FIX.read_text())
    for c in d["fx_cases"]:
        assert normalize_track_fx(c["raw"]) == c["out"], c["raw"]
    for c in d["gain_cases"]:
        g = lufs_gain_db(c["measured"], c["target"])
        assert (g is None and c["gain"] is None) or g == pytest.approx(c["gain"])
    for c in d["color_cases"]:
        got = (apply_track_color(c["edits"]).get("color") or {}).get("broll") or {}
        assert got == c["color_broll"]
        # Through the shared derivation (render_job → apply_timeline_lane_state).
        assert ((apply_timeline_lane_state(c["edits"]).get("color") or {}).get("broll") or {}) == c["color_broll"]


def test_chain_strings():
    assert pre_chain(FULL) == [
        "afftdn=nr=12:nf=-50",
        "highpass=f=80:p=2:t=q:w=0.7071",
        "bass=g=2:f=120:t=s:w=1",
        "equalizer=f=2500:t=q:w=1:g=-3",
        "treble=g=4:f=8000:t=s:w=1",
        "acompressor=threshold=0.1:ratio=4:attack=10:release=150:makeup=1.2589:knee=1.9953:detection=peak:link=maximum",
    ]
    assert post_chain(FULL, 3.25) == ["volume=3.25dB", "alimiter=limit=0.89125:attack=5:release=50:level=0"]
    assert post_chain(FULL, None) == ["alimiter=limit=0.89125:attack=5:release=50:level=0"]
    assert chain_str({**FULL, "bypass": True}) == ""
    assert chain_str(None) == ""
    nr_mix = pre_chain({"track": "music", "nr": 18, "nrMix": 0.5})
    assert len(nr_mix) == 1 and "amix=inputs=2" in nr_mix[0] and "afftdn=nr=18" in nr_mix[0]
    # Floors: ffmpeg 5.1 option minimums.
    low = pre_chain({"track": "au1", "comp": {"threshold": -60, "ratio": 2, "attack": 1, "release": 50, "makeup": 0}})[0]
    assert "threshold=0.001:" in low  # −60 dB ≥ 5.1's 0.000977 floor
    assert "limit=0.0631:" in post_chain({"track": "au1", "limit": -24}, None)[0]  # ≥ 5.1's 0.0625 floor


def test_parse_loudnorm():
    assert parse_loudnorm_json('x\n{\n "input_i" : "-23.40",\n "input_tp" : "-1.0"\n}\n') == -23.4
    assert parse_loudnorm_json('{ "input_i" : "-inf" }') is None
    assert parse_loudnorm_json("nothing") is None


def test_no_track_fx_is_byte_identical():
    kw = dict(length_s=5, volume=0.5, duck_depth=0.5, fade_in_s=1, fade_out_s=1, has_music=True,
              sfx_specs=[{"at_ms": 100, "volume": 0.8}], sfx_trims=[(0, None)])
    assert build_audio_filter(**kw) == build_audio_filter(**kw, track_fx=None)
    assert build_audio_filter(**kw) == build_audio_filter(**kw, track_fx={"channels": [None], "buses": [None], "bus_fx": {}, "music": None})


@needs_ff
def test_every_filter_runs_on_ffmpeg(tmp_path):
    src = tmp_path / "a.wav"
    _run("-f", "lavfi", "-i", "sine=f=440:d=2:sample_rate=48000", "-af", "volume=0.5", str(src))
    out = tmp_path / "b.wav"
    _run("-i", str(src), "-af", ",".join(pre_chain(FULL) + post_chain(FULL, 4.0)), str(out))
    assert out.stat().st_size > 10000
    assert _peak(out) <= 0.9 + 0.02  # limiter ceiling −1 dBFS


@needs_ff
def test_measure_lufs_reference_sine(tmp_path):
    p = tmp_path / "s.wav"
    _run("-f", "lavfi", "-i", "aevalsrc=sin(2*PI*997*t):s=48000:d=4", str(p))
    # Full-scale 997 Hz mono sine = −3.01 LUFS (BS.1770; the web's integratedLufs asserts the same).
    assert _lufs(p) == pytest.approx(-3.01, abs=0.2)


@needs_ff
def test_voice_fx_hits_lufs_target(tmp_path):
    v = tmp_path / "v.mp4"
    _run("-f", "lavfi", "-i", "testsrc=s=160x90:d=4:r=10", "-f", "lavfi", "-i", "sine=f=300:d=4:sample_rate=48000",
         "-af", "volume=0.5", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", str(v))
    out = tmp_path / "o.mp4"
    assert apply_voice_fx(v, out, {"track": "voice", "eq": {"hp": 80}, "lufs": -16})
    assert _lufs(out) == pytest.approx(-16, abs=1.0)
    assert not apply_voice_fx(v, tmp_path / "x.mp4", {"track": "voice", "bypass": True, "nr": 12})


@needs_ff
def test_split_stereo_and_bus_fx(tmp_path):
    v = tmp_path / "v.mp4"
    _run("-f", "lavfi", "-i", "testsrc=s=160x90:d=3:r=10", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-t", "3", str(v))
    st = tmp_path / "st.wav"  # L = 440 Hz, R = 1200 Hz
    _run("-f", "lavfi", "-i", "sine=f=440:d=3:sample_rate=48000", "-f", "lavfi", "-i", "sine=f=1200:d=3:sample_rate=48000",
         "-filter_complex", "[0:a][1:a]join=inputs=2:channel_layout=stereo[a]", "-map", "[a]", str(st))
    edits = {
        "tracks": [{"id": "au1", "kind": "audio"}, {"id": "au2", "kind": "audio", "items": ["u~1"]}, {"id": "au3", "kind": "audio", "items": ["u~2"]}],
        "trackFx": [{"track": "au3", "eq": {"hp": 100}, "lufs": -20}],
    }
    sfx_paths = [(st, 0, 1.0), (st, 0, 1.0)]
    tfx = mix_track_fx(edits, sfx_paths=sfx_paths, sfx_ids=["u~1", "u~2"], sfx_trims=None, sfx_envs=None,
                       sfx_channels=["L", "R"], music_path=None, music_args=None)
    assert tfx["channels"] == ["L", "R"] and tfx["buses"] == ["au2", "au3"]
    assert set(tfx["bus_fx"]) == {"au3"} and "volume=" in tfx["bus_fx"]["au3"]
    # Left item only: 440 Hz mono everywhere.
    out_l = tmp_path / "l.mp4"
    tl = mix_track_fx(edits, sfx_paths=sfx_paths[:1], sfx_ids=["u~1"], sfx_trims=None, sfx_envs=None, sfx_channels=["L"], music_path=None, music_args=None)
    apply_audio_mix(v, out_l, None, sfx_paths[:1], length_s=3, volume=0, duck_depth=0, fade_in_s=0, fade_out_s=0, track_fx=tl)
    assert _freq_at(out_l, 1.0, 0) == pytest.approx(440, rel=0.05)
    assert _freq_at(out_l, 1.0, 1) == pytest.approx(440, rel=0.05)
    out_r = tmp_path / "r.mp4"
    tr = mix_track_fx(edits, sfx_paths=sfx_paths[:1], sfx_ids=["u~2"], sfx_trims=None, sfx_envs=None, sfx_channels=["R"], music_path=None, music_args=None)
    apply_audio_mix(v, out_r, None, sfx_paths[:1], length_s=3, volume=0, duck_depth=0, fade_in_s=0, fade_out_s=0, track_fx=tr)
    assert _freq_at(out_r, 1.0, 0) == pytest.approx(1200, rel=0.05)
    # Both, with the au3 bus (HP + LUFS gain) — the graph runs on 5.1.
    out_b = tmp_path / "b.mp4"
    apply_audio_mix(v, out_b, None, sfx_paths, length_s=3, volume=0, duck_depth=0, fade_in_s=0, fade_out_s=0, track_fx=tfx)
    assert out_b.stat().st_size > 1000


@needs_ff
def test_music_fx_chain_runs(tmp_path):
    v = tmp_path / "v.mp4"
    _run("-f", "lavfi", "-i", "testsrc=s=160x90:d=3:r=10", "-f", "lavfi", "-i", "sine=f=200:d=3:sample_rate=48000",
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", str(v))
    m = tmp_path / "m.wav"
    _run("-f", "lavfi", "-i", "sine=f=660:d=5:sample_rate=48000", str(m))
    edits = {"trackFx": [{"track": "music", "comp": {"threshold": -20, "ratio": 3, "attack": 10, "release": 150, "makeup": 0}, "lufs": -24, "limit": -3}]}
    tfx = mix_track_fx(edits, sfx_paths=[], sfx_ids=[], sfx_trims=None, sfx_envs=None, sfx_channels=None,
                       music_path=m, music_args=(3.0, 0.5, 0.5, 0.5, None, None))
    assert tfx["music"] and "acompressor=" in tfx["music"] and "alimiter=" in tfx["music"]
    fc, _ = build_audio_filter(length_s=3, volume=0.5, duck_depth=0.3, fade_in_s=0.5, fade_out_s=0.5, has_music=True, sfx_specs=[], track_fx=tfx)
    assert "[mv0]" in fc and fc.count("[mv]") == 2
    out = tmp_path / "o.mp4"
    apply_audio_mix(v, out, m, [], length_s=3, volume=0.5, duck_depth=0.3, fade_in_s=0.5, fade_out_s=0.5, track_fx=tfx)
    assert out.stat().st_size > 1000
