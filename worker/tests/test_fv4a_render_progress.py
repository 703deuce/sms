"""FV4a: long full-video exports — expression depth, real ffmpeg progress, claim loss, timeouts.

Run inside the worker image (ffmpeg 5.1.x): pytest -q tests/test_fv4a_render_progress.py
"""
from __future__ import annotations

import array
import os
import random
import shutil
import subprocess
import sys
import threading
import time
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

sys.modules.setdefault("psycopg2", MagicMock())
sys.modules.setdefault("psycopg2.extras", MagicMock())

from clips_worker.ffexpr import balanced_piecewise, nesting_depth  # noqa: E402
from clips_worker.motion import track_expr, track_value_at  # noqa: E402
from clips_worker.zoom_render import _centre_offset_expr, _scale_factor_expr  # noqa: E402

needs_ff = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg missing")


def _punch_keyframes(n: int, gap: float = 14.0, peak: float = 1.12) -> tuple[list[tuple[float, float]], float]:
    out = [(0.0, 1.0)]
    t = 2.0
    for _ in range(n):
        out += [(t, 1.0), (t + 0.25, peak), (t + 1.25, peak), (t + 1.65, 1.0)]
        t += gap
    dur = t + 5.0
    out.append((dur, 1.0))
    return out, dur


def _ref_zoom(kf: list[tuple[float, float]], t: float) -> float:
    for (t0, z0), (t1, z1) in zip(kf, kf[1:]):
        if t0 <= t <= t1 and t1 > t0:
            return z0 + (z1 - z0) * (t - t0) / (t1 - t0)
    return 1.0


def _aeval(expr: str, rate: int, dur: float) -> array.array:
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-f", "lavfi", "-i", f"aevalsrc=exprs='{expr}':s={rate}:d={dur}",
         "-f", "f64le", "-c:a", "pcm_f64le", "-"],
        capture_output=True, check=True,
    ).stdout
    return array.array("d", raw)


# --- 1. expression depth (the 31 Oct 12-min export died here) -------------------------------------

def test_balanced_piecewise_depth_is_logarithmic():
    n = 10_000
    expr = balanced_piecewise("t", [str(i) for i in range(n)], [str(i) for i in range(n + 1)])
    assert nesting_depth(expr) < 40


def test_zoom_expr_depth_stays_small_for_a_long_video():
    kf, _ = _punch_keyframes(150)  # ~35 min of 14 s spaced punches
    assert nesting_depth(_scale_factor_expr(kf)) < 40


@needs_ff
@pytest.mark.parametrize("punches", [5, 30, 120])
def test_zoom_filtergraph_with_many_punches_is_valid(punches):
    kf, _ = _punch_keyframes(punches)
    z = _scale_factor_expr(kf)
    w, h = 320, 180
    vf = (
        f"scale=w='trunc(iw*({z})/2)*2':h='trunc(ih*({z})/2)*2':eval=frame,"
        f"crop=w={w}:h={h}:x='{_centre_offset_expr(z, w)}':y='{_centre_offset_expr(z, h)}':exact=1"
    )
    subprocess.run(
        ["ffmpeg", "-v", "error", "-f", "lavfi", "-i", f"testsrc=s={w}x{h}:r=5:d=3", "-vf", vf, "-f", "null", "-"],
        check=True, capture_output=True,
    )


@needs_ff
def test_zoom_expr_values_match_the_keyframes():
    kf, dur = _punch_keyframes(60)
    vals = _aeval(_scale_factor_expr(kf), 50, dur)
    assert len(vals) >= int(dur * 50) - 2
    for i in range(0, len(vals), 3):
        t = i / 50
        assert abs(vals[i] - _ref_zoom(kf, t)) < 2e-4, (t, vals[i], _ref_zoom(kf, t))


@needs_ff
def test_long_envelope_track_evaluates_to_the_math():
    rnd = random.Random(7)
    pts, t = [], 0
    for i in range(300):  # 300-point opacity / volume envelope (old chain broke at ~100)
        t += rnd.randint(80, 900)
        pts.append({"tMs": t, "v": float(rnd.randint(0, 100)), "ease": rnd.choice(["linear", "in", "out", "inOut"])})
    tr = {"target": "voice", "prop": "volume", "points": pts}
    expr = track_expr(tr, "volume", var="t", origin_s=0.25)
    assert nesting_depth(expr) < 40
    dur = pts[-1]["tMs"] / 1000 + 2
    rate = 100
    vals = _aeval(expr, rate, dur)
    for i in range(0, len(vals), 5):
        local_ms = i * 1000 / rate - 250
        exp = track_value_at(tr, "volume", local_ms)
        assert abs(vals[i] - exp) < 1e-6, (local_ms, vals[i], exp)


# --- 2. real progress through the PATH shim ---------------------------------------------------------

@needs_ff
def test_shim_reports_ffmpeg_out_time_and_restores_path(tmp_path):
    from clips_worker.export_progress import RenderProgress

    path_before = os.environ.get("PATH")
    with RenderProgress(4.0, 2, work_dir=tmp_path, stall_seconds=600) as tr:
        assert tr.installed
        subprocess.check_call(
            ["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc=s=160x90:r=10:d=4", "-f", "null", "-"]
        )
        snap = tr.snapshot()
        assert len(tr.passes) == 1
        p = next(iter(tr.passes.values()))
        assert p.ended is not None
        assert 3_500_000 <= p.out_us <= 4_200_000
        assert 10 <= snap["progress"] <= 89  # FV4b: encode band 10–89
    assert os.environ.get("PATH") == path_before
    assert "FV4A_PROGRESS_DIR" not in os.environ


@needs_ff
def test_shim_covers_grandchildren(tmp_path):
    """The layout pass runs ffmpeg from a separate Python process (prototype/v3/speakercrop.py)."""
    from clips_worker.export_progress import RenderProgress

    code = (
        "import subprocess; subprocess.check_call(['ffmpeg','-v','error','-f','lavfi','-i',"
        "'testsrc=s=160x90:r=10:d=3','-f','null','-'])"
    )
    with RenderProgress(3.0, 2, work_dir=tmp_path) as tr:
        subprocess.check_call([sys.executable, "-c", code], env=os.environ.copy())
        tr.snapshot()
        assert len(tr.passes) == 1
        assert next(iter(tr.passes.values())).out_us >= 2_500_000


@needs_ff
def test_cancel_kills_running_ffmpeg_and_blocks_the_next_one(tmp_path):
    from clips_worker.export_progress import RenderProgress

    result: dict = {}

    def run():
        result["rc"] = subprocess.run(
            ["ffmpeg", "-v", "error", "-re", "-f", "lavfi", "-i", "testsrc=s=160x90:r=10:d=60", "-f", "null", "-"]
        ).returncode

    with RenderProgress(60.0, 2, work_dir=tmp_path) as tr:
        th = threading.Thread(target=run)
        th.start()
        time.sleep(1.5)
        tr.cancel("timeout")
        th.join(timeout=10)
        assert not th.is_alive()
        assert result["rc"] != 0
        rc = subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc=d=1", "-f", "null", "-"]).returncode
        assert rc == 255
        with pytest.raises(Exception) as ei:
            tr.check()
        assert getattr(ei.value, "reason", "") == "timeout"


def test_progress_is_monotonic_capped_and_has_eta(tmp_path):
    from clips_worker.export_progress import PROGRESS_HI, RenderProgress

    now = [1000.0]
    alive = {111: True, 222: True}
    tr = RenderProgress(100.0, 3, work_dir=tmp_path, clock=lambda: now[0],
                        pid_alive=lambda pid: alive.get(pid, False), child_cpu=lambda: now[0])
    seen = []

    def write(pid, out_s, end=False):
        (tr.progress_dir / f"{pid}.txt").write_text(
            f"frame=1\nout_time_us={int(out_s * 1e6)}\nprogress={'end' if end else 'continue'}\n"
        )

    for out_s in (0, 20, 50, 80):
        write(111, out_s)
        now[0] += 30
        seen.append(tr.snapshot())
    write(111, 100, end=True)
    now[0] += 30
    seen.append(tr.snapshot())
    for out_s in (10, 60):
        write(222, out_s)
        now[0] += 30
        seen.append(tr.snapshot())
    progs = [s["progress"] for s in seen]
    assert progs == sorted(progs)
    assert all(10 <= p <= PROGRESS_HI for p in progs)  # FV4b: encode band
    assert seen[-1]["step"] == 2 and seen[-1]["steps"] == 3
    assert seen[-1]["eta_s"] is not None and seen[-1]["eta_s"] > 0
    assert len({s["activity"] for s in seen}) == len(seen)  # every tick moved
    tr.__exit__(None, None, None)


def test_tick_cancels_on_stall_and_hard_cap(tmp_path):
    from clips_worker.export_progress import RenderProgress, render_max_seconds

    now = [0.0]
    tr = RenderProgress(10.0, 2, work_dir=tmp_path, clock=lambda: now[0], stall_seconds=300,
                        max_seconds=10_000, pid_alive=lambda pid: False, child_cpu=lambda: 0.0)
    tr.tick()
    now[0] += 301
    tr.tick()
    assert tr.cancel_reason == "stalled"
    tr.__exit__(None, None, None)

    tr2 = RenderProgress(10.0, 2, work_dir=tmp_path, clock=lambda: now[0], stall_seconds=10**9,
                         max_seconds=100, pid_alive=lambda pid: False, child_cpu=lambda: now[0])
    now[0] += 101
    tr2.tick()
    assert tr2.cancel_reason == "timeout"
    tr2.__exit__(None, None, None)
    # 716 s export → 2 h 14 min cap; short clips get the 30 min floor; 6 h ceiling
    assert render_max_seconds(715.7) == pytest.approx(900 + 10 * 715.7)
    assert render_max_seconds(30) == 1800
    assert render_max_seconds(10_000) == 6 * 3600


def test_estimate_passes_counts_heavy_stages():
    from clips_worker.export_progress import estimate_export_passes

    assert estimate_export_passes({}) == 2
    edits = {"layerProps": [{"target": "video", "flipH": True}], "zoom": {"enabled": True}}
    assert estimate_export_passes(edits) == 4


# --- 3. claim loss: the requeued copy stops and never overwrites the retry --------------------------

def test_heartbeat_reports_claim_lost_after_two_misses():
    from clips_worker.job_lock import JobLockHeartbeat

    answers = iter([True, False, None, False, False])
    lost = []
    hb = JobLockHeartbeat("dsn", "job_1", "w:s0", touch=lambda *_: next(answers), on_lost=lambda: lost.append(1))
    for _ in range(3):
        hb._beat()
    assert not hb.lost.is_set()  # True, False, None (DB error does not count)
    hb._beat()
    assert hb.lost.is_set() and lost == [1]
    hb._beat()
    assert lost == [1]  # once


class _Cur:
    def __init__(self, log, row=None):
        self.log, self.row, self.rowcount = log, row, 1

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def execute(self, sql, params=None):
        self.log.append((" ".join(sql.split()), params))

    def fetchone(self):
        return self.row


class _Conn:
    def __init__(self, row=None):
        self.log, self.row = [], row

    def cursor(self, *a, **k):
        return _Cur(self.log, self.row)

    def commit(self):
        pass

    def rollback(self):
        pass


def test_run_job_does_not_fail_a_job_it_no_longer_owns(monkeypatch):
    import clips_worker.job_contract as jc
    import clips_worker.job_lock as jl

    failed = []
    monkeypatch.setattr(jc, "fail_job", lambda *a, **k: failed.append(a))
    monkeypatch.setattr(jl, "job_still_owned", lambda conn, job_id, instance_id=None: False)

    def boom(conn, job):
        raise RuntimeError("ffmpeg failed")

    conn = _Conn()
    jc.run_job(conn, {"id": "job_1", "type": "RENDER_CLIP", "payload": {"renderId": "r1"}}, boom)
    assert failed == []
    rel = [s for s, p in conn.log if s.startswith("UPDATE clip_jobs SET \"lockedBy\" = NULL")]
    assert rel and '"lockedBy" = %s' in rel[-1]  # scoped release: never unlocks another slot's retry


def test_run_job_fails_with_a_plain_message_on_timeout(monkeypatch):
    import clips_worker.job_contract as jc
    import clips_worker.job_lock as jl
    from clips_worker.export_progress import RenderCanceled, cancel_message

    failed = []
    monkeypatch.setattr(jc, "fail_job", lambda conn, job, msg, **k: failed.append(msg))
    monkeypatch.setattr(jl, "job_still_owned", lambda conn, job_id, instance_id=None: True)

    def slow(conn, job):
        raise RenderCanceled("timeout")

    jc.run_job(_Conn(), {"id": "job_1", "type": "RENDER_CLIP", "payload": {}}, slow)
    assert failed == [cancel_message("timeout")]


def test_job_still_owned_reads_status_and_lock():
    from clips_worker.job_lock import job_still_owned

    assert job_still_owned(_Conn({"status": "RUNNING", "lockedBy": "w:s0"}), "j", "w:s0") is True
    assert job_still_owned(_Conn({"status": "QUEUED", "lockedBy": None}), "j", "w:s0") is False
    assert job_still_owned(_Conn({"status": "RUNNING", "lockedBy": "w:s1"}), "j", "w:s0") is False
    assert job_still_owned(_Conn(None), "j", "w:s0") is False


def test_progress_posts_carry_the_worker_slot_id(monkeypatch):
    import clips_worker.main as main_mod

    sent = []
    monkeypatch.setenv("APP_URL", "https://transovo.ai")
    monkeypatch.setattr(main_mod, "_post_progress_once", lambda job_id, payload, base: sent.append(payload))
    main_mod.post_progress("job_1", {"jobStatus": "RUNNING", "progress": 60})
    assert sent and sent[0]["workerId"]


def test_long_clips_skip_modal(monkeypatch):
    import clips_worker.gpu_encode as ge

    monkeypatch.setattr(ge, "_clip_src_duration_s", lambda p: 715.7)
    assert ge._too_long_for_modal(SimpleNamespace(src_path=Path("x.mp4"))) is True
    monkeypatch.setattr(ge, "_clip_src_duration_s", lambda p: 60.0)
    assert ge._too_long_for_modal(SimpleNamespace(src_path=Path("x.mp4"))) is False
