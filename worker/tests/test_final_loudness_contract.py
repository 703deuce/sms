"""Measured final program must meet stored integrated LUFS and true-peak ceiling."""
import re
import shutil
import subprocess

import pytest
from clips_worker.final_loudness import finalize_audio, measure_ebu_r128


@pytest.mark.skipif(not shutil.which("ffmpeg"), reason="requires ffmpeg")
@pytest.mark.parametrize("with_bed", [False, True], ids=["speech_only", "music_bed"])
def test_real_aac_ebu_r128(tmp_path, with_bed):
    source = tmp_path / "source.mp4"
    cmd = [
        "ffmpeg", "-y", "-v", "error",
        "-f", "lavfi", "-i", "sine=frequency=310:sample_rate=48000:duration=6",
    ]
    if with_bed:
        cmd += ["-f", "lavfi", "-i", "sine=frequency=150:sample_rate=48000:duration=6"]
    cmd += ["-f", "lavfi", "-i", "color=c=black:s=320x180:r=25:d=6"]
    if with_bed:
        cmd += ["-filter_complex", "[0:a]volume=0.9[s];[1:a]volume=0.4[m];"
                "[s][m]amix=inputs=2:duration=first[a]", "-map", "2:v", "-map", "[a]"]
    else:
        cmd += ["-map", "1:v", "-map", "0:a"]
    cmd += ["-c:v", "libx264", "-c:a", "aac", "-shortest", str(source)]
    subprocess.run(cmd, check=True, capture_output=True)
    meta = {}
    output = finalize_audio(source, tmp_path, -15.0, meta)
    i, tp = measure_ebu_r128(output)
    assert abs(i + 15) <= 0.5
    assert tp <= -1.0
    assert meta["measured_lufs"] == i
    assert meta["measured_true_peak_dbtp"] == tp
    assert meta["loudness_verify_attempts"] <= 2


def test_measurement_requires_valid_video(tmp_path):
    with pytest.raises((subprocess.CalledProcessError, RuntimeError)):
        measure_ebu_r128(tmp_path / "missing.mp4")


def test_invalid_target_rejected(tmp_path):
    with pytest.raises(ValueError):
        finalize_audio(tmp_path / "missing.mp4", tmp_path, float("nan"), {})
