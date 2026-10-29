import json
import subprocess
from pathlib import Path

import pytest

from clips_worker.audio_render import align_isolated_to_segments, apply_studio_sound_mix_aligned
from clips_worker.loop_friendly_trim import apply_loop_friendly_trim
from clips_worker.preview_edits_match import preview_export_matches
from clips_worker.edits_render import default_edits


def _make_tone_mp3(path: Path, *, duration_s: float = 3.0, freq: float = 440.0) -> None:
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            f"sine=frequency={freq}:duration={duration_s:.3f}",
            "-q:a",
            "2",
            str(path),
        ],
        stdout=subprocess.DEVNULL,
    )


def _make_silent_mp4(path: Path, *, duration_s: float = 2.0) -> None:
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            f"color=c=black:s=320x240:d={duration_s:.3f}",
            "-f",
            "lavfi",
            "-i",
            f"anullsrc=r=44100:cl=mono:d={duration_s:.3f}",
            "-shortest",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            str(path),
        ],
        stdout=subprocess.DEVNULL,
    )


@pytest.mark.skipif(
    subprocess.call(["ffmpeg", "-version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) != 0,
    reason="ffmpeg required",
)
def test_align_isolated_to_segments_concat(tmp_path: Path) -> None:
    iso = tmp_path / "iso.mp3"
    _make_tone_mp3(iso, duration_s=4.0)
    out = tmp_path / "aligned.mp3"
    ok = align_isolated_to_segments(iso, out, [(0.5, 1.0), (2.0, 2.6)], track_start_sec=0.0)
    assert ok
    assert out.stat().st_size > 1000


def test_preview_export_blocked_when_studio_sound_enabled():
    edits = default_edits(0, 60_000)
    edits = {
        **edits,
        "audio": {"studioSound": {"enabled": True, "generationId": "gen_x", "mix": 0.35}},
    }
    assert not preview_export_matches(edits, 0, 60_000)


def test_loop_trim_fixture_cases():
    fixture = Path(__file__).resolve().parent / "fixtures/loop_trim_cases.json"
    cases = json.loads(fixture.read_text())
    for case in cases:
        edits = case["edits"]
        words = case["words"]
        out = apply_loop_friendly_trim(edits, words, export_platform=case.get("exportPlatform"))
        tout = out["trim"]["out"]
        if "expectOutLt" in case:
            assert tout < case["expectOutLt"], case["name"]
        if "expectOutEq" in case:
            assert tout == case["expectOutEq"], case["name"]


@pytest.mark.skipif(
    subprocess.call(["ffmpeg", "-version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) != 0,
    reason="ffmpeg required",
)
def test_apply_studio_sound_mix_aligned_runs(tmp_path: Path) -> None:
    video = tmp_path / "v.mp4"
    iso = tmp_path / "iso.mp3"
    out = tmp_path / "out.mp4"
    _make_silent_mp4(video, duration_s=2.0)
    _make_tone_mp3(iso, duration_s=2.0)
    apply_studio_sound_mix_aligned(
        video,
        iso,
        out,
        0.35,
        [(0.0, 2.0)],
        track_start_sec=0.0,
        work_dir=tmp_path,
    )
    assert out.is_file()
    assert out.stat().st_size > 500
