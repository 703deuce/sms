"""FE-6: Compact Editor stems. The canvas carries picture + dialog, the music is separate, and both share one
gain so dialog + ducked music matches the house loudness of the master."""
import subprocess

import pytest

from clips_worker.motion_studio.core import audio as A
from clips_worker.motion_studio.pipeline.editor_stems import build_editor_stems


def _ff(*args):
    subprocess.run(["ffmpeg", "-v", "error", "-y", *args], check=True)


@pytest.fixture()
def media(tmp_path):
    d = tmp_path
    _ff("-f", "lavfi", "-i", "testsrc=size=320x180:rate=30", "-t", "4", "-pix_fmt", "yuv420p", str(d / "pic.mp4"))
    _ff("-f", "lavfi", "-i", "sine=f=220:d=4", "-ac", "2", "-ar", "48000", str(d / "vo.wav"))
    _ff("-f", "lavfi", "-i", "sine=f=440:d=4", "-ac", "2", "-ar", "48000", str(d / "mu.wav"))
    return d


def _streams(p):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type", "-of", "csv=p=0", p],
                         capture_output=True, text=True).stdout.split()
    return sorted(out)


def test_canvas_has_dialog_and_music_is_separate(media):
    logs = []
    r = build_editor_stems(str(media), 4.0, str(media / "pic.mp4"), str(media / "vo.wav"), str(media / "mu.wav"), None, [],
                           lambda *a: logs.append(a[0]))
    assert r and r["music"] and "editor_stems" in logs
    assert _streams(r["canvas"]) == ["audio", "video"]
    master = A.mix(str(media / "master.wav"), 4.0, str(media / "vo.wav"), str(media / "mu.wav"), None, [])
    dialog = A.loudness(r["canvas"])["I"]
    assert abs(dialog - master["I"]) < 2.0          # dialog dominates the ducked mix -> near the master level


def test_no_audio_still_gives_a_canvas(media):
    r = build_editor_stems(str(media), 4.0, str(media / "pic.mp4"), None, None, None, [], lambda *a: None)
    assert r and r["music"] is None and _streams(r["canvas"]) == ["audio", "video"]


def test_failure_returns_none(media):
    logs = []
    r = build_editor_stems(str(media), 4.0, str(media / "missing.mp4"), str(media / "vo.wav"), None, None, [],
                           lambda *a: logs.append(a[0]))
    assert r is None and logs == ["editor_stems_warning"]
