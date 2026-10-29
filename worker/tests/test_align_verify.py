import numpy as np
from pathlib import Path

from clips_worker.streamer.align import apply_segment_align_policy, verify_segment_offset


def _write_tone(path: Path, *, freq: float, dur_s: float, sr: int = 16000) -> None:
    import subprocess

    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-f",
            "lavfi",
            "-i",
            f"sine=f={freq}:d={dur_s}",
            "-ac",
            "1",
            "-ar",
            str(sr),
            str(path),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def test_verify_finds_shift(tmp_path):
    ref = tmp_path / "ref.opus"
    seg = tmp_path / "seg.opus"
    _write_tone(ref, freq=440, dur_s=8)
    _write_tone(seg, freq=440, dur_s=40)
    measured, conf, ratio = verify_segment_offset(
        seg,
        ref,
        expected_rel_s=10.0,
        clip_media_start_s=0.0,
        probe_s=2.0,
        search_s=15.0,
    )
    assert conf >= 0.3


def test_low_confidence_silence(monkeypatch, tmp_path):
    ref = tmp_path / "ref.opus"
    seg = tmp_path / "seg.opus"
    ref.touch()
    seg.touch()
    monkeypatch.setattr(
        "clips_worker.streamer.align.verify_segment_offset",
        lambda *a, **k: (0.0, 0.1, 1.0),
    )
    use_rel, applied = apply_segment_align_policy(
        seg_path=seg,
        window_audio=ref,
        expected_rel_s=0.0,
        clip_media_start_s=0.0,
        source_kind="test",
        clip_id="c1",
        vod_id="v1",
    )
    assert applied is False
    assert use_rel == 0.0
