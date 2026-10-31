"""G1b: user tracks — parity fixture (shared with vitest), track state, layer order across types,
sectionOrder cap, and real-ffmpeg under-text passes (text on a track below an overlay track)."""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

from clips_worker.broll_render import apply_broll_overlays
from clips_worker.clip_keep_segments import SECTION_ORDER_MAX_BLOCKS
from clips_worker.edits_render import _apply_under_text_passes
from clips_worker.timeline_lanes import apply_timeline_lane_state
from clips_worker.tracks import apply_track_state, layer_order, normalize_tracks, under_passes, under_text_ids

FIX = Path(__file__).parent / "fixtures" / "g1b_tracks_parity.json"
W, H = 320, 240
ffmpeg = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not installed")


def run(cmd):
    subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def frame_rgb(video: Path, n: int) -> bytes:
    out = subprocess.run(["ffmpeg", "-v", "error", "-i", str(video), "-vf", f"select=eq(n\\,{n})", "-frames:v", "1",
                          "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
    assert len(out) == W * H * 3
    return out


def px(buf: bytes, u: float, v: float):
    x, y = min(W - 1, int(u * W)), min(H - 1, int(v * H))
    i = (y * W + x) * 3
    return buf[i], buf[i + 1], buf[i + 2]


def test_parity_fixture():
    fx = json.loads(FIX.read_text())
    for c in fx["normalize"]:
        assert normalize_tracks(c["raw"]) == c["out"], c["raw"]
    for c in fx["under"]:
        assert under_text_ids(c["edits"], c["overlayIds"]) == c["ids"]
        assert under_passes(c["edits"], c["overlayIds"]) == c["passes"]
    for c in fx["state"]:
        o = apply_timeline_lane_state(c["edits"])
        got = {"broll": [b["id"] for b in o.get("broll") or []], "text": [t["id"] for t in o.get("textItems") or []],
               "sfx": [x["generationId"] for x in (o.get("audio") or {}).get("sfx") or []]}
        assert got == c["out"]


def test_hidden_and_muted_tracks_drop_items_lane_flags_only_default():
    edits = {
        "tracks": [{"id": "ov1", "kind": "overlay"}, {"id": "ov2", "kind": "overlay", "items": ["b2"], "hidden": True},
                   {"id": "tx1", "kind": "text"}, {"id": "au1", "kind": "audio"}],
        "broll": [{"id": "b1", "startMs": 0, "endMs": 1000}, {"id": "b2", "startMs": 0, "endMs": 1000}],
        "timelineLanes": {"broll": {"hidden": True}},
    }
    assert [b["id"] for b in apply_track_state(edits)["broll"]] == ["b1"]
    assert apply_timeline_lane_state(edits).get("broll") in (None, [])


def test_layer_order_track_first_then_z():
    edits = {"tracks": [{"id": "ov1", "kind": "overlay"}, {"id": "tx1", "kind": "text"},
                        {"id": "ov2", "kind": "overlay", "items": ["a"]}]}
    items = [{"id": "a", "startMs": 0, "endMs": 100}, {"id": "b", "startMs": 10, "endMs": 100}, {"id": "c", "startMs": 20, "endMs": 100}]
    z = {"b": 5, "c": 0, "a": 0}
    assert [i["id"] for i in layer_order(edits, "overlay", items, lambda i: z[i])] == ["c", "b", "a"]


def test_section_order_cap_raised():
    assert SECTION_ORDER_MAX_BLOCKS == 64


def _solid(path: Path, color: str):
    run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"color=c={color}:s={W}x{H}:r=30:d=1",
         "-c:v", "libx264", "-crf", "10", "-pix_fmt", "yuv420p", str(path)])


@ffmpeg
def test_under_text_hidden_below_full_frame_overlay(tmp_path):
    base, blue = tmp_path / "base.mp4", tmp_path / "blue.mp4"
    _solid(base, "black")
    _solid(blue, "0x1E1EDC")
    text = {"id": "t1", "text": "MMMM", "startMs": 0, "endMs": 1000, "x": 50, "y": 50,
            "style": {"font": "Montserrat", "size": 160, "color": "#FFFFFF", "align": "center", "case": "none",
                      "box": {"color": "#FF0000", "opacity": 100, "pad": 40}}}
    specs = [{"local_path": blue, "start_s": 0.0, "end_s": 1.0, "duration_s": 1.0, "in_s": 0, "id": "b"}]
    # Text track tx1 BELOW the overlay track ov1 (array = bottom → top).
    edits = {"tracks": [{"id": "tx1", "kind": "text"}, {"id": "ov1", "kind": "overlay"}],
             "broll": [{"id": "b", "startMs": 0, "endMs": 1000}], "textItems": [text]}
    passes = under_passes(edits, ["b"])
    assert [p["kind"] for p in passes] == ["text", "overlay"]
    out = tmp_path / "under.mp4"
    burned = _apply_under_text_passes(base, out, passes, specs, edits, W, H, tmp_path)
    assert burned == ["t1"]
    c = px(frame_rgb(out, 15), 0.5, 0.5)
    assert c[2] > 150 and c[0] < 80  # blue covers the text

    # Default order: text on top → no passes (text burns later over the B-roll).
    assert under_passes({**edits, "tracks": None}, ["b"]) == []
    out2 = tmp_path / "plain.mp4"
    apply_broll_overlays(base, out2, specs, W, H, edits=edits)
    assert px(frame_rgb(out2, 15), 0.5, 0.5)[2] > 150
