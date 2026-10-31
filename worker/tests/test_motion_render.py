"""E3 frame-sample parity: render real ffmpeg output and compare pixels with the shared math.

Runs against whatever `ffmpeg` is first on PATH. Prod is ffmpeg 5.1 — also run with a static 5.1
build: PATH=/path/to/ffmpeg-5.1:$PATH python -m pytest tests/test_motion_render.py
"""
from __future__ import annotations

import math
import shutil
import subprocess
from pathlib import Path

import pytest

from clips_worker.motion import (
    MOTION_FPS,
    TRANSITION_TYPES,
    cut_transition_windows,
    layer_transform_at,
    transition_frame,
    volume_at,
)
from clips_worker.broll_render import apply_broll_overlays
from clips_worker.motion import broll_transition_windows
from clips_worker.motion_render import apply_cut_transitions, apply_main_keyframes, apply_voice_volume

pytestmark = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not installed")

W, H = 320, 240
RED, BLUE, GREEN = (220, 30, 30), (30, 30, 220), (30, 200, 60)
TOL = 16


def run(cmd: list[str]) -> None:
    subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def hexc(c) -> str:
    return "0x%02X%02X%02X" % c


def make_full_render(path: Path, dur: float = 3.0, switch: float = 1.5) -> None:
    """A part (t < switch): red with a centred blue box (W/5 x H/5); B part: flat green. 440 Hz tone."""
    bw, bh = W // 5, H // 5
    fc = (
        f"color=c={hexc(RED)}:s={W}x{H}:r=30:d={switch},"
        f"drawbox=x={(W - bw) // 2}:y={(H - bh) // 2}:w={bw}:h={bh}:color={hexc(BLUE)}:t=fill[a];"
        f"color=c={hexc(GREEN)}:s={W}x{H}:r=30:d={dur - switch}[b];[a][b]concat=n=2:v=1:a=0,format=yuv420p[v]"
    )
    run(["ffmpeg", "-y", "-v", "error", "-filter_complex", fc, "-f", "lavfi", "-i", f"sine=f=440:d={dur}",
         "-map", "[v]", "-map", "0:a", "-c:v", "libx264", "-crf", "10", "-c:a", "aac", "-shortest", str(path)])


def concat_segments(src: Path, dest: Path, segs_sec: list[tuple[float, float]]) -> None:
    """Same filter as edits_render.ffmpeg_concat_segments (multi-segment branch)."""
    parts = []
    for i, (a, b) in enumerate(segs_sec):
        dur = b - a
        parts.append(f"[0:v]trim=start={a}:end={b},setpts=PTS-STARTPTS[v{i}]")
        parts.append(f"[0:a]atrim=start={a}:end={b},asetpts=PTS-STARTPTS,afade=t=in:d=0.01,"
                     f"afade=t=out:st={max(0, dur - 0.01):.3f}:d=0.01[a{i}]")
    fc = ";".join(parts) + ";" + "".join(f"[v{i}][a{i}]" for i in range(len(segs_sec))) + \
        f"concat=n={len(segs_sec)}:v=1:a=1[v][a]"
    run(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-filter_complex", fc, "-map", "[v]", "-map", "[a]",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "10", "-c:a", "aac", str(dest)])


def frame_rgb(video: Path, n: int, w: int = W, h: int = H) -> bytes:
    out = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(video), "-vf", f"select=eq(n\\,{n})", "-frames:v", "1",
         "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
    assert len(out) == w * h * 3, f"frame {n} missing"
    return out


def px(buf: bytes, u: float, v: float, w: int = W, h: int = H) -> tuple[int, int, int]:
    x = min(w - 1, int(u * w))
    y = min(h - 1, int(v * h))
    i = (y * w + x) * 3
    return buf[i], buf[i + 1], buf[i + 2]


def close(a, b, tol=TOL) -> bool:
    return max(abs(x - y) for x, y in zip(a, b)) <= tol


def content_a(u: float, v: float):
    return BLUE if abs(u - 0.5) < 0.1 and abs(v - 0.5) < 0.1 else RED


def content_b(u: float, v: float):
    return GREEN


def _inv(g: dict, u: float, v: float):
    """Frame point → layer content point (inverse of translate + scale about the centre)."""
    lu = (u - g["tx"] - 0.5) / g["scale"] + 0.5
    lv = (v - g["ty"] - 0.5) / g["scale"] + 0.5
    if not (0 <= lu < 1 and 0 <= lv < 1):
        return None
    return lu, lv


def _in_clip(clip, u, v) -> bool:
    t, r, b, l = clip
    return l <= u < 1 - r and t <= v < 1 - b


def predict(f: dict, u: float, v: float, fa=content_a, fb=content_b):
    """Expected RGB at (u, v) for transition frame f with A = fa, B = fb."""
    pa = _inv(f["a"], u, v)
    pb = _inv(f["b"], u, v)
    ca = fa(*pa) if pa else (0, 0, 0)
    cb = fb(*pb) if pb else (0, 0, 0)
    if f["geometric"]:
        if f["b"]["clip"] is not None:  # wipe
            return cb if _in_clip(f["b"]["clip"], u, v) else ca
        return ca if pa else cb  # push: A and B tile the frame
    col = (255, 255, 255) if f["color"] == "white" else (0, 0, 0)
    return tuple(f["wA"] * ca[i] + f["wB"] * cb[i] + f["wC"] * col[i] for i in range(3))


def stable(f: dict, u: float, v: float, fa=content_a, fb=content_b) -> bool:
    """Skip samples within 4 px of an edge of the prediction (sub-pixel rounding)."""
    c = predict(f, u, v, fa, fb)
    for du, dv in ((4 / W, 0), (-4 / W, 0), (0, 4 / H), (0, -4 / H)):
        if not close(c, predict(f, u + du, v + dv, fa, fb), 1):
            return False
    return True


SAMPLES = [(u / 100, v / 100) for u in (5, 20, 35, 45, 50, 55, 63, 72, 85, 95) for v in (5, 30, 50, 63, 95)]


@pytest.fixture(scope="module")
def media(tmp_path_factory):
    d = tmp_path_factory.mktemp("e3")
    full = d / "full_render.mp4"
    make_full_render(full)
    cut = d / "cut.mp4"
    concat_segments(full, cut, [(0.0, 1.0), (2.0, 3.0)])
    return d, full, cut


def probe_frames(video: Path) -> int:
    out = subprocess.run(["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries",
                          "stream=nb_read_frames", "-of", "csv=p=0", str(video)], capture_output=True, text=True,
                         check=True).stdout
    return int(out.strip())


def audio_md5(video: Path) -> str:
    return subprocess.run(["ffmpeg", "-v", "error", "-i", str(video), "-map", "0:a", "-c", "copy", "-f", "md5", "-"],
                          capture_output=True, text=True, check=True).stdout.strip()


@pytest.mark.parametrize("ttype", TRANSITION_TYPES)
def test_cut_transition_frame_samples(media, ttype):
    d, full, cut = media
    segs = [(0, 1000), (2000, 3000)]
    trs = [{"srcMs": 2000, "type": ttype, "durMs": 400}]
    out = d / f"tr_{ttype}.mp4"
    assert apply_cut_transitions(cut, full, out, segs, trs, 0)
    (win,) = cut_transition_windows(segs, trs)
    assert win["startFrame"] == 24 and win["frames"] == 12  # centred on the cut at 1.0 s
    # Output length and audio are untouched (captions / SFX timings stay valid).
    assert probe_frames(out) == probe_frames(cut)
    assert audio_md5(out) == audio_md5(cut)
    n = win["frames"]
    checked = 0
    for j in (0, 2, 3, 6, 9, 11):
        f = transition_frame(ttype, j / n)
        buf = frame_rgb(out, win["startFrame"] + j)
        for (u, v) in SAMPLES:
            if ttype == "blur" and abs(u - 0.5) < 0.1 + f["blurFrac"] + 0.03:
                continue  # blurred box edges: only flat regions are compared
            if not stable(f, u, v):
                continue
            exp = predict(f, u, v)
            got = px(buf, u, v)
            assert close(exp, got), (ttype, j, (u, v), exp, got)
            checked += 1
    assert checked > 40
    # Outside the window: the hard-cut content (A before, B after).
    assert close(px(frame_rgb(out, win["startFrame"] - 1), 0.2, 0.2), RED)
    assert close(px(frame_rgb(out, win["startFrame"] + n), 0.2, 0.2), GREEN)


def test_main_keyframes_geometry_and_opacity(media):
    d, full, _ = media
    a_only = d / "a_only.mp4"
    run(["ffmpeg", "-y", "-v", "error", "-i", str(full), "-t", "1.4", "-c:v", "libx264", "-crf", "10",
         "-c:a", "aac", str(a_only)])
    edits = {"keyframes": [
        {"target": "video", "prop": "scale", "points": [{"tMs": 0, "v": 100}, {"tMs": 1000, "v": 50, "ease": "inOut"}]},
        {"target": "video", "prop": "x", "points": [{"tMs": 0, "v": 0}, {"tMs": 1000, "v": 20}]},
        {"target": "video", "prop": "rotation", "points": [{"tMs": 0, "v": 0}, {"tMs": 1000, "v": 90}]},
        {"target": "video", "prop": "opacity", "points": [{"tMs": 0, "v": 100}, {"tMs": 1000, "v": 50, "ease": "out"}]},
    ]}
    out = d / "kf.mp4"
    assert apply_main_keyframes(a_only, out, edits, d)
    assert probe_frames(out) == probe_frames(a_only)
    checked = 0
    for n in (0, 15, 30, 36):
        tf = layer_transform_at(edits, "video", n * 1000 / MOTION_FPS)
        buf = frame_rgb(out, n)
        s, r, op = tf["scale"] / 100, math.radians(tf["rotation"]), tf["opacity"] / 100
        cx, cy = (0.5 + tf["x"] / 100) * W, (0.5 + tf["y"] / 100) * H

        def src(xp: float, yp: float):
            # p = c + R(θ, clockwise on screen)·S·(q − c0)  →  q = c0 + S⁻¹·R⁻¹·(p − c)
            dx, dy = xp - cx, yp - cy
            qx = (math.cos(r) * dx + math.sin(r) * dy) / s + W / 2
            qy = (-math.sin(r) * dx + math.cos(r) * dy) / s + H / 2
            if not (0 <= qx < W and 0 <= qy < H):
                return (0, 0, 0)
            return content_a(qx / W, qy / H)

        for (u, v) in SAMPLES:
            xp, yp = u * W + 0.5, v * H + 0.5
            c = src(xp, yp)
            if any(src(xp + ex, yp + ey) != c for ex in (-4, 4) for ey in (-4, 4)):
                continue
            exp = tuple(round(ch * op) for ch in c)
            got = px(buf, u, v)
            assert close(exp, got), (n, (u, v), exp, got, tf)
            checked += 1
    assert checked > 60


def _rms(video: Path, start: float, dur: float) -> float:
    import array

    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{start}", "-t", f"{dur}", "-i", str(video), "-map", "0:a",
                          "-ac", "1", "-ar", "48000", "-f", "s16le", "-"], capture_output=True, check=True).stdout
    a = array.array("h", raw)
    return math.sqrt(sum(x * x for x in a) / max(1, len(a)))


def test_voice_volume_envelope(media):
    d, _, cut = media
    edits = {"keyframes": [{"target": "voice", "prop": "volume",
                            "points": [{"tMs": 0, "v": 100}, {"tMs": 1000, "v": 100}, {"tMs": 1001, "v": 25}]}]}
    out = d / "vol.mp4"
    assert apply_voice_volume(cut, out, edits)
    assert probe_frames(out) == probe_frames(cut)
    ratio = _rms(out, 1.3, 0.4) / _rms(cut, 1.3, 0.4)
    assert abs(ratio - volume_at(edits, "voice", 1500)) < 0.03
    assert abs(_rms(out, 0.3, 0.4) / _rms(cut, 0.3, 0.4) - 1.0) < 0.03


def _flat(path: Path, colour, dur: float) -> None:
    run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"color=c={hexc(colour)}:s={W}x{H}:r=30:d={dur}",
         "-c:v", "libx264", "-crf", "10", "-pix_fmt", "yuv420p", str(path)])


def test_broll_keyframes_and_transitions(media, tmp_path):
    d, _, _ = media
    base = tmp_path / "base.mp4"
    run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"color=c={hexc(RED)}:s={W}x{H}:r=30:d=3",
         "-f", "lavfi", "-i", "sine=f=440:d=3", "-c:v", "libx264", "-crf", "10", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-shortest", str(base)])
    g, b = tmp_path / "g.mp4", tmp_path / "b.mp4"
    _flat(g, GREEN, 4)
    _flat(b, BLUE, 4)
    items = [
        {"id": "g", "startMs": 500, "endMs": 1500, "transitionIn": {"type": "crossfade", "durMs": 300}},
        {"id": "b", "startMs": 1500, "endMs": 2500, "transitionIn": {"type": "wipe_left", "durMs": 400},
         "transitionOut": {"type": "dip_black", "durMs": 300}},
    ]
    edits = {"broll": items, "keyframes": [{"target": "broll:b", "prop": "scale", "value": 50, "points": []}]}
    specs = [
        {"local_path": g, "start_s": 0.5, "end_s": 1.5, "duration_s": 1.0, "in_s": 0, "id": "g",
         "transitionIn": items[0]["transitionIn"]},
        {"local_path": b, "start_s": 1.5, "end_s": 2.5, "duration_s": 1.0, "in_s": 0, "id": "b",
         "transitionIn": items[1]["transitionIn"], "transitionOut": items[1]["transitionOut"]},
    ]
    out = tmp_path / "broll.mp4"
    apply_broll_overlays(base, out, specs, W, H, edits=edits)
    assert probe_frames(out) == probe_frames(base)
    wins = broll_transition_windows(items)
    assert [(w["itemId"], w["kind"], w["startFrame"], w["frames"]) for w in wins] == [
        ("g", "in", 15, 9), ("b", "between", 45, 12), ("b", "out", 66, 9)]

    def red(u, v):
        return RED

    def with_g(u, v):
        return GREEN

    def with_b_over(under):
        def f(u, v):  # b scaled 50 % about the centre over `under`
            return BLUE if abs(u - 0.5) < 0.25 and abs(v - 0.5) < 0.25 else under(u, v)
        return f

    plan = {
        "in": (red, with_g),
        "between": (with_g, with_b_over(with_g)),
        "out": (with_b_over(red), red),
    }
    checked = 0
    for w in wins:
        fa, fb = plan[w["kind"]]
        for j in range(0, w["frames"], 2):
            f = transition_frame(w["type"], j / w["frames"])
            buf = frame_rgb(out, w["startFrame"] + j)
            for (u, v) in SAMPLES:
                if not stable(f, u, v, fa, fb):
                    continue
                exp = predict(f, u, v, fa, fb)
                got = px(buf, u, v)
                assert close(exp, got), (w["kind"], j, (u, v), exp, got)
                checked += 1
    assert checked > 200
    # Steady state between windows.
    assert close(px(frame_rgb(out, 30), 0.1, 0.1), GREEN)
    mid = frame_rgb(out, 60)
    # The outgoing item only continues through the between-window; after it the scaled item sits on V.
    assert close(px(mid, 0.5, 0.5), BLUE) and close(px(mid, 0.1, 0.1), RED)
    assert close(px(frame_rgb(out, 80), 0.5, 0.5), RED)


def _bright_centroid_x(buf: bytes, w: int, h: int) -> float | None:
    xs, n = 0.0, 0
    for y in range(0, h, 2):
        row = y * w * 3
        for x in range(0, w, 2):
            i = row + x * 3
            if buf[i] > 150 and buf[i + 1] > 150 and buf[i + 2] < 120:  # yellow hook text
                xs += x
                n += 1
    return xs / n if n > 30 else None


def test_hook_text_keyframes(tmp_path):
    from clips_worker.hook_overlay import _hook_ass, apply_hook_overlay, hook_fade_at

    w, h = 360, 640
    edits = {
        "hookOverlay": {"enabled": True, "text": "HOOK", "durationMs": 2000},
        "keyframes": [{"target": "text", "prop": "x", "points": [{"tMs": 0, "v": 0}, {"tMs": 1000, "v": 25}]}],
    }
    ass = _hook_ass("HOOK", 2000, w=w, h=h, primary_color="#FACC15", motion_edits=edits)
    events = [ln for ln in ass.splitlines() if ln.startswith("Dialogue:")]
    assert len(events) == 60  # one per output frame
    assert r"\pos(180,70)" in events[0] and r"\pos(270,70)" in events[45]  # 25 % of 360 = 90 px
    assert hook_fade_at(0, 2000) == 0 and hook_fade_at(1000, 2000) == 1
    base = tmp_path / "black.mp4"
    run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"color=c=black:s={w}x{h}:r=30:d=2",
         "-c:v", "libx264", "-pix_fmt", "yuv420p", str(base)])
    out = tmp_path / "hook.mp4"
    try:
        apply_hook_overlay(base, out, edits, play_w=w, play_h=h)
    except subprocess.CalledProcessError:
        pytest.skip("ffmpeg without libass")
    c0 = _bright_centroid_x(frame_rgb(out, 10, w, h), w, h)
    c1 = _bright_centroid_x(frame_rgb(out, 45, w, h), w, h)
    assert c0 is not None and c1 is not None
    assert abs(c0 - (180 + 0.25 * 360 * 10 / 30)) < 6
    assert abs(c1 - 270) < 6
