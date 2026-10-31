"""FV4b: one monotonic overall % (prep 0–10 / encode 10–90 / upload 90–100), a stable ETA, and the
speakercrop blur-band skip when source and output aspect already match.

Quick: pytest -q tests/test_fv4b_progress.py (no ffmpeg needed; the speakercrop test needs cv2/numpy).
"""
from __future__ import annotations

import ast
import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest

sys.modules.setdefault("psycopg2", MagicMock())
sys.modules.setdefault("psycopg2.extras", MagicMock())

from clips_worker.export_progress import (  # noqa: E402
    ENCODE_HI,
    ENCODE_LO,
    PROGRESS_HI,
    EtaSmoother,
    RenderProgress,
    overall_progress,
)


def test_overall_bands():
    assert overall_progress("prep", 0) == 0
    assert overall_progress("prep", 1) == 9
    assert overall_progress("encode", 0) == ENCODE_LO == 10
    assert overall_progress("encode", 0.5) == 50
    assert overall_progress("encode", 1) == ENCODE_HI - 1 == 89
    assert overall_progress("upload", 0) == 90
    assert overall_progress("upload", 0.5) == 95
    assert overall_progress("upload", 1) == 99
    assert overall_progress("done") == 100
    seq = [overall_progress("prep", 0.2), overall_progress("prep", 0.6), overall_progress("encode", 0),
           overall_progress("encode", 0.7), overall_progress("upload", 0), overall_progress("upload", 0.5), 100]
    assert seq == sorted(seq)


def test_eta_hidden_until_ten_percent():
    e = EtaSmoother()
    assert e.update(60, 0.05, 1060) is None
    assert e.update(100, 0.099, 1100) is None
    assert e.update(120, 0.10, 1120) is not None


def test_eta_is_elapsed_over_fraction_and_counts_down():
    e = EtaSmoother(tail_s=0)
    assert e.update(100, 0.25, 0) == 300  # 100 s for 25 % → 300 s left
    # Same speed 15 s later: running countdown and fresh estimate agree.
    v = e.update(115, 115 / 400, 15)
    assert 280 <= v <= 290


def test_eta_does_not_jump_when_a_slower_pass_starts():
    """Live 14:39 ET export: ~2 min then ~12 min. A sudden 4× raw estimate may only raise it slowly."""
    e = EtaSmoother(tail_s=0)
    first = e.update(120, 0.5, 0)  # raw 120 s
    shown = [first]
    t = 0
    for f in (0.51, 0.52, 0.53, 0.54):  # pass 2 is 4x slower: raw estimate jumps up
        t += 15
        shown.append(e.update(120 + t, f, t))
    for a, b in zip(shown, shown[1:]):
        assert b <= a * 1.15 + 30 + 1
    assert shown[-1] < 500


def _write(tr, pid, out_s, end=False):
    (tr.progress_dir / f"{pid}.txt").write_text(
        f"frame=1\nout_time_us={int(out_s * 1e6)}\nprogress={'end' if end else 'continue'}\n"
    )


def test_tracker_progress_monotonic_in_encode_band_even_when_passes_exceed_estimate(tmp_path):
    now = [1000.0]
    alive = {1: True, 2: True, 3: True}
    tr = RenderProgress(100.0, 2, work_dir=tmp_path, clock=lambda: now[0],
                        pid_alive=lambda pid: alive.get(pid, False), child_cpu=lambda: now[0])
    seen = []
    for pid in (1, 2, 3):  # 3 heavy passes, estimate said 2 → raw fraction would dip
        for out_s in (10, 50, 90):
            _write(tr, pid, out_s)
            now[0] += 30
            seen.append(tr.snapshot())
        _write(tr, pid, 100, end=True)
        now[0] += 30
        seen.append(tr.snapshot())
    progs = [s["progress"] for s in seen]
    fracs = [s["frac"] for s in seen]
    assert progs == sorted(progs) and fracs == sorted(fracs)
    assert all(ENCODE_LO <= p <= PROGRESS_HI for p in progs)
    assert seen[0]["eta_s"] is None  # < 10 % of the encode
    assert seen[-1]["eta_s"] is not None
    tr.__exit__(None, None, None)


def _render_wide_fn(W, H, OUT_W, OUT_H):
    cv2 = pytest.importorskip("cv2")
    np = pytest.importorskip("numpy")
    src = Path(__file__).resolve().parents[1] / "prototype" / "v3" / "speakercrop.py"
    tree = ast.parse(src.read_text())
    fn = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "render_wide")
    g = {"cv2": cv2, "np": np, "W": W, "H": H, "OUT_W": OUT_W, "OUT_H": OUT_H}
    exec(compile(ast.Module(body=[fn], type_ignores=[]), str(src), "exec"), g)
    return g["render_wide"], cv2, np


def test_speakercrop_fit_same_aspect_skips_blur_band():
    render_wide, cv2, np = _render_wide_fn(1280, 720, 1920, 1080)
    fr = np.random.default_rng(0).integers(0, 255, (720, 1280, 3), dtype=np.uint8)
    calls = []
    orig = cv2.GaussianBlur
    cv2.GaussianBlur = lambda *a, **k: calls.append(1) or orig(*a, **k)
    try:
        out = render_wide(fr)
    finally:
        cv2.GaussianBlur = orig
    assert out.shape == (1080, 1920, 3)
    assert not calls
    expect = cv2.resize(fr, (1920, 1080), interpolation=cv2.INTER_CUBIC)
    assert np.array_equal(out, expect)


def test_speakercrop_fit_other_aspect_keeps_blur_band():
    render_wide, cv2, np = _render_wide_fn(1280, 720, 1080, 1920)  # 16:9 source → 9:16 output
    fr = np.full((720, 1280, 3), 200, dtype=np.uint8)
    out = render_wide(fr)
    assert out.shape == (1920, 1080, 3)
    assert out[0, 0].max() < 200  # blurred / dimmed background band above the picture
