"""TC1: gap inserts (real ffmpeg; image = 5.1), deactivated items, under-pass cap, unlimited tracks.

Parity values live in tests/fixtures/tc1_parity.json (vitest tests/tc1-model.test.ts asserts the same).
"""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

from clips_worker.media_inserts import build_splice_graph, edits_insert_windows, insert_windows, normalize_inserts, splice_inserts
from clips_worker.timeline_lanes import apply_item_enable, apply_timeline_lane_state, disabled_item_keys
from clips_worker.tracks import MAX_UNDER_PASSES, MAX_VISUAL_TRACKS, cap_under_passes, normalize_tracks

FIX = json.loads((Path(__file__).parent / "fixtures" / "tc1_parity.json").read_text())
needs_ff = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg missing")


def _run(*args: str) -> None:
    subprocess.check_call(["ffmpeg", "-y", "-v", "error", *args])


def _dur(p: Path) -> float:
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)], text=True))


def _rgb_at(p: Path, t: float) -> tuple[int, int, int]:
    raw = subprocess.check_output(
        ["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", str(p), "-frames:v", "1", "-vf", "scale=1:1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    )
    return raw[0], raw[1], raw[2]


def _rms_db(p: Path, t0: float, t1: float) -> float:
    out = subprocess.run(
        ["ffmpeg", "-v", "info", "-ss", f"{t0:.3f}", "-t", f"{t1 - t0:.3f}", "-i", str(p), "-vn", "-af", "volumedetect", "-f", "null", "-"],
        capture_output=True, text=True,
    ).stderr
    line = next((ln for ln in out.splitlines() if "mean_volume" in ln), "mean_volume: -91 dB")
    return float(line.split("mean_volume:")[1].split("dB")[0])


# ---- parity -------------------------------------------------------------------------------

def test_gap_normalize_and_windows_parity():
    for c in FIX["gapNormalize"]:
        assert normalize_inserts(c["raw"], []) == c["out"]
    for c in FIX["gapWindows"]:
        assert insert_windows(c["segs"], c["inserts"]) == c["out"]


def test_disabled_items_parity_and_lane_state():
    for c in FIX["disabled"]:
        o = apply_item_enable(c["edits"])
        got = {
            "broll": [b["id"] for b in o["broll"]],
            "textItems": None if o["textItems"] is None else [t["id"] for t in o["textItems"]],
            "adjustLayers": None if o["adjustLayers"] is None else [x["id"] for x in o["adjustLayers"]],
            "sfx": [s["generationId"] for s in o["audio"]["sfx"]],
        }
        assert got == c["out"]
    # through the export choke point (render_job → apply_timeline_lane_state)
    e = {"disabledItems": ["broll:b1"], "broll": [{"id": "b1"}, {"id": "b2"}]}
    assert [b["id"] for b in apply_timeline_lane_state(e)["broll"]] == ["b2"]
    assert disabled_item_keys(["captions:1", "x", "sfx:a"]) == {"sfx:a"}
    assert apply_item_enable({"broll": [{"id": "b"}]}) == {"broll": [{"id": "b"}]}


def test_under_pass_cap_parity():
    for c in FIX["cap"]:
        assert cap_under_passes(c["passes"]) == c["out"]
    assert len(cap_under_passes(FIX["cap"][0]["passes"])) == MAX_UNDER_PASSES
    assert cap_under_passes([{"kind": "text", "trackId": "t", "ids": ["a"]}]) == [{"kind": "text", "trackId": "t", "ids": ["a"]}]


def test_unlimited_tracks():
    raw = [{"id": f"ov{i + 1}", "kind": "overlay"} for i in range(30)]
    t = normalize_tracks(raw)
    assert sum(1 for x in t if x["kind"] == "overlay") == 30
    assert MAX_VISUAL_TRACKS == 48


def test_gap_graph_uses_color_source_and_no_input():
    parts, _ = build_splice_graph(True, 180, 320, 30.0, 48000, [
        {"kind": "main", "t0": 0.0, "t1": 1.0},
        {"kind": "insert", "input": None, "still": False, "gap": True, "durS": 0.5, "audio": "mute", "fit": "cover", "hasAudio": False},
    ])
    g = ";".join(parts)
    assert "color=c=black:s=180x320:r=30" in g
    assert "anullsrc=r=48000:cl=stereo,atrim=duration=0.500000[a1]" in g
    assert "[None:" not in g


# ---- real ffmpeg --------------------------------------------------------------------------

@needs_ff
def test_gap_splice_black_and_silent(tmp_path: Path):
    main = tmp_path / "main.mp4"
    _run("-f", "lavfi", "-i", "color=c=red:s=180x320:r=30:d=4", "-f", "lavfi", "-i", "sine=f=440:d=4:sample_rate=48000",
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", str(main))
    edits = {"trim": {"in": 0, "out": 4000}, "inserts": [
        {"id": "g1", "sourceId": "gap", "atSrcMs": 1000, "durMs": 1500},
        {"id": "g2", "sourceId": "gap", "atSrcMs": 0, "append": True, "durMs": 1000},
    ]}
    assert [w.get("gap") for w in edits_insert_windows(edits)] == [True, True]
    out, _srt, added = splice_inserts(main, tmp_path, edits, {"keep_segs_src": [[0, 4000]]}, {}, "")
    assert added == 2500
    assert abs(_dur(out) - 6.5) < 0.2
    r, g, b = _rgb_at(out, 0.5)
    assert r > 150  # main (red) before the gap
    r, g, b = _rgb_at(out, 1.7)
    assert r < 30 and g < 30 and b < 30  # black gap
    r, g, b = _rgb_at(out, 3.0)
    assert r > 150  # main resumes
    r, g, b = _rgb_at(out, 6.2)
    assert r < 30 and g < 30 and b < 30  # appended gap
    assert _rms_db(out, 1.2, 2.3) < -60  # silence in the gap
    assert _rms_db(out, 2.8, 3.8) > -40  # tone after it


@needs_ff
def test_gap_before_media_insert_keeps_input_indices(tmp_path: Path):
    """A gap adds no -i: a later media insert must still read ITS input (not the main file)."""
    main = tmp_path / "main.mp4"
    clip = tmp_path / "blue.mp4"
    _run("-f", "lavfi", "-i", "color=c=red:s=180x320:r=30:d=4", "-f", "lavfi", "-i", "sine=f=440:d=4:sample_rate=48000",
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", str(main))
    _run("-f", "lavfi", "-i", "color=c=blue:s=180x320:r=30:d=3", "-c:v", "libx264", "-pix_fmt", "yuv420p", str(clip))
    edits = {
        "trim": {"in": 0, "out": 4000},
        "sources": [{"id": "u1", "ref": "upload", "refId": "u1", "mediaType": "video", "durationMs": 3000}],
        "inserts": [
            {"id": "g1", "sourceId": "gap", "atSrcMs": 1000, "durMs": 1000},
            {"id": "m1", "sourceId": "u1", "atSrcMs": 2000, "inMs": 0, "durMs": 1000, "audio": "mute"},
        ],
    }
    out, _srt, added = splice_inserts(main, tmp_path, edits, {"keep_segs_src": [[0, 4000]]}, {"u1": clip}, "")
    assert added == 2000
    assert abs(_dur(out) - 6.0) < 0.2
    r, g, b = _rgb_at(out, 1.5)
    assert r < 30 and b < 30  # gap
    r, g, b = _rgb_at(out, 3.5)  # media insert at src 2 s → display 3–4 s
    assert b > 150 and r < 80
