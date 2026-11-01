"""AU-11/12/31 pan, de-ess, vfx + §8 #19 + AU-33 measurement tests."""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from clips_worker.audio_assets import load_audio_assets
from clips_worker.audio_render import apply_audio_mix, build_audio_filter, measure_segment_rms_db, pan_filter
from clips_worker.track_fx import chain_str, normalize_track_fx

FIX = Path(__file__).parent / "fixtures" / "g1c_parity.json"
needs_ff = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg missing")

MIX_KW = dict(
    length_s=5,
    volume=0.5,
    duck_depth=0.5,
    fade_in_s=1,
    fade_out_s=1,
    has_music=True,
    sfx_specs=[{"at_ms": 100, "volume": 0.8}],
    sfx_trims=[(0, None)],
)
MIX_BASELINE = (
    "[0:a]asplit=2[sp][sc];[1:a]volume=0.5000,afade=t=in:d=1.000,afade=t=out:st=4.000:d=1.000,atrim=0:5.000,asetpts=PTS-STARTPTS[mv];"
    "[mv][sc]sidechaincompress=threshold=0.0316:ratio=4.500:attack=20:release=300:makeup=1[md];"
    "[2:a]adelay=100|100,volume=0.8000[s0];"
    "[sp][md][s0]amix=inputs=3:duration=first:normalize=0,alimiter=limit=0.95[aout]"
)


def test_pan_filter():
    assert pan_filter(0, 2) == ""
    assert pan_filter(-40, 1) == ",pan=stereo|c0=1*c0|c1=0.6*c0"
    assert pan_filter(50, 2) == ",pan=stereo|c0=0.5*c0|c1=1*c1"


def test_build_audio_filter_unchanged_without_pan():
    fc, _ = build_audio_filter(**MIX_KW)
    assert fc == MIX_BASELINE


def test_chain_str_new_cases():
    d = json.loads(FIX.read_text())
    for c in d.get("chain_cases", []):
        assert chain_str(c["fx"], c.get("lufs_gain")) == c["chain"]


def test_normalize_new_fx_cases():
    d = json.loads(FIX.read_text())
    start = d.get("chain_cases_start_index", len(d["fx_cases"]))
    for c in d["fx_cases"][start:]:
        assert normalize_track_fx(c["raw"]) == c["out"], c["raw"]


def test_load_audio_assets_skips_no_stream(tmp_path, monkeypatch):
    up = tmp_path / "silent.mp4"
    up.write_bytes(b"x")
    media = {"up1": up, "up2": tmp_path / "ok.wav"}
    (tmp_path / "ok.wav").write_bytes(b"RIFF")
    calls = []

    def fake_has(path):
        calls.append(str(path))
        return path != up

    monkeypatch.setattr("clips_worker.audio_assets.has_audio_stream", fake_has)
    conn = MagicMock()
    conn.cursor.return_value.__enter__.return_value.fetchone.return_value = None
    edits = {
        "audio": {
            "music": {"generationId": "m", "uploadId": "up1"},
            "sfx": [{"generationId": "s1", "uploadId": "up1", "atMs": 0}, {"generationId": "s2", "uploadId": "up2", "atMs": 100}],
        }
    }
    out = load_audio_assets(conn, edits, tmp_path, media={"up1": up, "up2": media["up2"]})
    assert out["music_path"] is None
    assert len(out["sfx_paths"]) == 1


@needs_ff
def test_vfx_and_deess_filters_run(tmp_path):
    src = tmp_path / "a.wav"
    subprocess.check_call(
        ["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "sine=f=440:d=2:sample_rate=48000", str(src)]
    )
    for fx in (
        {"track": "voice", "deess": 60},
        {"track": "voice", "vfx": {"type": "echo", "amount": 50}},
        {"track": "voice", "vfx": {"type": "reverb", "amount": 100}},
        {"track": "voice", "vfx": {"type": "robot", "amount": 50}},
        {"track": "voice", "vfx": {"type": "telephone"}},
    ):
        chain = chain_str(fx, None)
        out = tmp_path / f"o_{fx.get('vfx', {}).get('type', 'deess')}.wav"
        subprocess.check_call(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-af", chain or "anull", "-shortest", str(out)])
        assert out.stat().st_size > 1000


@needs_ff
def test_pan_hard_left(tmp_path):
    st = tmp_path / "st.wav"
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            "sine=f=440:d=2:sample_rate=48000",
            "-f",
            "lavfi",
            "-i",
            "sine=f=440:d=2:sample_rate=48000",
            "-filter_complex",
            "[0:a][1:a]join=inputs=2:channel_layout=stereo[a]",
            "-map",
            "[a]",
            str(st),
        ]
    )
    out = tmp_path / "pan.wav"
    pf = pan_filter(-100, 2).lstrip(",")
    subprocess.check_call(["ffmpeg", "-y", "-v", "error", "-i", str(st), "-af", pf, str(out)])
    rms_r = subprocess.check_output(
        [
            "ffmpeg",
            "-hide_banner",
            "-nostats",
            "-i",
            str(out),
            "-af",
            "pan=mono|c0=c1,astats=metadata=1:reset=1",
            "-f",
            "null",
            "-",
        ],
        text=True,
        stderr=subprocess.STDOUT,
    )
    val = next(float(line.split("RMS level dB:")[-1].strip()) for line in rms_r.splitlines() if "RMS level dB:" in line)
    assert val < -60


@needs_ff
def test_apply_voice_fx_pan_hard_left(tmp_path):
    from clips_worker.track_fx import apply_voice_fx

    st = tmp_path / "st.wav"
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            "sine=f=440:d=2:sample_rate=48000",
            "-f",
            "lavfi",
            "-i",
            "sine=f=440:d=2:sample_rate=48000",
            "-filter_complex",
            "[0:a][1:a]join=inputs=2:channel_layout=stereo[a]",
            "-map",
            "[a]",
            str(st),
        ],
    )
    vid = tmp_path / "v.mp4"
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            "testsrc=s=160x90:d=2:r=10",
            "-i",
            str(st),
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-shortest",
            str(vid),
        ],
    )
    out = tmp_path / "panned.mp4"
    assert apply_voice_fx(vid, out, {"track": "voice", "pan": -100})
    rms_l = subprocess.check_output(
        [
            "ffmpeg",
            "-hide_banner",
            "-nostats",
            "-i",
            str(out),
            "-af",
            "pan=mono|c0=c0,astats=metadata=1:reset=1",
            "-f",
            "null",
            "-",
        ],
        text=True,
        stderr=subprocess.STDOUT,
    )
    rms_r = subprocess.check_output(
        [
            "ffmpeg",
            "-hide_banner",
            "-nostats",
            "-i",
            str(out),
            "-af",
            "pan=mono|c0=c1,astats=metadata=1:reset=1",
            "-f",
            "null",
            "-",
        ],
        text=True,
        stderr=subprocess.STDOUT,
    )
    fl = next(float(line.split("RMS level dB:")[-1].strip()) for line in rms_l.splitlines() if "RMS level dB:" in line)
    fr = next(float(line.split("RMS level dB:")[-1].strip()) for line in rms_r.splitlines() if "RMS level dB:" in line)
    assert fl > fr + 6


def test_apply_voice_fx_pan_only_af_chain(monkeypatch, tmp_path):
    from clips_worker import track_fx

    captured: list[list[str]] = []

    def fake_check_call(cmd, *args, **kwargs):
        captured.append(cmd)

    monkeypatch.setattr(subprocess, "check_call", fake_check_call)
    monkeypatch.setattr(track_fx, "probe_audio_channels", lambda _p: 2, raising=False)
    monkeypatch.setattr(
        "clips_worker.audio_render.probe_audio_channels",
        lambda _p: 2,
    )
    vid = tmp_path / "v.mp4"
    vid.write_bytes(b"\x00")
    out = tmp_path / "o.mp4"
    assert track_fx.apply_voice_fx(vid, out, {"track": "voice", "pan": -100})
    af = captured[0][captured[0].index("-af") + 1]
    assert not af.startswith(",")
    assert af.startswith("pan=stereo")


@needs_ff
def test_au33_mix_levels(tmp_path):
    v = tmp_path / "v.mp4"
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            "testsrc=s=160x90:d=5:r=10",
            "-f",
            "lavfi",
            "-i",
            "anullsrc=r=48000:cl=mono",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-t",
            "5",
            str(v),
        ]
    )
    m = tmp_path / "m.wav"
    subprocess.check_call(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "sine=f=220:d=5:sample_rate=48000", str(m)])
    out = tmp_path / "mix.mp4"
    apply_audio_mix(
        v,
        out,
        m,
        [],
        length_s=5,
        volume=0.5,
        duck_depth=0.0,
        fade_in_s=1,
        fade_out_s=1,
        sfx_fx=None,
        music_loop=False,
    )
    early = measure_segment_rms_db(out, 0.0, 0.1)
    mid = measure_segment_rms_db(out, 1.5, 2.0)
    assert early <= mid - 15
    peak = measure_segment_rms_db(out, 2.0, 4.8)
    assert peak <= -0.4
