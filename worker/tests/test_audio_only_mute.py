from pathlib import Path
import shutil
import subprocess

import pytest

from clips_worker.audio_only_mute import (
    source_mutes_to_output,
    mute_volume_expression,
    apply_audio_only_mutes,
)


def test_audio_only_mutes_map_source_ranges_through_ripple_edl():
    edits = {
        "trim": {"in": 1000, "out": 5000},
        "cutRanges": [[2000, 2500]],
        "audioMuteRanges": [[1400, 1600], [2600, 2750], [2200, 2300]],
    }
    # 2200-2300 was removed by a real ripple cut; no mute should be created.
    assert source_mutes_to_output(edits) == [(400, 600), (1100, 1250)]


def test_audio_only_ranges_repeat_for_reordered_duplicate_source_blocks():
    edits = {
        "trim": {"in": 0, "out": 3000},
        "cutRanges": [],
        "sectionOrder": [[2000, 3000], [0, 2000]],
        "audioMuteRanges": [[2500, 2700]],
    }
    # The reversed section is at output beginning.
    assert source_mutes_to_output(edits) == [(500, 700)]


def test_audio_only_filter_uses_soft_edges_and_unity_gain_outside():
    expr = mute_volume_expression([(500, 750)])
    assert "0.500000" in expr and "0.750000" in expr
    assert "min(max" in expr
    assert mute_volume_expression([]) == "1"


@pytest.mark.skipif(not shutil.which("ffmpeg") or not shutil.which("ffprobe"), reason="FFmpeg absent")
def test_audio_only_mute_preserves_video_duration_and_silences_audio(tmp_path: Path):
    source = tmp_path / "input.mp4"
    out = tmp_path / "output.mp4"
    subprocess.check_call([
        "ffmpeg", "-v", "error", "-y",
        "-f", "lavfi", "-i", "color=c=black:size=160x90:rate=25:duration=2",
        "-f", "lavfi", "-i", "sine=frequency=440:duration=2:sample_rate=48000",
        "-shortest", "-c:v", "mpeg4", "-c:a", "aac", str(source),
    ])
    edits = {
        "trim": {"in": 0, "out": 2000},
        "cutRanges": [],
        "audioMuteRanges": [[600, 1200]],
    }
    assert apply_audio_only_mutes(source, out, edits) is True
    def duration(p: Path) -> float:
        return float(subprocess.check_output([
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", str(p)
        ]).decode().strip())
    assert abs(duration(source) - duration(out)) < 0.08

    # FFmpeg volumedetect on a quiet middle window vs unmuted beginning.
    def rms(p: Path, start: float, dur: float) -> float:
        data = subprocess.check_output([
            "ffmpeg", "-v", "error", "-ss", str(start), "-t", str(dur),
            "-i", str(p), "-vn", "-f", "f32le", "-ac", "1",
            "-ar", "48000", "-"
        ])
        import array
        import math
        samples = array.array("f")
        samples.frombytes(data)
        return math.sqrt(sum(x*x for x in samples) / max(1, len(samples)))
    assert rms(out, 0.75, 0.25) < rms(source, 0.75, 0.25) * 0.05
    assert rms(out, 0.10, 0.20) > rms(source, 0.10, 0.20) * 0.75
