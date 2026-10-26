import subprocess
import tempfile
from pathlib import Path

from clips_worker.scan import build_candidate_windows, per_second_score, speech_seconds


def _synthetic_burst_video(path: Path, duration_s: int = 180) -> None:
    """testsrc2 + loudness bursts at 40s, 95s, 150s."""
    af = (
        "volume='if(between(t,39,46),12,"
        "if(between(t,94,101),12,"
        "if(between(t,149,156),12,0.02)))':eval=frame"
    )
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            f"testsrc2=duration={duration_s}:size=320x240:rate=30",
            "-af",
            af,
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            str(path),
        ],
    )


def test_candidate_windows_cover_injected_bursts():
    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        video = td_path / "burst.mp4"
        _synthetic_burst_video(video, 180)
        words: list[dict] = []
        cands = build_candidate_windows(video, words, td_path / "work")
        assert len(cands) >= 1
        peaks = [c.peak_s for c in cands]
        covered = 0
        for target in (40, 95, 150):
            if any(abs(p - target) <= 25 for p in peaks):
                covered += 1
        assert covered >= 2, f"expected bursts near 40/95/150, peaks={peaks}"


def test_per_second_score_adds_speech_bonus():
    scores = per_second_score(
        __import__("numpy").zeros(10),
        __import__("numpy").zeros(10),
        __import__("numpy").zeros(10),
        speech_seconds([{"s": 2.0, "e": 3.0, "w": "hello"}], 10),
    )
    assert scores[2] > scores[0]
