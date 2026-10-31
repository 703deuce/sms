"""G1c2: takes (render filter) + track motion bake (parity) + a real 5.1 render of the baked motion."""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

from clips_worker.broll_render import apply_broll_overlays
from clips_worker.edits_render import is_default_edits
from clips_worker.takes import inactive_broll_take_ids
from clips_worker.timeline_lanes import apply_timeline_lane_state
from clips_worker.track_motion import apply_track_motion, normalize_track_motion
from clips_worker.track_render import apply_track_render

FIX = Path(__file__).parent / "fixtures" / "g1c2_parity.json"
needs_ff = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg missing")
W, H = 320, 240
RED, BLUE = (220, 30, 30), (30, 30, 220)


def _sort(kf):
    return sorted([k for k in kf or [] if k["target"].startswith("broll:")], key=lambda k: k["target"] + k["prop"])


def test_parity_takes():
    for c in json.loads(FIX.read_text())["take_cases"]:
        assert sorted(inactive_broll_take_ids(c["edits"])) == c["inactive"]
        assert [b["id"] for b in apply_track_render(c["edits"])["broll"]] == c["rendered"]


def test_parity_track_motion():
    for c in json.loads(FIX.read_text())["motion_cases"]:
        out = apply_track_render(c["edits"])
        assert _sort(out.get("keyframes")) == c["baked"]
        assert ("trackMotion" in out) == c["has_track_motion_after"]
        # Through render_job's derivation, and idempotent (timeline_render_spec derives again).
        once = apply_timeline_lane_state(c["edits"])
        assert _sort(once.get("keyframes")) == c["baked"]
        assert _sort(apply_timeline_lane_state(once).get("keyframes")) == c["baked"]


def test_normalize_and_default():
    assert normalize_track_motion([{"track": "tx1", "keys": [{"prop": "x", "value": 5}]}]) == []
    assert normalize_track_motion([{"track": "ov2", "keys": [{"prop": "rotation", "value": 5}, {"prop": "x", "value": 500}]}]) == [
        {"track": "ov2", "keys": [{"prop": "x", "value": 100, "points": []}]}]
    from clips_worker.edits_render import default_edits

    d = default_edits(0, 1000)
    assert is_default_edits(d, 0, 1000)
    assert not is_default_edits({**d, "trackMotion": [{"track": "ov1"}]}, 0, 1000)
    assert not is_default_edits({**d, "takes": [{"id": "t"}]}, 0, 1000)
    assert not is_default_edits({**d, "trackFx": [{"track": "voice", "nr": 12}]}, 0, 1000)


def _run(*a):
    subprocess.check_call(["ffmpeg", "-y", "-v", "error", *a])


def _hex(c):
    return "0x%02X%02X%02X" % c


def _frame(video: Path, n: int) -> bytes:
    return subprocess.run(["ffmpeg", "-v", "error", "-i", str(video), "-vf", f"select=eq(n\\,{n})", "-frames:v", "1",
                           "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout


def _px(buf: bytes, u: float, v: float):
    x, y = min(W - 1, int(u * W)), min(H - 1, int(v * H))
    i = (y * W + x) * 3
    return buf[i], buf[i + 1], buf[i + 2]


def _close(a, b, tol=20):
    return max(abs(x - y) for x, y in zip(a, b)) <= tol


@needs_ff
@pytest.mark.parametrize("preset,inside,outside", [
    ({"x": 25, "cropL": 25, "cropR": 25}, [(0.6, 0.5), (0.9, 0.2)], [(0.4, 0.5), (0.1, 0.8)]),
    ({"x": 32, "y": 32, "scale": 30}, [(0.82, 0.82)], [(0.5, 0.5), (0.6, 0.6), (0.2, 0.2)]),
])
def test_track_motion_renders_on_ffmpeg(tmp_path, preset, inside, outside):
    base = tmp_path / "base.mp4"
    _run("-f", "lavfi", "-i", f"color=c={_hex(RED)}:s={W}x{H}:r=30:d=2", "-f", "lavfi", "-i", "sine=f=440:d=2",
         "-c:v", "libx264", "-crf", "10", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", str(base))
    blue = tmp_path / "b.mp4"
    _run("-f", "lavfi", "-i", f"color=c={_hex(BLUE)}:s={W}x{H}:r=30:d=3", "-c:v", "libx264", "-crf", "10", "-pix_fmt", "yuv420p", str(blue))
    edits = {
        "tracks": [{"id": "ov1", "kind": "overlay"}, {"id": "ov2", "kind": "overlay", "items": ["b"]}],
        "broll": [{"id": "b", "source": "stock", "assetId": "x", "startMs": 0, "endMs": 2000}],
        "trackMotion": [{"track": "ov2", "keys": [{"prop": k, "value": v} for k, v in preset.items()]}],
    }
    eff = apply_track_motion(edits)
    specs = [{"local_path": blue, "start_s": 0.0, "end_s": 2.0, "duration_s": 2.0, "in_s": 0, "id": "b"}]
    out = tmp_path / "o.mp4"
    apply_broll_overlays(base, out, specs, W, H, edits=eff)
    buf = _frame(out, 30)
    for u, v in inside:
        assert _close(_px(buf, u, v), BLUE), (u, v, _px(buf, u, v))
    for u, v in outside:
        assert _close(_px(buf, u, v), RED), (u, v, _px(buf, u, v))
