"""G1a: crop (static + keyframed), flip and stacking order — math, parity fixture, ffmpeg pixels.

Renders with the first `ffmpeg` on PATH. Prod is ffmpeg 5.1 (drawbox commands + replace exist
there since 4.3); also run with a 5.1 build: PATH=/path/to/ffmpeg-5.1:$PATH python -m pytest tests/test_g1a_layer_fx.py
"""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

from clips_worker.broll_render import apply_broll_overlays, build_broll_filtergraph
from clips_worker.motion import (
    has_layer_fx,
    layer_crop_at,
    layer_flip,
    layer_motion_chain,
    layer_sendcmd,
    layer_z,
    normalize_keyframes,
    normalize_layer_props,
    stack_order,
)
from clips_worker.motion_render import apply_main_keyframes
from clips_worker.text_items import text_items_ass

FIX = Path(__file__).parent / "fixtures" / "g1a_layer_parity.json"
W, H = 320, 240
RED, BLUE, GREEN, BLACK = (220, 30, 30), (30, 30, 220), (30, 200, 60), (0, 0, 0)
TOL = 20
ffmpeg = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not installed")


def run(cmd):
    subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def hexc(c):
    return "0x%02X%02X%02X" % c


def frame_rgb(video: Path, n: int) -> bytes:
    out = subprocess.run(["ffmpeg", "-v", "error", "-i", str(video), "-vf", f"select=eq(n\\,{n})", "-frames:v", "1",
                          "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
    assert len(out) == W * H * 3
    return out


def px(buf: bytes, u: float, v: float):
    x, y = min(W - 1, int(u * W)), min(H - 1, int(v * H))
    i = (y * W + x) * 3
    return buf[i], buf[i + 1], buf[i + 2]


def close(a, b, tol=TOL):
    return max(abs(x - y) for x, y in zip(a, b)) <= tol


def split_lr(path: Path, left, right, dur=2.0):
    """Left half `left`, right half `right` (tells a flip from no flip)."""
    fc = (f"color=c={hexc(left)}:s={W}x{H}:r=30:d={dur},"
          f"drawbox=x={W // 2}:y=0:w={W // 2}:h={H}:color={hexc(right)}:t=fill,format=yuv420p[v]")
    run(["ffmpeg", "-y", "-v", "error", "-filter_complex", fc, "-f", "lavfi", "-i", f"sine=f=440:d={dur}",
         "-map", "[v]", "-map", "0:a", "-c:v", "libx264", "-crf", "10", "-c:a", "aac", "-shortest", str(path)])


# ---------------------------------------------------------------------------
# Math + shared fixture (asserted by vitest too: tests/g1a-layer-props.test.ts)
# ---------------------------------------------------------------------------

def test_parity_fixture():
    fx = json.loads(FIX.read_text())
    for case in fx["crop"]:
        got = layer_crop_at(case["edits"], case["target"], case["tMs"])
        assert {k: round(v, 4) for k, v in got.items()} == case["expect"], case["name"]
    for case in fx["layerProps"]:
        assert normalize_layer_props(case["raw"]) == case["expect"], case["name"]
    for case in fx["stack"]:
        z = {k: v for k, v in case["z"].items()}
        got = [it["id"] for it in stack_order(case["items"], lambda i: z.get(i, 0))]
        assert got == case["expect"], case["name"]


def test_crop_props_only_on_media_layers():
    raw = [{"target": t, "prop": "cropL", "value": 20, "points": []} for t in ("video", "broll:a", "text:t", "text", "voice")]
    assert [k["target"] for k in normalize_keyframes(raw)] == ["video", "broll:a"]


def test_has_layer_fx_counts_flip_and_crop():
    assert not has_layer_fx({}, "video")
    assert has_layer_fx({"layerProps": [{"target": "video", "flipH": True}]}, "video")
    assert has_layer_fx({"keyframes": [{"target": "video", "prop": "cropT", "value": 10, "points": []}]}, "video")
    assert layer_flip({"layerProps": [{"target": "text:a", "flipH": True}]}, "text:a") == (False, False)
    assert layer_z({"layerProps": [{"target": "text:a", "z": 2}]}, "text:a") == 2


def test_chain_order_crop_flip_rotate_scale():
    edits = {"keyframes": [{"target": "video", "prop": "cropL", "value": 25, "points": []},
                           {"target": "video", "prop": "rotation", "value": 10, "points": []}],
             "layerProps": [{"target": "video", "flipH": True}]}
    g, tags = layer_motion_chain(edits, "video", w=W, h=H, origin_s=0, label_in="s", label_out="k", bg_label="bg",
                                 cmd_file=None)
    assert tags == []
    i_crop, i_flip, i_rot = g.index("crop="), g.index("hflip"), g.index("rotate=")
    assert i_crop < i_flip < i_rot
    assert "pad=320:240:80:0:color=black@0" in g


def test_sendcmd_merges_opacity_and_crop():
    edits = {"keyframes": [
        {"target": "video", "prop": "cropB", "points": [{"tMs": 0, "v": 0}, {"tMs": 1000, "v": 50}]},
        {"target": "video", "prop": "opacity", "points": [{"tMs": 0, "v": 100}, {"tMs": 1000, "v": 50}]}]}
    g, tags = layer_motion_chain(edits, "video", w=W, h=H, origin_s=0, label_in="s", label_out="k", bg_label="bg",
                                 cmd_file="/tmp/x.cmd")
    assert g.count("sendcmd=") == 1 and tags == ["crop_k", "ccm_k"]
    assert "alphamerge" in g and "eval=frame" in g
    txt = layer_sendcmd(edits, "video", tags, w=W, h=H, start_s=0, end_s=1, origin_s=0)
    lines = txt.strip().splitlines()
    assert lines[0].startswith("0.0000 ") and "colorchannelmixer@ccm_k aa 1.0" in lines[0]
    assert "drawbox@crop_k_b" in txt
    assert "colorchannelmixer@ccm_k aa 0.5" in lines[-1]


def test_text_items_z_order_layers():
    items = [{"id": "a", "text": "A", "startMs": 0, "endMs": 1000, "style": {"box": {"color": "#000000"}}},
             {"id": "b", "text": "B", "startMs": 0, "endMs": 1000, "style": {}}]
    base = text_items_ass({"textItems": items}, w=W, h=H)
    assert base is not None and "Dialogue: 1,0:00:00.00,0:00:01.00,T0" in base
    # z = 1 on a → b first (layer 1), a on top (box 2, text 3).
    ass = text_items_ass({"textItems": items, "layerProps": [{"target": "text:a", "z": 1}]}, w=W, h=H)
    ev = [ln for ln in ass.splitlines() if ln.startswith("Dialogue:")]
    assert ev[0].startswith("Dialogue: 1,") and ev[0].endswith("B")
    assert ev[1].startswith("Dialogue: 3,") and ev[2].startswith("Dialogue: 2,")


def test_broll_stack_order_overlapping_only():
    specs = [{"local_path": "/x/a.mp4", "start_s": 0.0, "end_s": 2.0, "duration_s": 2.0, "id": "a"},
             {"local_path": "/x/b.mp4", "start_s": 1.0, "end_s": 3.0, "duration_s": 2.0, "id": "b"},
             {"local_path": "/x/c.mp4", "start_s": 3.0, "end_s": 4.0, "duration_s": 1.0, "id": "c"}]
    edits = {"layerProps": [{"target": "broll:a", "z": 1}, {"target": "broll:c", "z": -5}]}
    _, inputs, _ = build_broll_filtergraph(specs, W, H, edits=edits, cmd_dir=Path("/tmp"))
    paths = [inputs[i + 3] for i in range(0, len(inputs), 4)]
    assert paths == ["/x/b.mp4", "/x/a.mp4", "/x/c.mp4"]  # c stays after: it does not overlap


# ---------------------------------------------------------------------------
# Real frames
# ---------------------------------------------------------------------------

@ffmpeg
def test_main_static_crop_and_flip_pixels(tmp_path):
    src = tmp_path / "src.mp4"
    split_lr(src, RED, BLUE)
    out = tmp_path / "out.mp4"
    edits = {"keyframes": [{"target": "video", "prop": "cropL", "value": 25, "points": []},
                           {"target": "video", "prop": "cropT", "value": 50, "points": []}],
             "layerProps": [{"target": "video", "flipH": True}]}
    assert apply_main_keyframes(src, out, edits, tmp_path)
    f = frame_rgb(out, 10)
    # Media: left 25 % (red) and top half removed; flipped → the removed strip is on the right.
    assert close(px(f, 0.5, 0.1), BLACK)          # top half cropped
    assert close(px(f, 0.9, 0.8), BLACK)          # media left strip, mirrored to the right
    assert close(px(f, 0.6, 0.8), RED)            # rest of the red half (mirrored)
    assert close(px(f, 0.2, 0.8), BLUE)           # blue half now on the left


@ffmpeg
def test_main_keyframed_crop_pixels(tmp_path):
    src = tmp_path / "src.mp4"
    split_lr(src, RED, RED)
    out = tmp_path / "out.mp4"
    edits = {"keyframes": [{"target": "video", "prop": "cropR", "points": [{"tMs": 0, "v": 0}, {"tMs": 1000, "v": 80}]}]}
    assert apply_main_keyframes(src, out, edits, tmp_path)
    assert close(px(frame_rgb(out, 0), 0.95, 0.5), RED)
    mid = frame_rgb(out, 15)  # 0.5 s → 40 % cropped from the right
    assert close(px(mid, 0.55, 0.5), RED) and close(px(mid, 0.65, 0.5), BLACK)
    end = frame_rgb(out, 45)  # held at 80 %
    assert close(px(end, 0.15, 0.5), RED) and close(px(end, 0.25, 0.5), BLACK)


@ffmpeg
def test_broll_crop_flip_and_order_pixels(tmp_path):
    base = tmp_path / "base.mp4"
    run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"color=c={hexc(BLACK)}:s={W}x{H}:r=30:d=2",
         "-f", "lavfi", "-i", "sine=f=440:d=2", "-c:v", "libx264", "-crf", "10", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-shortest", str(base)])
    g, b = tmp_path / "g.mp4", tmp_path / "b.mp4"
    split_lr(g, GREEN, RED, 3)
    split_lr(b, BLUE, BLUE, 3)
    specs = [{"local_path": g, "start_s": 0.0, "end_s": 2.0, "duration_s": 2.0, "in_s": 0, "id": "g"},
             {"local_path": b, "start_s": 0.5, "end_s": 2.0, "duration_s": 1.5, "in_s": 0, "id": "b"}]
    edits = {
        "broll": [{"id": "g", "startMs": 0, "endMs": 2000}, {"id": "b", "startMs": 500, "endMs": 2000}],
        "keyframes": [{"target": "broll:b", "prop": "cropR", "value": 50, "points": []}],
        "layerProps": [{"target": "broll:g", "flipH": True, "z": 1}],
    }
    out = tmp_path / "out.mp4"
    apply_broll_overlays(base, out, specs, W, H, edits=edits)
    f0 = frame_rgb(out, 5)
    assert close(px(f0, 0.25, 0.5), RED) and close(px(f0, 0.75, 0.5), GREEN)  # g flipped
    f1 = frame_rgb(out, 30)
    # g (z = 1) is above b → b (left half, blue) hidden under g everywhere.
    assert close(px(f1, 0.25, 0.5), RED) and close(px(f1, 0.75, 0.5), GREEN)
    edits["layerProps"] = [{"target": "broll:g", "flipH": True}]
    out2 = tmp_path / "out2.mp4"
    apply_broll_overlays(base, out2, specs, W, H, edits=edits)
    f2 = frame_rgb(out2, 30)
    # Default order (time): b on top, cropped to its left half.
    assert close(px(f2, 0.25, 0.5), BLUE) and close(px(f2, 0.75, 0.5), GREEN)


@ffmpeg
def test_main_keyframed_crop_with_opacity_pixels(tmp_path):
    """Both animated filters driven from ONE sendcmd file (merged `t a ..., b ...;` lines)."""
    src = tmp_path / "src.mp4"
    split_lr(src, (240, 240, 240), (240, 240, 240))
    out = tmp_path / "out.mp4"
    edits = {"keyframes": [
        {"target": "video", "prop": "cropL", "points": [{"tMs": 0, "v": 0}, {"tMs": 1000, "v": 50}]},
        {"target": "video", "prop": "opacity", "points": [{"tMs": 0, "v": 100}, {"tMs": 1000, "v": 50}]}]}
    assert apply_main_keyframes(src, out, edits, tmp_path)
    end = frame_rgb(out, 45)
    assert close(px(end, 0.25, 0.5), BLACK)
    assert close(px(end, 0.75, 0.5), (120, 120, 120))
